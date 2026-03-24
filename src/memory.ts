/**
 * sportsclaw — Persistent Memory with Pluggable Storage
 *
 * A 6-file memory system, each with a single purpose:
 *
 *   CONTEXT.md       — HOT:  ephemeral state snapshot (overwritten on context shifts)
 *   SOUL.md          — WARM: agent personality & relationship with this user (evolves)
 *   FAN_PROFILE.md   — WARM: interest graph — teams, leagues, sports (read-merge-write)
 *   REFLECTIONS.md   — WARM: append-only lessons learned from tool failures & discoveries
 *   STRATEGY.md      — WARM: self-authored behavioral directives (injected into system prompt)
 *   <date>.md        — WARM/COLD: append-only conversation archive
 *
 * Storage backends:
 *   FileMemoryStorage — local ~/.sportsclaw/memory/<userId>/ (default, open-source CLI)
 *   PodMemoryStorage  — Machina MCP pod documents (multi-tenant relay deployments)
 *
 * Backend is selected once at MemoryManager construction — no hybrid, no sync.
 */

import { mkdir, readFile, writeFile, appendFile, readdir } from "node:fs/promises";
import { join } from "node:path";
import { homedir } from "node:os";
import type { McpManager } from "./mcp.js";

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const MEMORY_BASE =
  process.env.sportsclaw_MEMORY_DIR ||
  join(homedir(), ".sportsclaw", "memory");

const CONTEXT_FILE = "CONTEXT.md";
const SOUL_FILE = "SOUL.md";
const FAN_PROFILE_FILE = "FAN_PROFILE.md";
const REFLECTIONS_FILE = "REFLECTIONS.md";
const STRATEGY_FILE = "STRATEGY.md";
const THREAD_FILE = "thread.json";
const CONSOLIDATED_FILE = "CONSOLIDATED.md";

/** Maximum thread messages kept on disk (20 user/assistant pairs) */
const MAX_THREAD_MESSAGES = 40;

/** Maximum tail lines injected from today's log into the memory block */
const MAX_LOG_LINES = 100;

/** Maximum tail lines injected from consolidated memory into the memory block */
const MAX_CONSOLIDATED_LINES = 80;

/** Marker that starts each conversation entry in the daily log */
const ENTRY_SEPARATOR = "---";

/** Default age threshold for consolidation: logs older than 3 days */
const DEFAULT_CONSOLIDATION_AGE_DAYS = 3;

/** Maximum characters of old logs to send for consolidation in one batch */
const MAX_CONSOLIDATION_INPUT_CHARS = 50_000;

// ---------------------------------------------------------------------------
// Soul types (only exchange counter is tracked by code — rest is LLM-driven)
// ---------------------------------------------------------------------------

interface SoulData {
  born: string;
  exchanges: number;
  rest: string; // everything after the header, written freely by the LLM
}

export interface ThreadMessage {
  role: "user" | "assistant";
  content: string;
  ts: string;
}

// ---------------------------------------------------------------------------
// Storage Interface
// ---------------------------------------------------------------------------

export interface MemoryStorage {
  read(userId: string, file: string): Promise<string>;
  write(userId: string, file: string, content: string): Promise<void>;
  append(userId: string, file: string, content: string): Promise<void>;
  list(userId: string, pattern: string): Promise<string[]>;
  remove(userId: string, file: string): Promise<void>;
}

// ---------------------------------------------------------------------------
// FileMemoryStorage — local filesystem (default)
// ---------------------------------------------------------------------------

/**
 * Read a file, returning empty string if it doesn't exist.
 * Only swallows ENOENT — all other errors propagate.
 */
async function safeRead(path: string): Promise<string> {
  try {
    return await readFile(path, "utf-8");
  } catch (err: unknown) {
    if (err instanceof Error && "code" in err && (err as NodeJS.ErrnoException).code === "ENOENT") {
      return "";
    }
    throw err;
  }
}

/**
 * Sanitize a user/thread ID for safe use as a directory name.
 * Uses a hash suffix when characters are replaced to reduce collision risk.
 */
function sanitizeId(id: string): string {
  const safe = id.replace(/[^a-zA-Z0-9_-]/g, "_").slice(0, 128);
  if (safe !== id) {
    let hash = 0;
    for (let i = 0; i < id.length; i++) {
      hash = ((hash << 5) - hash + id.charCodeAt(i)) | 0;
    }
    const suffix = Math.abs(hash).toString(36).slice(0, 6);
    return `${safe.slice(0, 121)}_${suffix}`;
  }
  return safe;
}

class FileMemoryStorage implements MemoryStorage {
  private base: string;
  private dirCache = new Set<string>();

  constructor(base: string) {
    this.base = base;
  }

  private userDir(userId: string): string {
    return join(this.base, sanitizeId(userId));
  }

  private async ensureDir(userId: string): Promise<string> {
    const dir = this.userDir(userId);
    if (!this.dirCache.has(dir)) {
      await mkdir(dir, { recursive: true });
      this.dirCache.add(dir);
    }
    return dir;
  }

  async read(userId: string, file: string): Promise<string> {
    const dir = await this.ensureDir(userId);
    return safeRead(join(dir, file));
  }

  async write(userId: string, file: string, content: string): Promise<void> {
    const dir = await this.ensureDir(userId);
    await writeFile(join(dir, file), content, "utf-8");
  }

  async append(userId: string, file: string, content: string): Promise<void> {
    const dir = await this.ensureDir(userId);
    await appendFile(join(dir, file), content, "utf-8");
  }

  async list(userId: string, _pattern: string): Promise<string[]> {
    const dir = await this.ensureDir(userId);
    try {
      const files = await readdir(dir);
      return files
        .filter((f) => /^\d{4}-\d{2}-\d{2}\.md$/.test(f))
        .sort();
    } catch {
      return [];
    }
  }

  async remove(userId: string, file: string): Promise<void> {
    const dir = this.userDir(userId);
    const { unlink } = await import("node:fs/promises");
    try {
      await unlink(join(dir, file));
    } catch {
      // Skip files that can't be deleted
    }
  }

  /** Absolute path to a user's memory directory */
  getUserDir(userId: string): string {
    return this.userDir(userId);
  }
}

// ---------------------------------------------------------------------------
// PodMemoryStorage — Machina MCP pod documents
// ---------------------------------------------------------------------------

/** Map memory filenames to document metadata types */
const FILE_TYPE_MAP: Record<string, string> = {
  SOUL: "soul",
  FAN_PROFILE: "fan-profile",
  CONTEXT: "context",
  REFLECTIONS: "reflections",
  STRATEGY: "strategy",
  CONSOLIDATED: "consolidated",
  thread: "thread",
};

function parseMemoryFile(file: string): { memoryType: string; date?: string } {
  const name = file.replace(/\.(md|json)$/, "");
  const dateMatch = name.match(/^(\d{4}-\d{2}-\d{2})$/);
  if (dateMatch) return { memoryType: "daily-log", date: dateMatch[1] };
  return { memoryType: FILE_TYPE_MAP[name] ?? name.toLowerCase() };
}

export class PodMemoryStorage implements MemoryStorage {
  constructor(private mcpManager: McpManager, private serverName: string) {}

  /** Deterministic document name for a user's memory file. */
  private docName(userId: string, file: string): string {
    const { memoryType, date } = parseMemoryFile(file);
    return date
      ? `memory-${userId}-daily-${date}`
      : `memory-${userId}-${memoryType}`;
  }

  async read(userId: string, file: string): Promise<string> {
    try {
      const result = await this.callPod("search_documents", {
        filters: { name: this.docName(userId, file) },
        fields: ["_id", "content", "text"],
        page_size: 1,
      });

      // Handle both nested (new) and flat (old) document layouts
      const doc = result?.data?.[0];
      return doc?.value?.text ?? doc?.content?.text ?? doc?.text ?? "";
    } catch {
      return "";
    }
  }

  async write(userId: string, file: string, content: string): Promise<void> {
    try {
      const { memoryType, date } = parseMemoryFile(file);
      const name = this.docName(userId, file);

      const metadata: Record<string, unknown> = {
        type: "user-memory",
        user_id: userId,
        memory_type: memoryType,
      };
      if (date) metadata.date = date;

      // Upsert: search by deterministic name (not metadata) to avoid
      // race-condition duplicates when concurrent processes write.
      const existing = await this.callPod("search_documents", {
        filters: { name },
        fields: ["_id"],
        page_size: 1,
      });

      if (existing?.data?.[0]) {
        await this.callPod("update_document", {
          item_id: existing.data[0]._id,
          content: { value: { text: content } },
        });
      } else {
        await this.callPod("create_document", { name, content: { value: { text: content } }, metadata });
      }
    } catch {
      // Non-fatal: memory write failure shouldn't break the query
    }
  }

  async append(userId: string, file: string, content: string): Promise<void> {
    const existing = await this.read(userId, file);
    await this.write(userId, file, existing ? `${existing}\n${content}` : content);
  }

  async list(userId: string, _pattern: string): Promise<string[]> {
    try {
      const result = await this.callPod("search_documents", {
        filters: {
          "metadata.type": "user-memory",
          "metadata.user_id": userId,
          "metadata.memory_type": "daily-log",
        },
        fields: ["metadata.date"],
        sorters: [["metadata.date", 1]],
      });
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      return (result?.data ?? []).map((d: any) => `${d.metadata.date}.md`);
    } catch {
      return [];
    }
  }

  async remove(userId: string, file: string): Promise<void> {
    try {
      const existing = await this.callPod("search_documents", {
        filters: { name: this.docName(userId, file) },
        fields: ["_id"],
        page_size: 1,
      });
      if (existing?.data?.[0]) {
        await this.callPod("delete_document", { item_id: existing.data[0]._id });
      }
    } catch {
      // Non-fatal
    }
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  private async callPod(toolName: string, args: Record<string, unknown>): Promise<any> {
    const result = await this.mcpManager.callToolDirect(this.serverName, toolName, args);
    if (result.isError) return {};
    try {
      return JSON.parse(result.content || "{}");
    } catch {
      return {};
    }
  }
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Get today's date as YYYY-MM-DD */
function todayStamp(): string {
  const d = new Date();
  return d.toISOString().slice(0, 10);
}

/** Format a timestamp for log entries */
function timestamp(): string {
  return new Date().toISOString().replace("T", " ").slice(0, 19);
}

// ---------------------------------------------------------------------------
// MemoryManager
// ---------------------------------------------------------------------------

export class MemoryManager {
  private storage: MemoryStorage;
  private userId: string;

  constructor(userId: string, storage?: MemoryStorage) {
    this.userId = userId;
    this.storage = storage ?? new FileMemoryStorage(MEMORY_BASE);
  }

  /** Absolute path to the user's memory directory (only meaningful for file storage) */
  get memoryDir(): string {
    if (this.storage instanceof FileMemoryStorage) {
      return this.storage.getUserDir(this.userId);
    }
    return join(MEMORY_BASE, sanitizeId(this.userId));
  }

  // -------------------------------------------------------------------------
  // HOT layer — CONTEXT.md
  // -------------------------------------------------------------------------

  async readContext(): Promise<string> {
    return this.storage.read(this.userId, CONTEXT_FILE);
  }

  async writeContext(content: string): Promise<void> {
    await this.storage.write(this.userId, CONTEXT_FILE, content);
  }

  // -------------------------------------------------------------------------
  // WARM layer — <date>.md
  // -------------------------------------------------------------------------

  async readTodayLog(): Promise<string> {
    return this.storage.read(this.userId, `${todayStamp()}.md`);
  }

  async appendExchange(userPrompt: string, assistantReply: string): Promise<void> {
    const ts = timestamp();
    const entry = [
      `## [${ts}]`,
      "",
      `**User:** ${userPrompt}`,
      "",
      `**Assistant:** ${assistantReply}`,
      "",
      ENTRY_SEPARATOR,
      "",
    ].join("\n");

    await this.storage.append(this.userId, `${todayStamp()}.md`, entry);
  }

  async appendNote(label: string, content: string): Promise<void> {
    const ts = timestamp();
    const entry = [`> **${label}** (${ts}): ${content}`, ""].join("\n");
    await this.storage.append(this.userId, `${todayStamp()}.md`, entry);
  }

  // -------------------------------------------------------------------------
  // WARM layer — SOUL.md (agent personality & relationship)
  // -------------------------------------------------------------------------

  async readSoul(): Promise<string> {
    return this.storage.read(this.userId, SOUL_FILE);
  }

  async writeSoul(content: string): Promise<void> {
    await this.storage.write(this.userId, SOUL_FILE, content);
  }

  parseSoulHeader(raw: string): SoulData {
    const data: SoulData = { born: new Date().toISOString(), exchanges: 0, rest: "" };
    if (!raw.trim()) return data;

    const lines = raw.split("\n");
    const restLines: string[] = [];
    let pastHeader = false;

    for (const line of lines) {
      const trimmed = line.trim();
      if (trimmed.startsWith("Born:")) {
        data.born = trimmed.replace("Born:", "").trim();
      } else if (trimmed.startsWith("Exchanges:")) {
        data.exchanges = parseInt(trimmed.replace("Exchanges:", "").trim(), 10) || 0;
      } else if (trimmed.startsWith("## ") || pastHeader) {
        pastHeader = true;
        restLines.push(line);
      }
    }

    data.rest = restLines.join("\n");
    return data;
  }

  async incrementSoulExchanges(): Promise<void> {
    const raw = await this.readSoul();
    const data = this.parseSoulHeader(raw);
    data.exchanges++;

    const header = `# Soul\nBorn: ${data.born}\nExchanges: ${data.exchanges}\n`;
    const content = data.rest ? `${header}\n${data.rest}\n` : header;
    await this.storage.write(this.userId, SOUL_FILE, content);
  }

  // -------------------------------------------------------------------------
  // WARM layer — FAN_PROFILE.md
  // -------------------------------------------------------------------------

  async readFanProfile(): Promise<string> {
    return this.storage.read(this.userId, FAN_PROFILE_FILE);
  }

  async writeFanProfile(content: string): Promise<void> {
    await this.storage.write(this.userId, FAN_PROFILE_FILE, content);
  }

  // -------------------------------------------------------------------------
  // WARM layer — REFLECTIONS.md (append-only lessons learned)
  // -------------------------------------------------------------------------

  async readReflections(): Promise<string> {
    return this.storage.read(this.userId, REFLECTIONS_FILE);
  }

  async appendReflection(entry: string): Promise<void> {
    await this.storage.append(this.userId, REFLECTIONS_FILE, entry + "\n");
  }

  // -------------------------------------------------------------------------
  // WARM layer — STRATEGY.md (self-authored behavioral directives)
  // -------------------------------------------------------------------------

  async readStrategy(): Promise<string> {
    return this.storage.read(this.userId, STRATEGY_FILE);
  }

  async writeStrategy(content: string): Promise<void> {
    await this.storage.write(this.userId, STRATEGY_FILE, content);
  }

  // -------------------------------------------------------------------------
  // Thread persistence — conversation history across process restarts
  // -------------------------------------------------------------------------

  async readThread(): Promise<ThreadMessage[]> {
    const raw = await this.storage.read(this.userId, THREAD_FILE);
    if (!raw) return [];
    try {
      return JSON.parse(raw);
    } catch {
      return [];
    }
  }

  async writeThread(messages: ThreadMessage[]): Promise<void> {
    const capped = messages.slice(-MAX_THREAD_MESSAGES);
    await this.storage.write(this.userId, THREAD_FILE, JSON.stringify(capped));
  }

  async appendToThread(userPrompt: string, assistantReply: string): Promise<void> {
    const thread = await this.readThread();
    const ts = new Date().toISOString();
    thread.push(
      { role: "user", content: userPrompt, ts },
      { role: "assistant", content: assistantReply, ts },
    );
    await this.writeThread(thread);
  }

  // -------------------------------------------------------------------------
  // CONSOLIDATED.md — compressed knowledge from old daily logs
  // -------------------------------------------------------------------------

  async readConsolidated(): Promise<string> {
    return this.storage.read(this.userId, CONSOLIDATED_FILE);
  }

  async writeConsolidated(content: string): Promise<void> {
    await this.storage.write(this.userId, CONSOLIDATED_FILE, content);
  }

  async listDailyLogs(): Promise<string[]> {
    return this.storage.list(this.userId, "daily-log");
  }

  async getConsolidationCandidates(
    ageDays: number = DEFAULT_CONSOLIDATION_AGE_DAYS
  ): Promise<{ files: string[]; content: string; totalChars: number }> {
    const allLogs = await this.listDailyLogs();
    const today = todayStamp();
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - ageDays);
    const cutoffStamp = cutoffDate.toISOString().slice(0, 10);

    const eligibleFiles: string[] = [];
    const contents: string[] = [];
    let totalChars = 0;

    for (const file of allLogs) {
      const dateStr = file.replace(".md", "");
      if (dateStr >= cutoffStamp || dateStr === today) continue;

      const content = await this.storage.read(this.userId, file);
      if (!content.trim()) continue;

      if (totalChars + content.length > MAX_CONSOLIDATION_INPUT_CHARS) break;

      eligibleFiles.push(file);
      contents.push(`## ${dateStr}\n\n${content}`);
      totalChars += content.length;
    }

    return {
      files: eligibleFiles,
      content: contents.join("\n\n---\n\n"),
      totalChars,
    };
  }

  async consolidateOldLogs(
    summarize: (content: string, existingSummary: string) => Promise<string>,
    ageDays: number = DEFAULT_CONSOLIDATION_AGE_DAYS
  ): Promise<number> {
    const candidates = await this.getConsolidationCandidates(ageDays);
    if (candidates.files.length === 0) return 0;

    const existing = await this.readConsolidated();
    const summary = await summarize(candidates.content, existing);
    if (!summary.trim()) return 0;

    await this.writeConsolidated(summary);

    for (const file of candidates.files) {
      await this.storage.remove(this.userId, file);
    }

    return candidates.files.length;
  }

  // -------------------------------------------------------------------------
  // Combined read for prompt injection-safe context assembly
  // -------------------------------------------------------------------------

  async buildMemoryBlock(): Promise<string> {
    const [context, todayLog, fanProfile, soul, reflections, consolidated] = await Promise.all([
      this.readContext(),
      this.readTodayLog(),
      this.readFanProfile(),
      this.readSoul(),
      this.readReflections(),
      this.readConsolidated(),
    ]);

    if (!context && !todayLog && !fanProfile && !soul && !reflections && !consolidated) return "";

    const parts: string[] = [
      "## Persistent Memory",
      `User ID: ${this.userId}`,
    ];

    if (soul) {
      parts.push("", "### Soul (SOUL.md)", soul);
    }

    if (fanProfile) {
      parts.push("", "### Fan Profile (FAN_PROFILE.md)", fanProfile);
    }

    if (context) {
      parts.push("", "### Current Context (CONTEXT.md)", context);
    }

    if (consolidated) {
      const tail = truncateAtEntryBoundary(consolidated, MAX_CONSOLIDATED_LINES);
      parts.push("", "### Consolidated Knowledge (older conversations)", tail);
    }

    if (reflections) {
      const tail = truncateAtEntryBoundary(reflections, 60);
      parts.push("", "### Reflections (REFLECTIONS.md)", tail);
    }

    if (todayLog) {
      const tail = truncateAtEntryBoundary(todayLog, MAX_LOG_LINES);
      parts.push("", "### Today's Conversation Log", tail);
    }

    return parts.join("\n");
  }
}

// ---------------------------------------------------------------------------
// Utilities
// ---------------------------------------------------------------------------

/**
 * Truncate a log to approximately `maxLines` lines, but always cut at an
 * entry boundary (the "---" separator) to avoid splitting a conversation
 * entry in half.
 */
function truncateAtEntryBoundary(log: string, maxLines: number): string {
  const lines = log.split("\n");
  if (lines.length <= maxLines) return log;

  const cutStart = lines.length - maxLines;
  let adjustedStart = cutStart;
  for (let i = cutStart; i < lines.length; i++) {
    if (lines[i].trim() === ENTRY_SEPARATOR) {
      adjustedStart = i + 1;
      break;
    }
  }

  return lines.slice(adjustedStart).join("\n");
}

/** Get the base memory directory (useful for CLI / diagnostics) */
export function getMemoryDir(): string {
  return MEMORY_BASE;
}
