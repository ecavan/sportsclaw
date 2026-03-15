"use strict";
/**
 * sportsclaw Auto-Clipper — Conversational CLI Wizard
 *
 * Interactive flow:
 *   1. Gemini credential check (multi-LLM keychain)
 *   2. Match selection via natural language → sports-skills local lookup
 *   3. Video file selection with validation
 *   4. Highlight intent (free-text)
 *   5. Output format (landscape 16:9 / vertical 9:16)
 *   6. Extraction pipeline (Gemini Vision OCR → PBP → FFmpeg → Hype Score)
 *
 * Flags:
 *   --yes, --non-interactive   Skip all prompts (agentic mode)
 *   --file <path>              Video file path (skip prompt)
 *   --match <query>            Match query (skip prompt)
 *   --intent <text>            Highlight intent (skip prompt)
 *   --format <landscape|vertical>  Output format (skip prompt)
 */
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
var __generator = (this && this.__generator) || function (thisArg, body) {
    var _ = { label: 0, sent: function() { if (t[0] & 1) throw t[1]; return t[1]; }, trys: [], ops: [] }, f, y, t, g = Object.create((typeof Iterator === "function" ? Iterator : Object).prototype);
    return g.next = verb(0), g["throw"] = verb(1), g["return"] = verb(2), typeof Symbol === "function" && (g[Symbol.iterator] = function() { return this; }), g;
    function verb(n) { return function (v) { return step([n, v]); }; }
    function step(op) {
        if (f) throw new TypeError("Generator is already executing.");
        while (g && (g = 0, op[0] && (_ = 0)), _) try {
            if (f = 1, y && (t = op[0] & 2 ? y["return"] : op[0] ? y["throw"] || ((t = y["return"]) && t.call(y), 0) : y.next) && !(t = t.call(y, op[1])).done) return t;
            if (y = 0, t) op = [op[0] & 2, t.value];
            switch (op[0]) {
                case 0: case 1: t = op; break;
                case 4: _.label++; return { value: op[1], done: false };
                case 5: _.label++; y = op[1]; op = [0]; continue;
                case 7: op = _.ops.pop(); _.trys.pop(); continue;
                default:
                    if (!(t = _.trys, t = t.length > 0 && t[t.length - 1]) && (op[0] === 6 || op[0] === 2)) { _ = 0; continue; }
                    if (op[0] === 3 && (!t || (op[1] > t[0] && op[1] < t[3]))) { _.label = op[1]; break; }
                    if (op[0] === 6 && _.label < t[1]) { _.label = t[1]; t = op; break; }
                    if (t && _.label < t[2]) { _.label = t[2]; _.ops.push(op); break; }
                    if (t[2]) _.ops.pop();
                    _.trys.pop(); continue;
            }
            op = body.call(thisArg, _);
        } catch (e) { op = [6, e]; y = 0; } finally { f = t = 0; }
        if (op[0] & 5) throw op[1]; return { value: op[0] ? op[1] : void 0, done: true };
    }
};
var __spreadArray = (this && this.__spreadArray) || function (to, from, pack) {
    if (pack || arguments.length === 2) for (var i = 0, l = from.length, ar; i < l; i++) {
        if (ar || !(i in from)) {
            if (!ar) ar = Array.prototype.slice.call(from, 0, i);
            ar[i] = from[i];
        }
    }
    return to.concat(ar || Array.prototype.slice.call(from));
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.fetchRecentMatches = fetchRecentMatches;
exports.cmdClip = cmdClip;
var node_fs_1 = require("node:fs");
var node_path_1 = require("node:path");
var node_os_1 = require("node:os");
var node_module_1 = require("node:module");
var p = require("@clack/prompts");
var picocolors_1 = require("picocolors");
var server_1 = require("@google/generative-ai/server");
var generative_ai_1 = require("@google/generative-ai");
var credentials_js_1 = require("./credentials.js");
var tools_js_1 = require("./tools.js");
var config_js_1 = require("./config.js");
var require = (0, node_module_1.createRequire)(import.meta.url);
var ffmpeg = require("fluent-ffmpeg");
var CHUNK_DURATION_SEC = 30;
var HIGHLIGHTS_DIR = "./highlights";
// ---------------------------------------------------------------------------
// Arg parsing
// ---------------------------------------------------------------------------
function parseClipArgs(args) {
    var flags = { nonInteractive: false };
    for (var i = 0; i < args.length; i++) {
        var arg = args[i];
        if (arg === "--yes" || arg === "--non-interactive") {
            flags.nonInteractive = true;
        }
        else if (arg === "--file" && args[i + 1]) {
            flags.file = args[++i];
        }
        else if (arg === "--match" && args[i + 1]) {
            flags.match = args[++i];
        }
        else if (arg === "--intent" && args[i + 1]) {
            flags.intent = args[++i];
        }
        else if (arg === "--format" && args[i + 1]) {
            var fmt = args[++i];
            if (fmt === "landscape" || fmt === "vertical") {
                flags.format = fmt;
            }
        }
    }
    return flags;
}
// ---------------------------------------------------------------------------
// Sports-skills match discovery
// ---------------------------------------------------------------------------
/** Sport modules to query for recent matches */
var MATCH_SPORTS = [
    { skill: "football", label: "Football (Soccer)" },
    { skill: "nba", label: "NBA" },
    { skill: "nfl", label: "NFL" },
    { skill: "mlb", label: "MLB" },
    { skill: "nhl", label: "NHL" },
];
/**
 * Query local sports-skills for recent/live matches across multiple sports.
 * Parses the bridge result and returns a flat array of selectable options.
 */
function fetchRecentMatches(query, pythonPath) {
    return __awaiter(this, void 0, void 0, function () {
        var options, config, sportQueries, results, _i, results_1, r, apiKey, genAI, model, prompt_1, result, text_1, found, e_1, qTokens_1, filtered;
        var _this = this;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0:
                    options = [];
                    config = { pythonPath: pythonPath !== null && pythonPath !== void 0 ? pythonPath : "python3", timeout: 15000 };
                    sportQueries = MATCH_SPORTS.map(function (_a) { return __awaiter(_this, [_a], void 0, function (_b) {
                        var result, data, events, _c;
                        var skill = _b.skill, label = _b.label;
                        return __generator(this, function (_d) {
                            switch (_d.label) {
                                case 0:
                                    _d.trys.push([0, 2, , 3]);
                                    return [4 /*yield*/, (0, tools_js_1.executePythonBridge)(skill, "scores", undefined, config)];
                                case 1:
                                    result = _d.sent();
                                    if (!result.success || !result.data)
                                        return [2 /*return*/, []];
                                    data = result.data;
                                    events = extractEvents(data);
                                    return [2 /*return*/, events.map(function (evt) { return ({
                                            value: "".concat(skill, "_").concat(evt.id),
                                            label: evt.name,
                                            hint: label,
                                        }); })];
                                case 2:
                                    _c = _d.sent();
                                    return [2 /*return*/, []];
                                case 3: return [2 /*return*/];
                            }
                        });
                    }); });
                    return [4 /*yield*/, Promise.allSettled(sportQueries)];
                case 1:
                    results = _a.sent();
                    for (_i = 0, results_1 = results; _i < results_1.length; _i++) {
                        r = results_1[_i];
                        if (r.status === "fulfilled") {
                            options.push.apply(options, r.value);
                        }
                    }
                    if (!(query && query.trim().length > 0)) return [3 /*break*/, 8];
                    _a.label = 2;
                case 2:
                    _a.trys.push([2, 6, , 7]);
                    return [4 /*yield*/, (0, credentials_js_1.resolveCredential)("gemini")];
                case 3:
                    apiKey = _a.sent();
                    if (!apiKey) return [3 /*break*/, 5];
                    genAI = new generative_ai_1.GoogleGenerativeAI(apiKey);
                    model = genAI.getGenerativeModel({ model: "gemini-2.5-flash" });
                    prompt_1 = "\nYou are a sports match resolver. \nThe user searched for: \"".concat(query, "\"\n\nHere is the JSON list of currently active or recent matches:\n").concat(JSON.stringify(options, null, 2), "\n\nIdentify the exact match the user means. Return ONLY the \"value\" string of that match (e.g., \"nba_0022500962\").\nIf absolutely no match makes sense for the query, return exactly \"NOT_FOUND\".");
                    return [4 /*yield*/, model.generateContent(prompt_1)];
                case 4:
                    result = _a.sent();
                    text_1 = result.response.text().trim().replace(/['"`]/g, '');
                    if (text_1 === "NOT_FOUND")
                        return [2 /*return*/, []];
                    found = options.find(function (o) { return o.value === text_1; });
                    if (found)
                        return [2 /*return*/, [found]];
                    _a.label = 5;
                case 5: return [3 /*break*/, 7];
                case 6:
                    e_1 = _a.sent();
                    return [3 /*break*/, 7];
                case 7:
                    qTokens_1 = query.toLowerCase().split(/\s+/).filter(function (t) { return t !== "vs" && t !== "at" && t.length > 1; });
                    filtered = options.filter(function (o) {
                        var _a;
                        var text = "".concat(o.label.toLowerCase(), " ").concat(((_a = o.hint) !== null && _a !== void 0 ? _a : "").toLowerCase());
                        return qTokens_1.every(function (t) { return text.includes(t); });
                    });
                    return [2 /*return*/, filtered];
                case 8: return [2 /*return*/, options];
            }
        });
    });
}
/**
 * Extract event entries from a sports-skills scores response.
 * Handles the common ESPN data shape: { events: [{ id, name, ... }] }
 * as well as flat arrays and nested data wrappers.
 */
function extractEvents(data) {
    var _a, _b, _c, _d;
    var extracted = [];
    var eventsArray = [];
    if (Array.isArray(data.events)) {
        eventsArray = data.events;
    }
    else if (data.data && typeof data.data === "object") {
        var inner = data.data;
        if (Array.isArray(inner.events)) {
            eventsArray = inner.events;
        }
        else if (Array.isArray(inner.games)) {
            eventsArray = inner.games;
        }
    }
    else if (Array.isArray(data)) {
        eventsArray = data;
    }
    for (var _i = 0, eventsArray_1 = eventsArray; _i < eventsArray_1.length; _i++) {
        var e = eventsArray_1[_i];
        if (!e || typeof e !== "object")
            continue;
        var id = e.id || e.idEvent || e.gameId;
        if (!id)
            continue;
        var name_1 = e.name || e.strEvent;
        if (!name_1 && Array.isArray(e.competitors) && e.competitors.length >= 2) {
            var c1 = ((_b = (_a = e.competitors[0]) === null || _a === void 0 ? void 0 : _a.team) === null || _b === void 0 ? void 0 : _b.name) || "Unknown";
            var c2 = ((_d = (_c = e.competitors[1]) === null || _c === void 0 ? void 0 : _c.team) === null || _d === void 0 ? void 0 : _d.name) || "Unknown";
            // ESPN format: competitors[0] is home, [1] is away
            name_1 = "".concat(c2, " at ").concat(c1);
        }
        if (id && name_1) {
            extracted.push({ id: String(id), name: String(name_1) });
        }
    }
    return extracted;
}
// ---------------------------------------------------------------------------
// FFmpeg helpers
// ---------------------------------------------------------------------------
function probeVideo(filePath) {
    return new Promise(function (resolve, reject) {
        ffmpeg.ffprobe(filePath, function (err, data) {
            if (err)
                return reject(err);
            resolve(data);
        });
    });
}
function extractSegment(input, output, startSec, durationSec) {
    return new Promise(function (resolve, reject) {
        ffmpeg(input)
            .setStartTime(startSec)
            .duration(durationSec)
            .outputOptions(["-c copy", "-avoid_negative_ts make_zero"])
            .output(output)
            .on("end", function () { return resolve(); })
            .on("error", function (err) { return reject(err); })
            .run();
    });
}
// ---------------------------------------------------------------------------
// PBP mock — returns fake timestamps for a given intent
// ---------------------------------------------------------------------------
function searchPBPTimestamps(_matchId, intent, totalDurationSec) {
    // TODO: Wire to real PBP data from sports-skills
    // For now, return 3-5 evenly-spaced candidate windows
    var count = Math.min(5, Math.max(3, Math.floor(totalDurationSec / 600)));
    var spacing = totalDurationSec / (count + 1);
    var timestamps = [];
    for (var i = 1; i <= count; i++) {
        var startSec = Math.floor(spacing * i);
        timestamps.push({
            startSec: startSec,
            label: "PBP candidate #".concat(i, " for \"").concat(intent, "\" @ ").concat(fmtTime(startSec)),
        });
    }
    return timestamps;
}
// ---------------------------------------------------------------------------
// Gemini Vision — analyse a single video chunk, return a hype score 0-100
// ---------------------------------------------------------------------------
function analyzeChunkWithGemini(chunkPath, intent, apiKey) {
    return __awaiter(this, void 0, void 0, function () {
        var fileManager, genAI, uploadRes, fileMeta, model, result, raw, cleaned, parsed, _a;
        return __generator(this, function (_b) {
            switch (_b.label) {
                case 0:
                    fileManager = new server_1.GoogleAIFileManager(apiKey);
                    genAI = new generative_ai_1.GoogleGenerativeAI(apiKey);
                    return [4 /*yield*/, fileManager.uploadFile(chunkPath, {
                            mimeType: "video/mp4",
                            displayName: (0, node_path_1.basename)(chunkPath),
                        })];
                case 1:
                    uploadRes = _b.sent();
                    fileMeta = uploadRes.file;
                    _b.label = 2;
                case 2:
                    if (!(fileMeta.state === server_1.FileState.PROCESSING)) return [3 /*break*/, 5];
                    return [4 /*yield*/, new Promise(function (r) { return setTimeout(r, 3000); })];
                case 3:
                    _b.sent();
                    return [4 /*yield*/, fileManager.getFile(fileMeta.name)];
                case 4:
                    fileMeta = _b.sent();
                    return [3 /*break*/, 2];
                case 5:
                    if (fileMeta.state === server_1.FileState.FAILED) {
                        throw new Error("Gemini file processing failed for ".concat(chunkPath));
                    }
                    model = genAI.getGenerativeModel({ model: "gemini-2.0-flash" });
                    return [4 /*yield*/, model.generateContent([
                            {
                                fileData: {
                                    mimeType: fileMeta.mimeType,
                                    fileUri: fileMeta.uri,
                                },
                            },
                            {
                                text: [
                                    "You are a sports highlight analyst. The user wants: \"".concat(intent, "\"."),
                                    "Watch this video clip and respond with ONLY valid JSON (no markdown, no code fences):",
                                    '{ "hypeScore": <0-100>, "summary": "<one sentence>" }',
                                    "hypeScore: 0 = nothing relevant, 100 = peak highlight moment.",
                                ].join("\n"),
                            },
                        ])];
                case 6:
                    result = _b.sent();
                    raw = result.response.text().trim();
                    cleaned = raw.replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/, "");
                    _b.label = 7;
                case 7:
                    _b.trys.push([7, 8, 9, 11]);
                    parsed = JSON.parse(cleaned);
                    return [2 /*return*/, {
                            hypeScore: Math.max(0, Math.min(100, Number(parsed.hypeScore) || 0)),
                            summary: String(parsed.summary || "No summary"),
                        }];
                case 8:
                    _a = _b.sent();
                    return [2 /*return*/, { hypeScore: 0, summary: "Failed to parse Gemini response" }];
                case 9: return [4 /*yield*/, fileManager.deleteFile(fileMeta.name).catch(function () { })];
                case 10:
                    _b.sent();
                    return [7 /*endfinally*/];
                case 11: return [2 /*return*/];
            }
        });
    });
}
// ---------------------------------------------------------------------------
// File validation
// ---------------------------------------------------------------------------
var VIDEO_EXTENSIONS = new Set([".mp4", ".mkv", ".mov", ".avi", ".webm", ".ts", ".m4v"]);
function validateVideoPath(filePath) {
    var resolved = (0, node_path_1.resolve)(filePath);
    if (!(0, node_fs_1.existsSync)(resolved)) {
        return "File not found: ".concat(resolved);
    }
    var ext = resolved.slice(resolved.lastIndexOf(".")).toLowerCase();
    if (!VIDEO_EXTENSIONS.has(ext)) {
        return "Unsupported video format: ".concat(ext, ". Supported: ").concat(__spreadArray([], VIDEO_EXTENSIONS, true).join(", "));
    }
    return undefined;
}
// ---------------------------------------------------------------------------
// Main CLI flow
// ---------------------------------------------------------------------------
function cmdClip() {
    return __awaiter(this, arguments, void 0, function (args) {
        var flags, pythonPath, selectedMatchId, selectedMatchLabel, matchQuery, s, matches, manualId, selection_1, videoPath, err, fileInput, intent, intentInput, format, formatInput, proceed, sp, apiKey, totalDuration, meta, err_1, _a, sport, eventId, _b, pbpHits, _i, pbpHits_1, hit, tmpChunkDir, chunkFiles, i, hit, startSec, duration, chunkFile, err_2, scoredChunks, _c, chunkFiles_1, chunk, _d, hypeScore, summary, err_3, topClips, _e, topClips_1, clip, savedFiles, i, clip, outFile, err_4, _f, chunkFiles_2, chunk, _g, savedFiles_1, f;
        var _h, _j, _k;
        if (args === void 0) { args = []; }
        return __generator(this, function (_l) {
            switch (_l.label) {
                case 0:
                    flags = parseClipArgs(args);
                    p.intro(picocolors_1.default.bold("sportsclaw auto-clipper"));
                    // Step 1: Ensure Gemini auth (required for Vision OCR + Hype Scoring)
                    return [4 /*yield*/, (0, credentials_js_1.ensureCredential)("gemini", {
                            nonInteractive: flags.nonInteractive,
                            reason: "Auto-Clipper requires Gemini Vision models for multimodal analysis.",
                        })];
                case 1:
                    // Step 1: Ensure Gemini auth (required for Vision OCR + Hype Scoring)
                    _l.sent();
                    p.log.success("Gemini authenticated.");
                    pythonPath = (0, config_js_1.resolveConfig)().pythonPath;
                    if (!(flags.nonInteractive && flags.match)) return [3 /*break*/, 2];
                    // Agentic mode: use provided match flag directly
                    selectedMatchId = flags.match;
                    selectedMatchLabel = flags.match;
                    p.log.info("Match: ".concat(flags.match));
                    return [3 /*break*/, 8];
                case 2: return [4 /*yield*/, p.text({
                        message: "What match are you clipping?",
                        placeholder: "e.g., Corinthians vs Flamengo, Lakers vs Warriors",
                    })];
                case 3:
                    matchQuery = _l.sent();
                    if (p.isCancel(matchQuery)) {
                        p.cancel("Cancelled.");
                        return [2 /*return*/, process.exit(0)];
                    }
                    s = p.spinner();
                    s.start("Searching local sports-skills for matching fixtures...");
                    return [4 /*yield*/, fetchRecentMatches(matchQuery, pythonPath)];
                case 4:
                    matches = _l.sent();
                    if (!(matches.length === 0)) return [3 /*break*/, 6];
                    s.stop("No matches found.");
                    p.log.warn("Could not find matching fixtures via sports-skills.\n" +
                        "  Tip: Try a broader query, or ensure sports-skills is installed:\n" +
                        "    sportsclaw init");
                    return [4 /*yield*/, p.text({
                            message: "Enter a match/event ID manually (or Ctrl+C to cancel):",
                            placeholder: "e.g., 401234567",
                        })];
                case 5:
                    manualId = _l.sent();
                    if (p.isCancel(manualId)) {
                        p.cancel("Cancelled.");
                        return [2 /*return*/, process.exit(0)];
                    }
                    selectedMatchId = manualId;
                    selectedMatchLabel = manualId;
                    return [3 /*break*/, 8];
                case 6:
                    s.stop("Found ".concat(matches.length, " fixture(s)."));
                    return [4 /*yield*/, p.select({
                            message: "Select the match:",
                            options: matches.map(function (m) { return ({
                                value: m.value,
                                label: m.label,
                                hint: m.hint,
                            }); }),
                        })];
                case 7:
                    selection_1 = _l.sent();
                    if (p.isCancel(selection_1)) {
                        p.cancel("Cancelled.");
                        return [2 /*return*/, process.exit(0)];
                    }
                    selectedMatchId = selection_1;
                    selectedMatchLabel =
                        (_j = (_h = matches.find(function (m) { return m.value === selection_1; })) === null || _h === void 0 ? void 0 : _h.label) !== null && _j !== void 0 ? _j : selection_1;
                    _l.label = 8;
                case 8:
                    if (!flags.file) return [3 /*break*/, 9];
                    err = validateVideoPath(flags.file);
                    if (err) {
                        p.log.error(err);
                        process.exit(1);
                    }
                    videoPath = (0, node_path_1.resolve)(flags.file);
                    p.log.info("Video: ".concat(videoPath));
                    return [3 /*break*/, 11];
                case 9: return [4 /*yield*/, p.text({
                        message: "Where is the local video file?",
                        placeholder: "./downloads/match.mp4",
                        validate: function (val) { return val ? validateVideoPath(val) : "File path is required."; },
                    })];
                case 10:
                    fileInput = _l.sent();
                    if (p.isCancel(fileInput)) {
                        p.cancel("Cancelled.");
                        return [2 /*return*/, process.exit(0)];
                    }
                    videoPath = (0, node_path_1.resolve)(fileInput);
                    _l.label = 11;
                case 11:
                    if (!flags.intent) return [3 /*break*/, 12];
                    intent = flags.intent;
                    p.log.info("Intent: ".concat(intent));
                    return [3 /*break*/, 14];
                case 12: return [4 /*yield*/, p.text({
                        message: "What do you want to highlight?",
                        placeholder: "e.g., All goals, Memphis Depay's best moments, Red cards",
                    })];
                case 13:
                    intentInput = _l.sent();
                    if (p.isCancel(intentInput)) {
                        p.cancel("Cancelled.");
                        return [2 /*return*/, process.exit(0)];
                    }
                    intent = intentInput;
                    _l.label = 14;
                case 14:
                    if (!flags.format) return [3 /*break*/, 15];
                    format = flags.format;
                    p.log.info("Format: ".concat(format === "vertical" ? "9:16 Vertical" : "16:9 Landscape"));
                    return [3 /*break*/, 17];
                case 15: return [4 /*yield*/, p.select({
                        message: "Output format:",
                        options: [
                            {
                                value: "landscape",
                                label: "Original 16:9 (Landscape)",
                                hint: "Fast — just cut by timestamps",
                            },
                            {
                                value: "vertical",
                                label: "Auto-Track 9:16 (Vertical)",
                                hint: "TikTok/Reels — YOLOv8 subject tracking",
                            },
                        ],
                    })];
                case 16:
                    formatInput = _l.sent();
                    if (p.isCancel(formatInput)) {
                        p.cancel("Cancelled.");
                        return [2 /*return*/, process.exit(0)];
                    }
                    format = formatInput;
                    _l.label = 17;
                case 17:
                    // Step 6: Extraction pipeline summary
                    console.log("");
                    p.log.info(picocolors_1.default.bold("Pipeline Summary") + "\n" +
                        "  Match:   ".concat(selectedMatchLabel, "\n") +
                        "  Video:   ".concat(videoPath, "\n") +
                        "  Intent:  ".concat(intent, "\n") +
                        "  Format:  ".concat(format === "vertical" ? "9:16 Vertical (Auto-Track)" : "16:9 Landscape", "\n") +
                        "  Match ID: ".concat(selectedMatchId));
                    if (!!flags.nonInteractive) return [3 /*break*/, 19];
                    return [4 /*yield*/, p.confirm({
                            message: "Start extraction?",
                            initialValue: true,
                        })];
                case 18:
                    proceed = _l.sent();
                    if (p.isCancel(proceed) || !proceed) {
                        p.cancel("Cancelled.");
                        return [2 /*return*/, process.exit(0)];
                    }
                    _l.label = 19;
                case 19:
                    sp = p.spinner();
                    apiKey = (0, credentials_js_1.resolveCredential)("gemini");
                    // 7a. Probe video metadata
                    sp.start("Stage 1/6 — Probing video metadata via FFmpeg...");
                    _l.label = 20;
                case 20:
                    _l.trys.push([20, 22, , 23]);
                    return [4 /*yield*/, probeVideo(videoPath)];
                case 21:
                    meta = _l.sent();
                    totalDuration = (_k = meta.format.duration) !== null && _k !== void 0 ? _k : 0;
                    if (totalDuration === 0) {
                        sp.stop("Could not determine video duration.");
                        return [2 /*return*/, process.exit(1)];
                    }
                    return [3 /*break*/, 23];
                case 22:
                    err_1 = _l.sent();
                    sp.stop("FFmpeg probe failed. Is ffmpeg installed?");
                    p.log.error(String(err_1));
                    return [2 /*return*/, process.exit(1)];
                case 23:
                    sp.stop("Video duration: ".concat(fmtTime(totalDuration)));
                    // 7b. Fetch PBP data (best-effort)
                    sp.start("Stage 2/6 — Fetching Play-by-Play data from sports-skills...");
                    _a = splitMatchId(selectedMatchId), sport = _a[0], eventId = _a[1];
                    if (!(sport && eventId)) return [3 /*break*/, 27];
                    _l.label = 24;
                case 24:
                    _l.trys.push([24, 26, , 27]);
                    return [4 /*yield*/, (0, tools_js_1.executePythonBridge)(sport, "playbyplay", { event_id: eventId }, { pythonPath: pythonPath })];
                case 25:
                    _l.sent();
                    return [3 /*break*/, 27];
                case 26:
                    _b = _l.sent();
                    return [3 /*break*/, 27];
                case 27:
                    // 7c. Search PBP for candidate timestamps (mock for now)
                    sp.message("Stage 3/6 \u2014 Scanning PBP for \"".concat(intent, "\"..."));
                    pbpHits = searchPBPTimestamps(selectedMatchId, intent, totalDuration);
                    sp.stop("Found ".concat(pbpHits.length, " PBP candidate windows."));
                    for (_i = 0, pbpHits_1 = pbpHits; _i < pbpHits_1.length; _i++) {
                        hit = pbpHits_1[_i];
                        p.log.info("  ".concat(hit.label));
                    }
                    // 7d. Slice chunks around each PBP timestamp
                    sp.start("Stage 4/6 — Slicing MP4 chunks via FFmpeg...");
                    if (!(0, node_fs_1.existsSync)(HIGHLIGHTS_DIR)) {
                        (0, node_fs_1.mkdirSync)(HIGHLIGHTS_DIR, { recursive: true });
                    }
                    tmpChunkDir = (0, node_fs_1.mkdtempSync)((0, node_path_1.join)((0, node_os_1.tmpdir)(), "sportsclaw-chunks-"));
                    chunkFiles = [];
                    i = 0;
                    _l.label = 28;
                case 28:
                    if (!(i < pbpHits.length)) return [3 /*break*/, 33];
                    hit = pbpHits[i];
                    startSec = Math.max(0, hit.startSec - CHUNK_DURATION_SEC / 2);
                    duration = Math.min(CHUNK_DURATION_SEC, totalDuration - startSec);
                    chunkFile = (0, node_path_1.join)(tmpChunkDir, "chunk_".concat(i, ".mp4"));
                    _l.label = 29;
                case 29:
                    _l.trys.push([29, 31, , 32]);
                    return [4 /*yield*/, extractSegment(videoPath, chunkFile, startSec, duration)];
                case 30:
                    _l.sent();
                    chunkFiles.push({ file: chunkFile, startSec: startSec });
                    return [3 /*break*/, 32];
                case 31:
                    err_2 = _l.sent();
                    p.log.warn("Skipping chunk ".concat(i, " (FFmpeg error): ").concat(err_2));
                    return [3 /*break*/, 32];
                case 32:
                    i++;
                    return [3 /*break*/, 28];
                case 33:
                    sp.stop("Sliced ".concat(chunkFiles.length, " chunks."));
                    if (chunkFiles.length === 0) {
                        p.log.error("No chunks could be extracted. Aborting.");
                        return [2 /*return*/, process.exit(1)];
                    }
                    // 7e. Score each chunk with Gemini Vision
                    sp.start("Stage 5/6 — Applying Hype Score via Gemini Vision...");
                    scoredChunks = [];
                    _c = 0, chunkFiles_1 = chunkFiles;
                    _l.label = 34;
                case 34:
                    if (!(_c < chunkFiles_1.length)) return [3 /*break*/, 39];
                    chunk = chunkFiles_1[_c];
                    sp.message("Scoring chunk @ ".concat(fmtTime(chunk.startSec), " with Gemini..."));
                    _l.label = 35;
                case 35:
                    _l.trys.push([35, 37, , 38]);
                    return [4 /*yield*/, analyzeChunkWithGemini(chunk.file, intent, apiKey)];
                case 36:
                    _d = _l.sent(), hypeScore = _d.hypeScore, summary = _d.summary;
                    scoredChunks.push({
                        file: chunk.file,
                        startSec: chunk.startSec,
                        durationSec: CHUNK_DURATION_SEC,
                        hypeScore: hypeScore,
                        summary: summary,
                    });
                    return [3 /*break*/, 38];
                case 37:
                    err_3 = _l.sent();
                    p.log.warn("Gemini analysis failed for chunk @ ".concat(fmtTime(chunk.startSec), ": ").concat(err_3));
                    scoredChunks.push({
                        file: chunk.file,
                        startSec: chunk.startSec,
                        durationSec: CHUNK_DURATION_SEC,
                        hypeScore: 0,
                        summary: "Analysis failed",
                    });
                    return [3 /*break*/, 38];
                case 38:
                    _c++;
                    return [3 /*break*/, 34];
                case 39:
                    sp.stop("Hype scoring complete.");
                    // 7f. Rank and export top 3 clips
                    scoredChunks.sort(function (a, b) { return b.hypeScore - a.hypeScore; });
                    topClips = scoredChunks.slice(0, 3);
                    p.log.info(picocolors_1.default.bold("Top clips by Hype Score:"));
                    for (_e = 0, topClips_1 = topClips; _e < topClips_1.length; _e++) {
                        clip = topClips_1[_e];
                        p.log.info("  [".concat(clip.hypeScore, "/100] @ ").concat(fmtTime(clip.startSec), " \u2014 ").concat(clip.summary));
                    }
                    sp.start("Stage 6/6 — Exporting final highlight clips...");
                    savedFiles = [];
                    i = 0;
                    _l.label = 40;
                case 40:
                    if (!(i < topClips.length)) return [3 /*break*/, 45];
                    clip = topClips[i];
                    outFile = (0, node_path_1.join)(HIGHLIGHTS_DIR, "highlight_".concat(i + 1, ".mp4"));
                    _l.label = 41;
                case 41:
                    _l.trys.push([41, 43, , 44]);
                    return [4 /*yield*/, extractSegment(videoPath, outFile, clip.startSec, clip.durationSec)];
                case 42:
                    _l.sent();
                    savedFiles.push(outFile);
                    return [3 /*break*/, 44];
                case 43:
                    err_4 = _l.sent();
                    p.log.warn("Failed to export highlight ".concat(i + 1, ": ").concat(err_4));
                    return [3 /*break*/, 44];
                case 44:
                    i++;
                    return [3 /*break*/, 40];
                case 45:
                    sp.stop("Export complete.");
                    // Clean up temp chunks
                    for (_f = 0, chunkFiles_2 = chunkFiles; _f < chunkFiles_2.length; _f++) {
                        chunk = chunkFiles_2[_f];
                        (0, node_fs_1.rmSync)(chunk.file, { force: true });
                    }
                    (0, node_fs_1.rmSync)(tmpChunkDir, { recursive: true, force: true });
                    if (format === "vertical") {
                        p.log.warn("9:16 auto-tracking requires YOLOv8 — not yet implemented. Clips saved as landscape.");
                    }
                    p.log.success("".concat(savedFiles.length, " highlight clip(s) saved to ").concat(HIGHLIGHTS_DIR, "/"));
                    for (_g = 0, savedFiles_1 = savedFiles; _g < savedFiles_1.length; _g++) {
                        f = savedFiles_1[_g];
                        p.log.info("  ".concat(f));
                    }
                    p.outro("Ready to post!");
                    return [2 /*return*/];
            }
        });
    });
}
// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------
function fmtTime(sec) {
    var h = Math.floor(sec / 3600);
    var m = Math.floor((sec % 3600) / 60);
    var s = Math.floor(sec % 60);
    return h > 0
        ? "".concat(h, ":").concat(String(m).padStart(2, "0"), ":").concat(String(s).padStart(2, "0"))
        : "".concat(m, ":").concat(String(s).padStart(2, "0"));
}
/**
 * Split a composite match ID like "nba_401234567" into [sport, eventId].
 * Returns [undefined, undefined] if the format doesn't match.
 */
function splitMatchId(matchId) {
    var idx = matchId.indexOf("_");
    if (idx < 0)
        return [undefined, undefined];
    return [matchId.slice(0, idx), matchId.slice(idx + 1)];
}
