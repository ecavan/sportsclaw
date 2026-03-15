"use strict";
/**
 * sportsclaw Engine — Schema Injection (Phase 3)
 *
 * Handles fetching sport-specific tool schemas from the Python `sports-skills`
 * package, persisting them to disk, and loading them at engine startup.
 *
 * Flow:
 *   1. `sportsclaw add nfl`
 *   2. Runs `python3 -m sports_skills nfl schema` → JSON tool definitions
 *   3. Saves to ~/.sportsclaw/schemas/nfl.json
 *   4. On next engine run, schemas are loaded and injected into the tool registry
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
Object.defineProperty(exports, "__esModule", { value: true });
exports.SKILL_DESCRIPTIONS = exports.DEFAULT_SKILLS = void 0;
exports.getInstalledVsAvailable = getInstalledVsAvailable;
exports.getSchemaDir = getSchemaDir;
exports.fetchSportSchema = fetchSportSchema;
exports.saveSchema = saveSchema;
exports.loadAllSchemas = loadAllSchemas;
exports.removeSchema = removeSchema;
exports.listSchemas = listSchemas;
exports.ensureSportsSkills = ensureSportsSkills;
exports.getInstalledSportsSkillsVersion = getInstalledSportsSkillsVersion;
exports.getCachedSchemaVersion = getCachedSchemaVersion;
exports.discoverAvailableSkills = discoverAvailableSkills;
exports.bootstrapDefaultSchemas = bootstrapDefaultSchemas;
var node_child_process_1 = require("node:child_process");
var node_fs_1 = require("node:fs");
var node_path_1 = require("node:path");
var node_os_1 = require("node:os");
var tools_js_1 = require("./tools.js");
var python_js_1 = require("./python.js");
// ---------------------------------------------------------------------------
// Default skills — the sports-skills that ship with sportsclaw
// See https://sports-skills.sh
// ---------------------------------------------------------------------------
exports.DEFAULT_SKILLS = [
    "football",
    "nfl",
    "nba",
    "nhl",
    "mlb",
    "wnba",
    "tennis",
    "cfb",
    "cbb",
    "golf",
    "f1",
    "kalshi",
    "polymarket",
    "news",
    "betting",
    "markets",
];
// ---------------------------------------------------------------------------
// Human-readable skill descriptions (used in config flow + system prompt)
// ---------------------------------------------------------------------------
exports.SKILL_DESCRIPTIONS = {
    football: "Football (soccer) — Transfermarkt & FBref data across 13 leagues",
    nfl: "NFL — scores, standings, rosters, play-by-play via ESPN",
    nba: "NBA — scores, standings, rosters, play-by-play via ESPN",
    nhl: "NHL — scores, standings, rosters, play-by-play via ESPN",
    mlb: "MLB — scores, standings, rosters, play-by-play via ESPN",
    wnba: "WNBA — scores, standings, rosters, play-by-play via ESPN",
    tennis: "Tennis — ATP & WTA scores, rankings, player profiles via ESPN",
    cfb: "College Football — NCAA Division I FBS via ESPN",
    cbb: "College Basketball — NCAA Division I via ESPN",
    golf: "Golf — PGA Tour, LPGA, DP World Tour via ESPN",
    f1: "Formula 1 — race results, lap timing, strategy via FastF1",
    kalshi: "Kalshi — CFTC-regulated prediction markets & event contracts",
    polymarket: "Polymarket — decentralized prediction markets & odds",
    news: "Sports News — headlines & articles via RSS feeds & Google News",
    betting: "Betting Analysis — odds conversion, de-vigging, edge detection, Kelly criterion",
    markets: "Markets — unified prediction market dashboard connecting ESPN with Kalshi & Polymarket",
};
// ---------------------------------------------------------------------------
// Skill filter — restrict active skills via SPORTSCLAW_SKILLS env var
// ---------------------------------------------------------------------------
/**
 * Parse the SPORTSCLAW_SKILLS env var (comma-separated) into a Set.
 * Returns null when unset → means "all skills active" (no filter).
 *
 * Example: SPORTSCLAW_SKILLS=football,nba,betting → Set(["football","nba","betting"])
 */
function getSkillFilter() {
    var _a;
    var raw = (_a = process.env.SPORTSCLAW_SKILLS) !== null && _a !== void 0 ? _a : process.env.sportsclaw_SKILLS;
    if (raw === undefined)
        return null; // unset → no filter (all active)
    if (raw.trim() === "")
        return new Set(); // empty string → no skills
    var skills = raw
        .split(",")
        .map(function (s) { return s.trim().toLowerCase(); })
        .filter(Boolean);
    return skills.length > 0 ? new Set(skills) : new Set();
}
// ---------------------------------------------------------------------------
// Installed vs available diffing
// ---------------------------------------------------------------------------
/**
 * Compare schemas on disk against DEFAULT_SKILLS to determine which
 * sports are installed and which are available but not yet installed.
 */
function getInstalledVsAvailable() {
    var installed = listSchemas();
    var installedSet = new Set(installed);
    var available = exports.DEFAULT_SKILLS.filter(function (s) { return !installedSet.has(s); });
    return { installed: installed, available: available };
}
// ---------------------------------------------------------------------------
// Schema directory management
// ---------------------------------------------------------------------------
/** Resolve the directory where sport schemas are stored */
function getSchemaDir() {
    var dir = process.env.sportsclaw_SCHEMA_DIR ||
        (0, node_path_1.join)((0, node_os_1.homedir)(), ".sportsclaw", "schemas");
    if (!(0, node_fs_1.existsSync)(dir)) {
        (0, node_fs_1.mkdirSync)(dir, { recursive: true });
    }
    return dir;
}
// ---------------------------------------------------------------------------
// Fetch schema from Python package
// ---------------------------------------------------------------------------
/**
 * Execute `python3 -m sports_skills <sport> schema` and parse the JSON output.
 *
 * Throws with a descriptive error if the package isn't installed, the sport
 * isn't supported, or the output isn't valid JSON.
 */
function fetchSportSchema(sport, config) {
    var _a, _b;
    var pythonPath = (_a = config === null || config === void 0 ? void 0 : config.pythonPath) !== null && _a !== void 0 ? _a : "python3";
    var timeout = (_b = config === null || config === void 0 ? void 0 : config.timeout) !== null && _b !== void 0 ? _b : 30000;
    return new Promise(function (resolve, reject) {
        (0, node_child_process_1.execFile)(pythonPath, ["-m", "sports_skills", sport, "schema"], {
            encoding: "utf-8",
            timeout: timeout,
            maxBuffer: 10 * 1024 * 1024,
            env: (0, tools_js_1.buildSubprocessEnv)(config === null || config === void 0 ? void 0 : config.env),
        }, function (error, stdout, stderr) {
            if (error) {
                var msg = [
                    "Failed to fetch schema for \"".concat(sport, "\"."),
                    "",
                    error.message,
                    "",
                    "Possible causes:",
                    "  1. The sports-skills Python package is not installed.",
                    '     → pip install sports-skills',
                    "  2. The sport \"".concat(sport, "\" is not supported by the installed version."),
                    "  3. Python 3 is not available at the configured path.",
                    "     \u2192 Current path: ".concat(pythonPath),
                ];
                if (stderr) {
                    msg.push("", "stderr: ".concat(stderr.trim()));
                }
                reject(new Error(msg.join("\n")));
                return;
            }
            var trimmed = (stdout !== null && stdout !== void 0 ? stdout : "").trim();
            if (!trimmed) {
                reject(new Error("No schema output for sport \"".concat(sport, "\". ") +
                    "The sport may not be supported by the installed sports-skills version."));
                return;
            }
            try {
                var schema = JSON.parse(trimmed);
                if (!schema.sport || !Array.isArray(schema.tools)) {
                    reject(new Error("Invalid schema format for \"".concat(sport, "\": ") +
                        'response must contain "sport" (string) and "tools" (array) fields.'));
                    return;
                }
                resolve(schema);
            }
            catch (_a) {
                reject(new Error("Invalid JSON in schema output for \"".concat(sport, "\":\n").concat(trimmed.slice(0, 300))));
            }
        });
    });
}
// ---------------------------------------------------------------------------
// Persist / load schemas
// ---------------------------------------------------------------------------
/** Save a sport schema to disk */
function saveSchema(schema) {
    var dir = getSchemaDir();
    var filePath = (0, node_path_1.join)(dir, "".concat(schema.sport, ".json"));
    (0, node_fs_1.writeFileSync)(filePath, JSON.stringify(schema, null, 2), "utf-8");
}
/**
 * Load all saved schemas from the schema directory.
 *
 * When the SPORTSCLAW_SKILLS env var is set (comma-separated list),
 * only schemas matching the filter are returned. This enables per-user
 * skill selection in multi-tenant relay deployments.
 */
function loadAllSchemas() {
    var dir = getSchemaDir();
    if (!(0, node_fs_1.existsSync)(dir))
        return [];
    var filter = getSkillFilter();
    var schemas = [];
    for (var _i = 0, _a = (0, node_fs_1.readdirSync)(dir); _i < _a.length; _i++) {
        var file = _a[_i];
        if (!file.endsWith(".json"))
            continue;
        var sport = file.replace(".json", "");
        if (filter && !filter.has(sport))
            continue;
        try {
            var content = (0, node_fs_1.readFileSync)((0, node_path_1.join)(dir, file), "utf-8");
            var schema = JSON.parse(content);
            if (schema.sport && Array.isArray(schema.tools)) {
                schemas.push(schema);
            }
        }
        catch (_b) {
            // Skip malformed schema files silently
        }
    }
    return schemas;
}
/** Remove a sport schema from disk. Returns true if found and deleted. */
function removeSchema(sport) {
    var dir = getSchemaDir();
    var filePath = (0, node_path_1.join)(dir, "".concat(sport, ".json"));
    if ((0, node_fs_1.existsSync)(filePath)) {
        (0, node_fs_1.unlinkSync)(filePath);
        return true;
    }
    return false;
}
/**
 * List all sport names that have saved schemas.
 * Respects SPORTSCLAW_SKILLS filter when set.
 */
function listSchemas() {
    var dir = getSchemaDir();
    if (!(0, node_fs_1.existsSync)(dir))
        return [];
    var filter = getSkillFilter();
    return (0, node_fs_1.readdirSync)(dir)
        .filter(function (f) { return f.endsWith(".json"); })
        .map(function (f) { return f.replace(".json", ""); })
        .filter(function (sport) { return !filter || filter.has(sport); });
}
// ---------------------------------------------------------------------------
// Auto-install sports-skills Python package
// ---------------------------------------------------------------------------
/**
 * Check if the `sports-skills` Python package is installed. If not,
 * install or repair it automatically via pip.
 *
 * Returns true only when both base package and F1 module are importable.
 */
function ensureSportsSkills(config) {
    return __awaiter(this, void 0, void 0, function () {
        var pythonPath, pyCheck, canImportBase, canImportF1, baseReady, f1Ready, installAttempts, _i, _a, pip, lastInstallError, _b, installAttempts_1, attempt;
        var _c;
        return __generator(this, function (_d) {
            pythonPath = (_c = config === null || config === void 0 ? void 0 : config.pythonPath) !== null && _c !== void 0 ? _c : "python3";
            pyCheck = (0, python_js_1.checkPythonVersion)(pythonPath);
            if (!pyCheck.ok) {
                if (pyCheck.version) {
                    console.error("[sportsclaw] Python ".concat(pyCheck.version, " is too old. ") +
                        "sports-skills requires Python ".concat(python_js_1.MIN_PYTHON_VERSION.major, ".").concat(python_js_1.MIN_PYTHON_VERSION.minor, "+."));
                }
                else {
                    console.error("[sportsclaw] Python not found at \"".concat(pythonPath, "\". ") +
                        "Install Python ".concat(python_js_1.MIN_PYTHON_VERSION.major, ".").concat(python_js_1.MIN_PYTHON_VERSION.minor, "+ or run: sportsclaw config"));
                }
                console.error("[sportsclaw] Upgrade Python and re-run, or set PYTHON_PATH to a valid interpreter.");
                return [2 /*return*/, false];
            }
            canImportBase = function () {
                try {
                    (0, node_child_process_1.execFileSync)(pythonPath, ["-c", "import sports_skills"], {
                        timeout: 10000,
                        stdio: "pipe",
                    });
                    return true;
                }
                catch (_a) {
                    return false;
                }
            };
            canImportF1 = function () {
                try {
                    (0, node_child_process_1.execFileSync)(pythonPath, ["-c", "from sports_skills import f1\nimport sys\nsys.exit(0 if f1 is not None else 1)"], {
                        timeout: 10000,
                        stdio: "pipe",
                    });
                    return true;
                }
                catch (_a) {
                    return false;
                }
            };
            baseReady = canImportBase();
            f1Ready = baseReady && canImportF1();
            if (baseReady && f1Ready) {
                return [2 /*return*/, true];
            }
            console.error("[sportsclaw] Preflight Python interpreter: ".concat(pythonPath));
            if (baseReady && !f1Ready) {
                console.error("[sportsclaw] sports-skills is installed but F1 support is unavailable. Attempting repair...");
            }
            else {
                console.error("[sportsclaw] sports-skills not found. Installing...");
            }
            installAttempts = [
                {
                    bin: pythonPath,
                    args: ["-m", "pip", "install", "--upgrade", "sports-skills"],
                },
                {
                    bin: pythonPath,
                    args: [
                        "-m",
                        "pip",
                        "install",
                        "--upgrade",
                        "sports-skills",
                        "--break-system-packages",
                    ],
                },
                {
                    bin: pythonPath,
                    args: ["-m", "pip", "install", "--upgrade", "sports-skills", "--user"],
                },
            ];
            // Fallbacks only if python -m pip is unavailable.
            for (_i = 0, _a = ["pip3", "pip"]; _i < _a.length; _i++) {
                pip = _a[_i];
                try {
                    (0, node_child_process_1.execFileSync)(pip, ["--version"], { timeout: 5000, stdio: "pipe" });
                    installAttempts.push({ bin: pip, args: ["install", "--upgrade", "sports-skills"] }, {
                        bin: pip,
                        args: [
                            "install",
                            "--upgrade",
                            "sports-skills",
                            "--break-system-packages",
                        ],
                    }, {
                        bin: pip,
                        args: ["install", "--upgrade", "sports-skills", "--user"],
                    });
                    break;
                }
                catch (_e) {
                    // try next
                }
            }
            try {
                for (_b = 0, installAttempts_1 = installAttempts; _b < installAttempts_1.length; _b++) {
                    attempt = installAttempts_1[_b];
                    try {
                        (0, node_child_process_1.execFileSync)(attempt.bin, attempt.args, {
                            timeout: 120000,
                            stdio: "inherit",
                        });
                        lastInstallError = undefined;
                        break;
                    }
                    catch (err) {
                        lastInstallError = err;
                    }
                }
            }
            catch (err) {
                lastInstallError = err;
            }
            baseReady = canImportBase();
            f1Ready = baseReady && canImportF1();
            if (baseReady && f1Ready) {
                console.error("[sportsclaw] sports-skills installed successfully.");
                return [2 /*return*/, true];
            }
            console.error("[sportsclaw] Failed to ensure sports-skills with F1 support: ".concat(lastInstallError instanceof Error ? lastInstallError.message : lastInstallError));
            console.error("[sportsclaw] Repair command: ".concat((0, python_js_1.buildSportsSkillsRepairCommand)(pythonPath)));
            console.error("[sportsclaw] If global install is blocked: ".concat((0, python_js_1.buildSportsSkillsRepairCommand)(pythonPath, true)));
            return [2 /*return*/, false];
        });
    });
}
// ---------------------------------------------------------------------------
// Installed version detection
// ---------------------------------------------------------------------------
/**
 * Get the installed sports-skills package version by running Python.
 * Returns the version string (e.g., "0.9.6") or null if unavailable.
 */
function getInstalledSportsSkillsVersion(config) {
    var _a;
    var pythonPath = (_a = config === null || config === void 0 ? void 0 : config.pythonPath) !== null && _a !== void 0 ? _a : "python3";
    try {
        var output = (0, node_child_process_1.execFileSync)(pythonPath, ["-c", "from sports_skills import __version__; print(__version__)"], { timeout: 10000, encoding: "utf-8", stdio: ["pipe", "pipe", "pipe"] });
        return output.trim() || null;
    }
    catch (_b) {
        return null;
    }
}
/**
 * Get the version stored in cached schemas.
 * Reads the first cached schema that has a version field.
 */
function getCachedSchemaVersion() {
    var schemas = loadAllSchemas();
    for (var _i = 0, schemas_1 = schemas; _i < schemas_1.length; _i++) {
        var schema = schemas_1[_i];
        if (schema.version)
            return schema.version;
    }
    return null;
}
/**
 * Run `python3 -m sports_skills catalog` and return the list of available
 * modules. Returns `null` when the command fails (e.g. older sports-skills
 * versions that don't support `catalog`).
 */
function discoverAvailableSkills(config) {
    var _a;
    var pythonPath = (_a = config === null || config === void 0 ? void 0 : config.pythonPath) !== null && _a !== void 0 ? _a : "python3";
    try {
        var output = (0, node_child_process_1.execFileSync)(pythonPath, ["-m", "sports_skills", "catalog"], { timeout: 15000, encoding: "utf-8", stdio: ["pipe", "pipe", "pipe"] });
        var parsed = JSON.parse(output.trim());
        if (Array.isArray(parsed.modules) && parsed.modules.length > 0) {
            return parsed;
        }
        return null;
    }
    catch (_b) {
        return null;
    }
}
// ---------------------------------------------------------------------------
// Bootstrap default schemas
// ---------------------------------------------------------------------------
/**
 * Fetch and save schemas for all default sports-skills.
 *
 * Attempts dynamic discovery via `catalog` first. Falls back to the
 * hardcoded `DEFAULT_SKILLS` list when discovery is unavailable (e.g.
 * older sports-skills versions).
 *
 * By default, skips skills that already have a schema on disk.
 * Pass `force: true` to re-fetch everything (useful for upgrades).
 *
 * Returns the number of schemas successfully installed (including
 * previously existing ones that were skipped).
 */
function bootstrapDefaultSchemas(config, options) {
    return __awaiter(this, void 0, void 0, function () {
        var verbose, force, onProgress, existing, catalog, skills, toFetch, succeeded, _i, skills_1, skill, results, i, result, skill;
        var _this = this;
        var _a, _b, _c;
        return __generator(this, function (_d) {
            switch (_d.label) {
                case 0:
                    verbose = (_a = options === null || options === void 0 ? void 0 : options.verbose) !== null && _a !== void 0 ? _a : false;
                    force = (_b = options === null || options === void 0 ? void 0 : options.force) !== null && _b !== void 0 ? _b : false;
                    onProgress = options === null || options === void 0 ? void 0 : options.onProgress;
                    existing = new Set(listSchemas());
                    catalog = discoverAvailableSkills(config);
                    skills = (_c = catalog === null || catalog === void 0 ? void 0 : catalog.modules) !== null && _c !== void 0 ? _c : exports.DEFAULT_SKILLS;
                    if (verbose && catalog) {
                        console.error("[sportsclaw] discovered ".concat(catalog.modules.length, " skills from sports-skills v").concat(catalog.version));
                    }
                    toFetch = [];
                    succeeded = 0;
                    for (_i = 0, skills_1 = skills; _i < skills_1.length; _i++) {
                        skill = skills_1[_i];
                        if (!force && existing.has(skill)) {
                            if (verbose) {
                                console.error("[sportsclaw] skip: \"".concat(skill, "\" already installed"));
                            }
                            succeeded++;
                        }
                        else {
                            toFetch.push(skill);
                        }
                    }
                    if (toFetch.length === 0)
                        return [2 /*return*/, succeeded];
                    if (verbose) {
                        console.error("[sportsclaw] fetching ".concat(toFetch.length, " schemas in parallel..."));
                    }
                    return [4 /*yield*/, Promise.allSettled(toFetch.map(function (skill) { return __awaiter(_this, void 0, void 0, function () {
                            var schema;
                            return __generator(this, function (_a) {
                                switch (_a.label) {
                                    case 0: return [4 /*yield*/, fetchSportSchema(skill, config)];
                                    case 1:
                                        schema = _a.sent();
                                        saveSchema(schema);
                                        if (verbose) {
                                            console.error("[sportsclaw] installed: ".concat(skill, " (").concat(schema.tools.length, " tools)"));
                                        }
                                        onProgress === null || onProgress === void 0 ? void 0 : onProgress(skill, true);
                                        return [2 /*return*/, skill];
                                }
                            });
                        }); }))];
                case 1:
                    results = _d.sent();
                    for (i = 0; i < results.length; i++) {
                        result = results[i];
                        if (result.status === "fulfilled") {
                            succeeded++;
                        }
                        else {
                            skill = toFetch[i];
                            console.error("[sportsclaw] warning: could not fetch schema for \"".concat(skill, "\""));
                            onProgress === null || onProgress === void 0 ? void 0 : onProgress(skill, false);
                        }
                    }
                    return [2 /*return*/, succeeded];
            }
        });
    });
}
