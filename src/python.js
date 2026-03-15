"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.MIN_PYTHON_VERSION = void 0;
exports.buildSportsSkillsRepairCommand = buildSportsSkillsRepairCommand;
exports.checkPythonVersion = checkPythonVersion;
exports.detectHomebrew = detectHomebrew;
exports.findBestPython = findBestPython;
exports.detectPlatformPackageManager = detectPlatformPackageManager;
exports.installHomebrew = installHomebrew;
exports.installPythonViaPackageManager = installPythonViaPackageManager;
exports.checkPrerequisites = checkPrerequisites;
exports.getVenvDir = getVenvDir;
exports.getVenvPythonPath = getVenvPythonPath;
exports.isVenvSetup = isVenvSetup;
exports.ensureVenv = ensureVenv;
var node_child_process_1 = require("node:child_process");
var node_fs_1 = require("node:fs");
var node_os_1 = require("node:os");
var node_path_1 = require("node:path");
// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------
exports.MIN_PYTHON_VERSION = { major: 3, minor: 10 };
// ---------------------------------------------------------------------------
// Shell quoting helper (existing)
// ---------------------------------------------------------------------------
function shellQuote(value) {
    if (/^[a-zA-Z0-9_./:-]+$/.test(value)) {
        return value;
    }
    return "\"".concat(value.replace(/"/g, '\\"'), "\"");
}
function buildSportsSkillsRepairCommand(pythonPath, userInstall) {
    if (userInstall === void 0) { userInstall = false; }
    var userFlag = userInstall ? " --user" : "";
    return "".concat(shellQuote(pythonPath), " -m pip install --upgrade").concat(userFlag, " sports-skills");
}
// ---------------------------------------------------------------------------
// Python version check
// ---------------------------------------------------------------------------
/**
 * Run the given Python interpreter and check its version.
 * Returns `ok: true` only when >= MIN_PYTHON_VERSION.
 */
function checkPythonVersion(pythonPath) {
    try {
        var output = (0, node_child_process_1.execFileSync)(pythonPath, ["-c", "import sys; v=sys.version_info; print(f'{v.major}.{v.minor}.{v.micro}')"], { timeout: 10000, encoding: "utf-8", stdio: ["pipe", "pipe", "pipe"] }).trim();
        var parts = output.split(".");
        if (parts.length < 3) {
            return { ok: false, version: output, major: 0, minor: 0, micro: 0, error: "Could not parse version" };
        }
        var major = Number.parseInt(parts[0], 10);
        var minor = Number.parseInt(parts[1], 10);
        var micro = Number.parseInt(parts[2], 10);
        var ok = major > exports.MIN_PYTHON_VERSION.major ||
            (major === exports.MIN_PYTHON_VERSION.major && minor >= exports.MIN_PYTHON_VERSION.minor);
        return { ok: ok, version: output, major: major, minor: minor, micro: micro };
    }
    catch (err) {
        return {
            ok: false,
            version: "",
            major: 0,
            minor: 0,
            micro: 0,
            error: err instanceof Error ? err.message : String(err),
        };
    }
}
// ---------------------------------------------------------------------------
// Homebrew detection (macOS)
// ---------------------------------------------------------------------------
function detectHomebrew() {
    if ((0, node_os_1.platform)() !== "darwin") {
        return { installed: false };
    }
    try {
        var output = (0, node_child_process_1.execFileSync)("which", ["brew"], {
            timeout: 5000,
            encoding: "utf-8",
            stdio: ["pipe", "pipe", "pipe"],
        }).trim();
        return { installed: true, path: output };
    }
    catch (_a) {
        // Also check common Homebrew paths directly
        for (var _i = 0, _b = ["/opt/homebrew/bin/brew", "/usr/local/bin/brew"]; _i < _b.length; _i++) {
            var p = _b[_i];
            if ((0, node_fs_1.existsSync)(p)) {
                return { installed: true, path: p };
            }
        }
        return { installed: false };
    }
}
// ---------------------------------------------------------------------------
// Find the best available Python >= 3.10
// ---------------------------------------------------------------------------
var PYTHON_CANDIDATES = [
    "/opt/homebrew/bin/python3",
    "/usr/local/bin/python3",
    "python3.13",
    "python3.12",
    "python3.11",
    "python3.10",
    "python3",
];
/**
 * Probe candidates in priority order.
 * Returns the first one that exists AND is >= 3.10, or `null`.
 */
function findBestPython() {
    for (var _i = 0, PYTHON_CANDIDATES_1 = PYTHON_CANDIDATES; _i < PYTHON_CANDIDATES_1.length; _i++) {
        var candidate = PYTHON_CANDIDATES_1[_i];
        var result = checkPythonVersion(candidate);
        if (result.ok) {
            return { path: candidate, version: result };
        }
    }
    return null;
}
function detectPlatformPackageManager() {
    var os = (0, node_os_1.platform)();
    if (os === "darwin") {
        var hb = detectHomebrew();
        return hb.installed ? "brew" : null;
    }
    // Linux: check common package managers
    var managers = [
        { bin: "apt-get", name: "apt" },
        { bin: "dnf", name: "dnf" },
        { bin: "pacman", name: "pacman" },
    ];
    for (var _i = 0, managers_1 = managers; _i < managers_1.length; _i++) {
        var _a = managers_1[_i], bin = _a.bin, name_1 = _a.name;
        try {
            (0, node_child_process_1.execFileSync)("which", [bin], {
                timeout: 5000,
                encoding: "utf-8",
                stdio: ["pipe", "pipe", "pipe"],
            });
            return name_1;
        }
        catch (_b) {
            // try next
        }
    }
    return null;
}
// ---------------------------------------------------------------------------
// Install helpers
// ---------------------------------------------------------------------------
/**
 * Install Homebrew using the official install script.
 * Returns `{ ok: true }` on success.
 */
function installHomebrew() {
    try {
        (0, node_child_process_1.execFileSync)("/bin/bash", ["-c", '$(curl -fsSL https://raw.githubusercontent.com/Homebrew/install/HEAD/install.sh)'], { timeout: 300000, stdio: "inherit" });
        return { ok: true };
    }
    catch (err) {
        return {
            ok: false,
            error: err instanceof Error ? err.message : String(err),
        };
    }
}
/**
 * Install Python via the detected platform package manager.
 */
function installPythonViaPackageManager(manager) {
    var commands = {
        brew: { bin: "brew", args: ["install", "python@3.12"] },
        apt: { bin: "sudo", args: ["apt-get", "install", "-y", "python3"] },
        dnf: { bin: "sudo", args: ["dnf", "install", "-y", "python3"] },
        pacman: { bin: "sudo", args: ["pacman", "-S", "--noconfirm", "python"] },
    };
    var cmd = commands[manager];
    try {
        (0, node_child_process_1.execFileSync)(cmd.bin, cmd.args, { timeout: 300000, stdio: "inherit" });
        return { ok: true };
    }
    catch (err) {
        return {
            ok: false,
            error: err instanceof Error ? err.message : String(err),
        };
    }
}
// ---------------------------------------------------------------------------
// Orchestrated prerequisite check
// ---------------------------------------------------------------------------
function checkPrerequisites() {
    var homebrew = detectHomebrew();
    var best = findBestPython();
    return {
        homebrew: homebrew,
        python: best
            ? { found: true, path: best.path, version: best.version.version }
            : { found: false },
        pythonVersion: best ? best.version : null,
    };
}
// ---------------------------------------------------------------------------
// Managed venv at ~/.sportsclaw/venv/
// ---------------------------------------------------------------------------
var VENV_DIR = (0, node_path_1.join)((0, node_os_1.homedir)(), ".sportsclaw", "venv");
function getVenvDir() {
    return VENV_DIR;
}
function getVenvPythonPath() {
    return (0, node_path_1.join)(VENV_DIR, "bin", "python3");
}
function isVenvSetup() {
    return (0, node_fs_1.existsSync)(getVenvPythonPath());
}
/** The pip install target — [all] pulls every sport's native deps (FastF1, py_clob_client, etc.) */
var PIP_INSTALL_TARGET = "sports-skills[all]";
/** Marker file that records the pip install target used when setting up the venv */
var EXTRAS_MARKER = (0, node_path_1.join)(VENV_DIR, ".sportsclaw-extras");
/**
 * Check if the venv was set up with the current PIP_INSTALL_TARGET.
 * Returns false if the marker is missing or doesn't match (needs upgrade).
 */
function hasCorrectExtras() {
    try {
        return (0, node_fs_1.readFileSync)(EXTRAS_MARKER, "utf-8").trim() === PIP_INSTALL_TARGET;
    }
    catch (_a) {
        return false;
    }
}
function writeExtrasMarker() {
    try {
        (0, node_fs_1.writeFileSync)(EXTRAS_MARKER, PIP_INSTALL_TARGET, "utf-8");
    }
    catch (_a) {
        // Non-fatal
    }
}
/**
 * Ensure a managed venv exists at ~/.sportsclaw/venv/.
 * If it already exists but was installed with a narrower target (e.g. bare
 * sports-skills or sports-skills[polymarket]), upgrades to sports-skills[all].
 * Otherwise creates one using the provided base Python (or auto-detected).
 */
function ensureVenv(basePythonPath) {
    var _a, _b;
    if (isVenvSetup()) {
        // Venv exists — check if extras need upgrading
        if (!hasCorrectExtras()) {
            console.error("[sportsclaw] Upgrading sports-skills dependencies...");
            try {
                (0, node_child_process_1.execFileSync)(getVenvPythonPath(), ["-m", "pip", "install", "--upgrade", PIP_INSTALL_TARGET], { timeout: 120000, stdio: ["pipe", "pipe", "pipe"] });
                writeExtrasMarker();
            }
            catch (_c) {
                // Non-fatal — tools will error at call time with a clear message
            }
        }
        return { ok: true, pythonPath: getVenvPythonPath() };
    }
    var systemPython = (_b = basePythonPath !== null && basePythonPath !== void 0 ? basePythonPath : (_a = findBestPython()) === null || _a === void 0 ? void 0 : _a.path) !== null && _b !== void 0 ? _b : "python3";
    try {
        // Ensure parent dir exists
        var parentDir = (0, node_path_1.join)((0, node_os_1.homedir)(), ".sportsclaw");
        if (!(0, node_fs_1.existsSync)(parentDir)) {
            (0, node_fs_1.mkdirSync)(parentDir, { recursive: true });
        }
        // Create venv
        console.error("[sportsclaw] Creating Python environment (~/.sportsclaw/venv/)...");
        (0, node_child_process_1.execFileSync)(systemPython, ["-m", "venv", VENV_DIR], {
            timeout: 30000,
            stdio: ["pipe", "pipe", "pipe"],
        });
        // Install/upgrade pip and sports-skills[all] into it
        console.error("[sportsclaw] Installing sports-skills — this may take a minute on first run...");
        (0, node_child_process_1.execFileSync)(getVenvPythonPath(), ["-m", "pip", "install", "--upgrade", "pip", PIP_INSTALL_TARGET], {
            timeout: 120000,
            stdio: ["pipe", "pipe", "pipe"],
        });
        console.error("[sportsclaw] Python environment ready.");
        writeExtrasMarker();
        return { ok: true, pythonPath: getVenvPythonPath(), created: true };
    }
    catch (err) {
        return {
            ok: false,
            pythonPath: systemPython,
            error: err instanceof Error ? err.message : String(err),
        };
    }
}
