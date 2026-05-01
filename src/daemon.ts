/**
 * sportsclaw — Cross-platform Daemon Manager
 *
 * Supervises listener processes via the host OS's native service manager:
 *   - macOS  : launchd (~/Library/LaunchAgents/gg.sportsclaw.<platform>.plist)
 *   - Linux  : systemd --user (~/.config/systemd/user/sportsclaw-<platform>.service)
 *   - Windows: Task Scheduler (schtasks) + a tiny .cmd respawn wrapper
 *
 * Why not pm2: pm2 6.0.x's fork-mode pipe machinery hangs silently under
 * Node 25 on macOS — the listener loads, prints nothing, never connects to
 * the network, and pm2 still reports it "online". OS-native supervisors
 * don't have that failure mode.
 *
 * Logs always live at ~/.sportsclaw/logs/<platform>-out.log and -err.log,
 * regardless of platform.
 */

import { execSync, execFileSync, spawnSync } from "node:child_process";
import { existsSync, mkdirSync, writeFileSync, readFileSync, statSync, openSync, readSync, closeSync } from "node:fs";
import { homedir, platform as osPlatform } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

// ---------------------------------------------------------------------------
// Public types and validation
// ---------------------------------------------------------------------------

export type DaemonPlatform = "discord" | "telegram" | "watch";
const VALID_PLATFORMS: DaemonPlatform[] = ["discord", "telegram", "watch"];

export function isValidPlatform(value: string): value is DaemonPlatform {
  return VALID_PLATFORMS.includes(value as DaemonPlatform);
}

// ---------------------------------------------------------------------------
// Shared helpers
// ---------------------------------------------------------------------------

function entryPoint(): string {
  return fileURLToPath(new URL("../dist/index.js", import.meta.url));
}

function nodeBin(): string {
  return process.execPath;
}

function logsDir(): string {
  const dir = join(homedir(), ".sportsclaw", "logs");
  if (!existsSync(dir)) mkdirSync(dir, { recursive: true });
  return dir;
}

function logPaths(platform: DaemonPlatform): { out: string; err: string } {
  return {
    out: join(logsDir(), `${platform}-out.log`),
    err: join(logsDir(), `${platform}-err.log`),
  };
}

function scriptArgsFor(platform: DaemonPlatform): string[] {
  if (platform === "watch") {
    return ["watch", `--config=${join(homedir(), ".sportsclaw", "watchers.json")}`];
  }
  return ["listen", platform];
}

/** Tail the last N lines of a file. Cross-platform replacement for `tail`. */
function tailFile(path: string, lines: number): string {
  if (!existsSync(path)) return "";
  const size = statSync(path).size;
  if (size === 0) return "";
  // Read the last ~64KB; for log tails that's plenty.
  const readBytes = Math.min(size, 64 * 1024);
  const fd = openSync(path, "r");
  try {
    const buf = Buffer.alloc(readBytes);
    readSync(fd, buf, 0, readBytes, size - readBytes);
    const text = buf.toString("utf-8");
    const all = text.split(/\r?\n/);
    const trimmed = all.slice(-lines - 1).join("\n");
    return trimmed;
  } finally {
    closeSync(fd);
  }
}

// ---------------------------------------------------------------------------
// Driver interface
// ---------------------------------------------------------------------------

interface Driver {
  name: string;
  start(platform: DaemonPlatform): void;
  stop(platform: DaemonPlatform): void;
  status(): void;
  logs(platform: DaemonPlatform, lines: number): void;
  restart(platform: DaemonPlatform): void;
}

function driver(): Driver {
  switch (osPlatform()) {
    case "darwin":
      return launchdDriver;
    case "linux":
      return systemdDriver;
    case "win32":
      return windowsDriver;
    default:
      throw new Error(
        `Unsupported platform: ${osPlatform()}. sportsclaw daemons require macOS, Linux, or Windows.`
      );
  }
}

// ---------------------------------------------------------------------------
// pm2 migration — auto-clean any pm2-registered sportsclaw-<platform> entry
// before installing the OS-native supervisor. Two supervisors managing the
// same listener = duplicate Telegram polls / Discord gateways. The pm2 entry
// was originally created by an older sportsclaw, so deleting it is safe.
//
// Opt out by setting SPORTSCLAW_KEEP_PM2=1 in the environment.
// ---------------------------------------------------------------------------

interface Pm2Process {
  name: string;
  pid?: number;
  pm2_env?: { status?: string };
}

function migratePm2IfPresent(platform: DaemonPlatform): void {
  if (process.env.SPORTSCLAW_KEEP_PM2 === "1") return;

  // Only proceed if pm2 is actually on PATH.
  const which = spawnSync(osPlatform() === "win32" ? "where.exe" : "which", ["pm2"], {
    encoding: "utf-8",
  });
  if (which.status !== 0) return;

  const list = spawnSync("pm2", ["jlist"], { encoding: "utf-8" });
  if (list.status !== 0 || !list.stdout) return;

  let procs: Pm2Process[];
  try {
    procs = JSON.parse(list.stdout) as Pm2Process[];
  } catch {
    return;
  }

  const target = `sportsclaw-${platform}`;
  const match = procs.find((p) => p.name === target);
  if (!match) return;

  const status = match.pm2_env?.status ?? "unknown";
  const pidPart = match.pid ? ` (PID ${match.pid})` : "";
  console.log(
    `Migrating from pm2: removing ${target}${pidPart}, status: ${status}`
  );
  // delete includes stop, idempotent. Discard output unless it fails loudly.
  const del = spawnSync("pm2", ["delete", target], { encoding: "utf-8" });
  if (del.status !== 0) {
    console.error(
      `pm2 delete ${target} failed (exit ${del.status}). Continuing — but you may end up with two supervisors. ` +
        `Run \`pm2 delete ${target}\` manually if so, or set SPORTSCLAW_KEEP_PM2=1 to skip this check.`
    );
    return;
  }
  console.log(`  pm2 entry removed. The OS supervisor will take over now.`);
}

// ---------------------------------------------------------------------------
// Public API — same surface as before, dispatched per-OS
// ---------------------------------------------------------------------------

export function daemonStart(platform: DaemonPlatform): void {
  migratePm2IfPresent(platform);
  driver().start(platform);
}

export function daemonStop(platform: DaemonPlatform): void {
  // Migration is silent when no pm2 entry exists, so this only fires when
  // the user has a leftover pm2 daemon — exactly when stopping it is helpful.
  migratePm2IfPresent(platform);
  driver().stop(platform);
}

export function daemonStatus(): void {
  driver().status();
}

export function daemonLogs(platform: DaemonPlatform, lines = 50): void {
  driver().logs(platform, lines);
}

export function daemonRestart(platform: DaemonPlatform): void {
  migratePm2IfPresent(platform);
  driver().restart(platform);
}

// ---------------------------------------------------------------------------
// macOS — launchd
// ---------------------------------------------------------------------------

const LAUNCHD_LABEL_PREFIX = "gg.sportsclaw.";

function launchdLabel(p: DaemonPlatform): string {
  return `${LAUNCHD_LABEL_PREFIX}${p}`;
}

function launchdPlistPath(p: DaemonPlatform): string {
  return join(homedir(), "Library", "LaunchAgents", `${launchdLabel(p)}.plist`);
}

function launchdRenderPlist(p: DaemonPlatform): string {
  const { out, err } = logPaths(p);
  const args = [nodeBin(), entryPoint(), ...scriptArgsFor(p)];
  const xmlArgs = args
    .map((a) => `        <string>${escapeXml(a)}</string>`)
    .join("\n");
  return `<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
    <key>Label</key>
    <string>${launchdLabel(p)}</string>

    <key>ProgramArguments</key>
    <array>
${xmlArgs}
    </array>

    <key>WorkingDirectory</key>
    <string>${escapeXml(homedir())}</string>

    <key>EnvironmentVariables</key>
    <dict>
        <key>PATH</key>
        <string>/opt/homebrew/bin:/usr/local/bin:/usr/bin:/bin:/usr/sbin:/sbin</string>
        <key>HOME</key>
        <string>${escapeXml(homedir())}</string>
    </dict>

    <key>RunAtLoad</key>
    <true/>

    <key>KeepAlive</key>
    <dict>
        <key>SuccessfulExit</key>
        <false/>
        <key>Crashed</key>
        <true/>
    </dict>

    <key>ThrottleInterval</key>
    <integer>10</integer>

    <key>StandardOutPath</key>
    <string>${escapeXml(out)}</string>

    <key>StandardErrorPath</key>
    <string>${escapeXml(err)}</string>
</dict>
</plist>
`;
}

function escapeXml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function launchctlList(label: string): { running: boolean; pid?: number } {
  const out = spawnSync("launchctl", ["list", label], { encoding: "utf-8" });
  if (out.status !== 0) return { running: false };
  // launchctl list <label> prints: PID Status Label
  const lines = out.stdout.trim().split("\n");
  for (const line of lines) {
    // Plist format output: "PID" = 12345;
    const m = line.match(/"PID"\s*=\s*(\d+);/);
    if (m) return { running: true, pid: Number.parseInt(m[1], 10) };
  }
  return { running: true };
}

const launchdDriver: Driver = {
  name: "launchd",
  start(p) {
    const plistPath = launchdPlistPath(p);
    const dir = join(homedir(), "Library", "LaunchAgents");
    if (!existsSync(dir)) mkdirSync(dir, { recursive: true });

    const existing = launchctlList(launchdLabel(p));
    if (existing.running && existing.pid) {
      console.error(`${p} daemon is already running (PID ${existing.pid}).`);
      console.error(`Stop it first with: sportsclaw stop ${p}`);
      process.exit(1);
    }

    writeFileSync(plistPath, launchdRenderPlist(p), "utf-8");
    // load is the legacy command but works across all macOS versions we target.
    spawnSync("launchctl", ["load", plistPath], { stdio: "inherit" });

    console.log(`${p} daemon started via launchd.`);
    console.log(`  Status: sportsclaw status`);
    console.log(`  Logs:   sportsclaw logs ${p}`);
    console.log(`  Stop:   sportsclaw stop ${p}`);
  },
  stop(p) {
    const plistPath = launchdPlistPath(p);
    if (!existsSync(plistPath)) {
      console.error(`${p} daemon is not installed.`);
      process.exit(1);
    }
    spawnSync("launchctl", ["unload", plistPath], { stdio: "inherit" });
    console.log(`${p} daemon stopped.`);
  },
  status() {
    let any = false;
    console.log("Daemon Status:");
    console.log("");
    for (const p of VALID_PLATFORMS) {
      const plistPath = launchdPlistPath(p);
      if (!existsSync(plistPath)) continue;
      any = true;
      const info = launchctlList(launchdLabel(p));
      const online = info.running && info.pid;
      const icon = online ? "\x1b[32m●\x1b[0m" : "\x1b[2m○\x1b[0m";
      const label = online ? `online (PID ${info.pid})` : "stopped";
      console.log(`  ${icon} ${p.padEnd(12)} ${label}`);
    }
    if (!any) {
      console.log("No daemons installed.");
      console.log("");
      console.log("Start one with: sportsclaw start <discord|telegram|watch>");
      return;
    }
    console.log("");
    console.log(`Logs: ${logsDir()}`);
  },
  logs(p, lines) {
    const { out, err } = logPaths(p);
    if (!existsSync(out) && !existsSync(err)) {
      console.error(`No logs found for ${p}. Is the daemon running?`);
      console.error(`Start it with: sportsclaw start ${p}`);
      process.exit(1);
    }
    if (existsSync(out)) {
      console.log(`=== ${out} ===`);
      console.log(tailFile(out, lines));
    }
    if (existsSync(err) && statSync(err).size > 0) {
      console.log(`\n=== ${err} ===`);
      console.log(tailFile(err, lines));
    }
  },
  restart(p) {
    const plistPath = launchdPlistPath(p);
    if (!existsSync(plistPath)) {
      console.log(`${p} daemon is not currently installed. Starting fresh...`);
      this.start(p);
      return;
    }
    // kickstart -k restarts cleanly, surviving even a hung process.
    // process.getuid() is always defined on macOS (POSIX); the optional-call
    // syntax exists only because Node types it as conditional for Windows.
    const uid = typeof process.getuid === "function" ? process.getuid() : null;
    const r =
      uid !== null
        ? spawnSync(
            "launchctl",
            ["kickstart", "-k", `gui/${uid}/${launchdLabel(p)}`],
            { stdio: "inherit" }
          )
        : { status: 1 };
    if (r.status !== 0) {
      // Fall back to unload + load (always works; just slower).
      spawnSync("launchctl", ["unload", plistPath], { stdio: "inherit" });
      spawnSync("launchctl", ["load", plistPath], { stdio: "inherit" });
    }
    console.log(`Restarted ${p} daemon.`);
  },
};

// ---------------------------------------------------------------------------
// Linux — systemd user units
// ---------------------------------------------------------------------------

function systemdUnitName(p: DaemonPlatform): string {
  return `sportsclaw-${p}.service`;
}

function systemdUnitPath(p: DaemonPlatform): string {
  return join(homedir(), ".config", "systemd", "user", systemdUnitName(p));
}

function systemdRenderUnit(p: DaemonPlatform): string {
  const { out, err } = logPaths(p);
  const args = [nodeBin(), entryPoint(), ...scriptArgsFor(p)];
  const execStart = args.map(quoteIfNeeded).join(" ");
  return `[Unit]
Description=sportsclaw ${p} listener
After=network-online.target
Wants=network-online.target

[Service]
Type=simple
WorkingDirectory=${homedir()}
ExecStart=${execStart}
Restart=on-failure
RestartSec=10
# StandardOutput append: requires systemd 240+ (released 2018-12); ubiquitous now.
StandardOutput=append:${out}
StandardError=append:${err}
Environment=PATH=/usr/local/bin:/usr/bin:/bin:/usr/sbin:/sbin

[Install]
WantedBy=default.target
`;
}

function quoteIfNeeded(s: string): string {
  return /\s/.test(s) ? `"${s.replace(/"/g, '\\"')}"` : s;
}

function systemctlUser(args: string[]): { ok: boolean; stdout: string; stderr: string } {
  const r = spawnSync("systemctl", ["--user", ...args], { encoding: "utf-8" });
  return {
    ok: r.status === 0,
    stdout: r.stdout?.trim() ?? "",
    stderr: r.stderr?.trim() ?? "",
  };
}

const systemdDriver: Driver = {
  name: "systemd",
  start(p) {
    const unitPath = systemdUnitPath(p);
    const dir = join(homedir(), ".config", "systemd", "user");
    if (!existsSync(dir)) mkdirSync(dir, { recursive: true });

    // Already running?
    const active = systemctlUser(["is-active", systemdUnitName(p)]);
    if (active.stdout === "active") {
      console.error(`${p} daemon is already running.`);
      console.error(`Stop it first with: sportsclaw stop ${p}`);
      process.exit(1);
    }

    writeFileSync(unitPath, systemdRenderUnit(p), "utf-8");
    const reload = systemctlUser(["daemon-reload"]);
    if (!reload.ok) {
      console.error(`systemctl --user daemon-reload failed: ${reload.stderr}`);
      process.exit(1);
    }
    const enable = systemctlUser(["enable", "--now", systemdUnitName(p)]);
    if (!enable.ok) {
      console.error(`systemctl --user enable --now ${systemdUnitName(p)} failed:`);
      console.error(enable.stderr);
      process.exit(1);
    }

    console.log(`${p} daemon started via systemd (--user).`);
    console.log(`  Status: sportsclaw status`);
    console.log(`  Logs:   sportsclaw logs ${p}`);
    console.log(`  Stop:   sportsclaw stop ${p}`);
    console.log(`  Note: enable lingering with \`loginctl enable-linger\` if you want this to`);
    console.log(`        survive logout. Otherwise it stops when you log out.`);
  },
  stop(p) {
    const unitPath = systemdUnitPath(p);
    if (!existsSync(unitPath)) {
      console.error(`${p} daemon is not installed.`);
      process.exit(1);
    }
    systemctlUser(["disable", "--now", systemdUnitName(p)]);
    console.log(`${p} daemon stopped.`);
  },
  status() {
    let any = false;
    console.log("Daemon Status:");
    console.log("");
    for (const p of VALID_PLATFORMS) {
      const unitPath = systemdUnitPath(p);
      if (!existsSync(unitPath)) continue;
      any = true;
      const active = systemctlUser(["is-active", systemdUnitName(p)]);
      const online = active.stdout === "active";
      const icon = online ? "\x1b[32m●\x1b[0m" : "\x1b[2m○\x1b[0m";
      const label = online ? "online" : active.stdout || "inactive";
      console.log(`  ${icon} ${p.padEnd(12)} ${label}`);
    }
    if (!any) {
      console.log("No daemons installed.");
      console.log("");
      console.log("Start one with: sportsclaw start <discord|telegram|watch>");
      return;
    }
    console.log("");
    console.log(`Logs: ${logsDir()}`);
  },
  logs(p, lines) {
    const { out, err } = logPaths(p);
    if (existsSync(out) || existsSync(err)) {
      if (existsSync(out)) {
        console.log(`=== ${out} ===`);
        console.log(tailFile(out, lines));
      }
      if (existsSync(err) && statSync(err).size > 0) {
        console.log(`\n=== ${err} ===`);
        console.log(tailFile(err, lines));
      }
      return;
    }
    // Fall back to journalctl for older systemd setups that didn't take StandardOutput=append.
    const r = systemctlUser([
      "status",
      "--no-pager",
      "-n",
      String(lines),
      systemdUnitName(p),
    ]);
    console.log(r.stdout || r.stderr);
  },
  restart(p) {
    const unitPath = systemdUnitPath(p);
    if (!existsSync(unitPath)) {
      console.log(`${p} daemon is not currently installed. Starting fresh...`);
      this.start(p);
      return;
    }
    const r = systemctlUser(["restart", systemdUnitName(p)]);
    if (!r.ok) {
      console.error(`systemctl --user restart failed: ${r.stderr}`);
      process.exit(1);
    }
    console.log(`Restarted ${p} daemon.`);
  },
};

// ---------------------------------------------------------------------------
// Windows — Task Scheduler + .cmd respawn wrapper
// ---------------------------------------------------------------------------

function windowsTaskName(p: DaemonPlatform): string {
  return `sportsclaw-${p}`;
}

function windowsWrapperPath(p: DaemonPlatform): string {
  return join(homedir(), ".sportsclaw", "scripts", `sportsclaw-${p}.cmd`);
}

/**
 * Render a Windows .cmd that respawns the listener forever with a 10s back-off.
 * Logs append to the same files used on macOS/Linux.
 */
function windowsRenderWrapper(p: DaemonPlatform): string {
  const { out, err } = logPaths(p);
  const args = [`"${nodeBin()}"`, `"${entryPoint()}"`, ...scriptArgsFor(p)].join(" ");
  return `@echo off
REM sportsclaw ${p} listener — respawn loop
:loop
${args} 1>>"${out}" 2>>"${err}"
timeout /t 10 /nobreak >nul
goto loop
`;
}

function schtasks(args: string[]): { ok: boolean; stdout: string; stderr: string } {
  const r = spawnSync("schtasks.exe", args, { encoding: "utf-8" });
  return {
    ok: r.status === 0,
    stdout: r.stdout?.trim() ?? "",
    stderr: r.stderr?.trim() ?? "",
  };
}

function windowsTaskExists(name: string): boolean {
  return schtasks(["/Query", "/TN", name]).ok;
}

function windowsTaskRunning(name: string): boolean {
  const r = schtasks(["/Query", "/TN", name, "/FO", "CSV", "/NH", "/V"]);
  if (!r.ok) return false;
  // Status column appears as "Running" or "Ready"; CSV-quoted.
  return /"Running"/i.test(r.stdout);
}

const windowsDriver: Driver = {
  name: "schtasks",
  start(p) {
    const taskName = windowsTaskName(p);
    if (windowsTaskRunning(taskName)) {
      console.error(`${p} daemon is already running.`);
      console.error(`Stop it first with: sportsclaw stop ${p}`);
      process.exit(1);
    }

    // Write/refresh the wrapper script
    const wrapperPath = windowsWrapperPath(p);
    const wrapperDir = join(homedir(), ".sportsclaw", "scripts");
    if (!existsSync(wrapperDir)) mkdirSync(wrapperDir, { recursive: true });
    writeFileSync(wrapperPath, windowsRenderWrapper(p), "utf-8");

    // Create-or-replace the scheduled task — runs at logon, kills on logoff.
    const create = schtasks([
      "/Create",
      "/F",
      "/TN",
      taskName,
      "/TR",
      `cmd.exe /c "${wrapperPath}"`,
      "/SC",
      "ONLOGON",
      "/RL",
      "LIMITED",
    ]);
    if (!create.ok) {
      console.error(`schtasks /Create failed: ${create.stderr || create.stdout}`);
      process.exit(1);
    }
    // Run it now (without waiting for next logon).
    schtasks(["/Run", "/TN", taskName]);

    console.log(`${p} daemon started via Task Scheduler.`);
    console.log(`  Status: sportsclaw status`);
    console.log(`  Logs:   sportsclaw logs ${p}`);
    console.log(`  Stop:   sportsclaw stop ${p}`);
  },
  stop(p) {
    const taskName = windowsTaskName(p);
    if (!windowsTaskExists(taskName)) {
      console.error(`${p} daemon is not installed.`);
      process.exit(1);
    }
    schtasks(["/End", "/TN", taskName]);
    schtasks(["/Delete", "/TN", taskName, "/F"]);
    console.log(`${p} daemon stopped.`);
  },
  status() {
    let any = false;
    console.log("Daemon Status:");
    console.log("");
    for (const p of VALID_PLATFORMS) {
      const taskName = windowsTaskName(p);
      if (!windowsTaskExists(taskName)) continue;
      any = true;
      const online = windowsTaskRunning(taskName);
      const icon = online ? "\x1b[32m●\x1b[0m" : "\x1b[2m○\x1b[0m";
      console.log(`  ${icon} ${p.padEnd(12)} ${online ? "online" : "stopped"}`);
    }
    if (!any) {
      console.log("No daemons installed.");
      console.log("");
      console.log("Start one with: sportsclaw start <discord|telegram|watch>");
      return;
    }
    console.log("");
    console.log(`Logs: ${logsDir()}`);
  },
  logs(p, lines) {
    const { out, err } = logPaths(p);
    if (!existsSync(out) && !existsSync(err)) {
      console.error(`No logs found for ${p}. Is the daemon running?`);
      console.error(`Start it with: sportsclaw start ${p}`);
      process.exit(1);
    }
    if (existsSync(out)) {
      console.log(`=== ${out} ===`);
      console.log(tailFile(out, lines));
    }
    if (existsSync(err) && statSync(err).size > 0) {
      console.log(`\n=== ${err} ===`);
      console.log(tailFile(err, lines));
    }
  },
  restart(p) {
    const taskName = windowsTaskName(p);
    if (!windowsTaskExists(taskName)) {
      console.log(`${p} daemon is not currently installed. Starting fresh...`);
      this.start(p);
      return;
    }
    schtasks(["/End", "/TN", taskName]);
    schtasks(["/Run", "/TN", taskName]);
    console.log(`Restarted ${p} daemon.`);
  },
};

// ---------------------------------------------------------------------------
// Suppress "unused" warnings for utility imports kept for future drivers.
// ---------------------------------------------------------------------------

void execSync;
void execFileSync;
void readFileSync;
