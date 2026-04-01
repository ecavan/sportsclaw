/**
 * sportsclaw — Telegram Renderer
 *
 * Converts a ParsedResponse into an HTML string for Telegram's HTML parse mode.
 * Headers → <b>, tables → inline text (no <pre> codeblocks), code → <pre>,
 * bold → <b>, inline code → <code>.
 *
 * Tables are rendered as formatted text lines with mid-dot separators so they
 * flow naturally in Telegram without the monospace codeblock treatment.
 */

import {
  stripBold,
  isComparisonTable,
} from "./parser.js";
import type { ParsedResponse, ParsedBlock } from "./parser.js";

// ---------------------------------------------------------------------------
// renderTelegram
// ---------------------------------------------------------------------------

export function renderTelegram(parsed: ParsedResponse): string {
  const result: string[] = [];

  for (const block of parsed.blocks) {
    switch (block.type) {
      case "header":
        result.push(`\n<b>${escapeHtml(block.text)}</b>`);
        break;

      case "table": {
        result.push(renderTableAsText(block));
        break;
      }

      case "code":
        result.push(
          `<pre>${block.lines.map((l) => escapeHtml(l)).join("\n")}</pre>`
        );
        break;

      case "text":
        for (const line of block.lines) {
          let processed = escapeHtml(line);
          // **bold** → <b>bold</b>  (must come before single * italic)
          processed = processed.replace(/\*\*(.+?)\*\*/g, "<b>$1</b>");
          // `inline code` → <code>inline code</code>
          processed = processed.replace(/`([^`]+)`/g, "<code>$1</code>");
          // *italic* → <i>italic</i>  (after ** is already handled)
          processed = processed.replace(/\*(.+?)\*/g, "<i>$1</i>");
          // Bullet markers → clean bullets (- or leftover * at line start)
          processed = processed.replace(/^(\s*)[*\-]\s+/, "$1• ");
          result.push(processed);
        }
        break;
    }
  }

  // Source footer
  if (parsed.source) {
    result.push("");
    result.push(`<i>${escapeHtml(parsed.source)}</i>`);
  }

  return result.join("\n");
}

// ---------------------------------------------------------------------------
// renderTableAsText — render tables as flowing text, not <pre> codeblocks
// ---------------------------------------------------------------------------

/**
 * Render a table as formatted Telegram HTML text.
 *
 * - Comparison tables (3 columns): center-aligned key-value layout
 * - Small tables (≤5 cols): each row as "Col1: Val1 · Col2: Val2" lines
 * - Wide tables (>5 cols): each row joined with " · " separators
 *
 * No <pre> tags — everything flows as normal Telegram text.
 */
function renderTableAsText(block: ParsedBlock & { type: "table" }): string {
  const rows = block.rows.map((row) => row.map((c) => stripBold(c)));
  const headerIdx = block.headerIndex >= 0 ? block.headerIndex : 0;
  const headerRow = rows[headerIdx];
  const dataRows = rows.filter((_, i) => i !== headerIdx);

  if (dataRows.length === 0) {
    // Single-row table — just render it as a bold line
    return `<b>${escapeHtml(headerRow.join(" · "))}</b>`;
  }

  // Comparison tables: centered key-value layout
  if (isComparisonTable(rows)) {
    return renderComparisonAsText(headerRow, dataRows);
  }

  const lines: string[] = [];

  // For tables with a clear first-column identifier (matchup, name, team),
  // render each row as: bold first cell, then remaining values with headers
  const hasIdentifier = headerRow.length >= 2;

  for (const row of dataRows) {
    if (hasIdentifier && headerRow.length <= 5) {
      // "BOS @ MIA · 7:30 PM · BOS –4.5 · O/U 229.5" style
      const parts: string[] = [];
      for (let c = 0; c < row.length; c++) {
        const val = row[c] || "";
        if (c === 0) {
          // First column bold (usually the matchup/name)
          parts.push(`<b>${escapeHtml(val)}</b>`);
        } else {
          parts.push(escapeHtml(val));
        }
      }
      lines.push(parts.join(" · "));
    } else {
      // Wide tables: just join with mid-dots
      lines.push(escapeHtml(row.join(" · ")));
    }
  }

  return lines.join("\n");
}

// ---------------------------------------------------------------------------
// renderComparisonAsText — 3-column comparison without <pre>
// ---------------------------------------------------------------------------

function renderComparisonAsText(
  headerRow: string[],
  dataRows: string[][],
): string {
  const team1 = headerRow[1] || "Home";
  const team2 = headerRow[2] || "Away";

  const lines: string[] = [];
  lines.push(`<b>${escapeHtml(team1)}</b> vs <b>${escapeHtml(team2)}</b>`);
  lines.push("");

  for (const row of dataRows) {
    const stat = row[0] || "";
    const v1 = row[1] || "";
    const v2 = row[2] || "";
    lines.push(`${escapeHtml(v1)} · <i>${escapeHtml(stat)}</i> · ${escapeHtml(v2)}`);
  }

  return lines.join("\n");
}

// ---------------------------------------------------------------------------
// escapeHtml — Telegram HTML-safe escaping
// ---------------------------------------------------------------------------

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}
