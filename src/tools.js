"use strict";
/**
 * sportsclaw Engine — Tool Definitions & Python Subprocess Bridge
 *
 * This module defines the tools the LLM can call and implements the core
 * "Python bridge" — the mechanism that intercepts tool calls and executes
 * them via `python3 -m sports_skills <sport> <command> [--args ...]`.
 *
 * Design principle: The TypeScript layer ORCHESTRATES; the Python layer EXECUTES.
 * Zero TS-to-Python rewriting is required.
 */
var __assign = (this && this.__assign) || function () {
    __assign = Object.assign || function(t) {
        for (var s, i = 1, n = arguments.length; i < n; i++) {
            s = arguments[i];
            for (var p in s) if (Object.prototype.hasOwnProperty.call(s, p))
                t[p] = s[p];
        }
        return t;
    };
    return __assign.apply(this, arguments);
};
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
exports.ToolRegistry = exports.TOOL_SPECS = void 0;
exports.buildSubprocessEnv = buildSubprocessEnv;
exports.executePythonBridge = executePythonBridge;
var node_child_process_1 = require("node:child_process");
var python_js_1 = require("./python.js");
var security_js_1 = require("./security.js");
function classifyBridgeError(error, stderr) {
    var haystack = "".concat(error !== null && error !== void 0 ? error : "", "\n").concat(stderr !== null && stderr !== void 0 ? stderr : "").toLowerCase();
    if (haystack.includes("timed out") || haystack.includes("command timed out")) {
        return {
            errorCode: "timeout",
            hint: "The data provider timed out. Retry the same query; if it persists, increase timeout in config.",
        };
    }
    if (haystack.includes("modulenotfounderror") ||
        haystack.includes("importerror") ||
        haystack.includes("optional dependency") ||
        haystack.includes("dependency_missing") ||
        haystack.includes("requires extra dependencies")) {
        return {
            errorCode: "dependency_missing",
            hint: "A required dependency is missing in the selected Python environment.",
        };
    }
    if (haystack.includes("enotfound") ||
        haystack.includes("name resolution") ||
        haystack.includes("nodename nor servname") ||
        haystack.includes("getaddrinfo")) {
        return {
            errorCode: "network_dns",
            hint: "Network/DNS lookup failed while reaching a data source. Verify internet/DNS and retry.",
        };
    }
    if (haystack.includes("429") ||
        haystack.includes("rate limit") ||
        haystack.includes("too many requests")) {
        return {
            errorCode: "rate_limited",
            hint: "The provider rate-limited requests. Wait briefly and retry.",
        };
    }
    if (haystack.includes("unsupported operand type(s) for |") ||
        (haystack.includes("typeerror") && haystack.includes("type |")) ||
        (haystack.includes("syntaxerror") && haystack.includes("x | y"))) {
        return {
            errorCode: "python_version_incompatible",
            hint: "Python 3.10+ is required. The current interpreter is too old for sports-skills. " +
                "Upgrade Python or run: sportsclaw config",
        };
    }
    return {
        errorCode: "tool_execution_failed",
        hint: "The tool execution failed. Retry and inspect stderr for details.",
    };
}
// ---------------------------------------------------------------------------
// Tool catalogue — these are the built-in tools exposed to the LLM
// ---------------------------------------------------------------------------
exports.TOOL_SPECS = [
    {
        name: "sports_query",
        description: [
            "Execute a sports data query via the sports-skills Python package.",
            "This tool fetches live and historical sports data including scores,",
            "standings, schedules, odds, play-by-play, stats, and more.",
            "",
            "Supported sports: nfl, nba, mlb, nhl, soccer, f1, mma, tennis, cfb, cbb.",
            "",
            "Examples of sport + command pairs:",
            '  sport="nfl", command="scores"          → current/recent NFL scores',
            '  sport="nfl", command="standings"        → NFL standings',
            '  sport="nba", command="schedule"         → NBA schedule',
            '  sport="soccer", command="standings", args={"league": "premier_league"}',
            '  sport="f1", command="race_results", args={"year": 2025, "round": 1}',
            "",
            "Pass any extra parameters as key-value pairs in the `args` object.",
        ].join("\n"),
        input_schema: {
            type: "object",
            properties: {
                sport: {
                    type: "string",
                    description: "The sport to query (e.g. nfl, nba, mlb, nhl, soccer, f1).",
                },
                command: {
                    type: "string",
                    description: "The specific command/action to execute (e.g. scores, standings, schedule).",
                },
                args: {
                    type: "object",
                    description: "Optional key-value arguments passed to the command.",
                    additionalProperties: true,
                },
            },
            required: ["sport", "command"],
        },
    },
];
// ---------------------------------------------------------------------------
// Search-First Middleware — intercept guessed IDs before they hit the bridge
// ---------------------------------------------------------------------------
/**
 * Check if a value looks like a human-readable name rather than a valid ID.
 *
 * Valid IDs are typically: numeric ("258"), dot-codes ("eng.1"), hex ("0x..."),
 * or slugs with digits ("premier-league-2024-2025"). Human names contain
 * spaces, start with uppercase, or are long strings with no digits/dots.
 */
function looksLikeHumanName(value) {
    var v = value.trim();
    if (v.length <= 4)
        return false; // short codes: "ne", "buf", "nba"
    if (/\d/.test(v))
        return false; // has digits — real ID or slug
    if (v.includes("."))
        return false; // dot notation — code like "eng.1"
    if (v.startsWith("0x"))
        return false; // hex address
    if (/\s/.test(v))
        return true; // spaces — definitely a name
    if (/^[A-Z]/.test(v))
        return true; // starts uppercase — proper noun
    // Hyphenated slugs like "premier-league" are valid IDs — only flag single long words
    if (v.length > 10 && /^[a-z]+$/.test(v))
        return true; // single long lowercase word (e.g. "liverpool")
    return false;
}
/**
 * Build a helpful suggestion for which lookup tool to call.
 */
function buildLookupSuggestion(sport, paramName) {
    if (paramName === "team_id") {
        return "Call ".concat(sport, "_search_team(query=\"<name>\") to find the correct team_id.");
    }
    if (paramName === "player_id" || paramName === "tm_player_id" || paramName === "fpl_id") {
        return "Call ".concat(sport, "_search_player(query=\"<name>\") to find the correct ").concat(paramName, ".");
    }
    if (paramName === "season_id") {
        return ("Call ".concat(sport, "_get_competitions to list competitions, then ") +
            "".concat(sport, "_get_competition_seasons to find the correct season_id."));
    }
    if (paramName === "competition_id") {
        return "Call ".concat(sport, "_get_competitions to find the correct competition_id.");
    }
    if (paramName === "event_id") {
        return "Call ".concat(sport, "_get_season_schedule or ").concat(sport, "_get_daily_schedule to find event IDs.");
    }
    return "Use a listing or search tool for \"".concat(sport, "\" to discover the correct ").concat(paramName, ".");
}
/**
 * Scan tool call input for _id parameters that look like guessed human names.
 * Returns an error message if a guessed ID is detected, null otherwise.
 */
function detectGuessedId(sport, input) {
    for (var _i = 0, _a = Object.entries(input); _i < _a.length; _i++) {
        var _b = _a[_i], key = _b[0], value = _b[1];
        if (!key.endsWith("_id") && !key.endsWith("_ids"))
            continue;
        var values = Array.isArray(value) ? value : [value];
        for (var _c = 0, values_1 = values; _c < values_1.length; _c++) {
            var v = values_1[_c];
            if (typeof v !== "string")
                continue;
            if (!looksLikeHumanName(v))
                continue;
            var suggestion = buildLookupSuggestion(sport, key.replace(/_ids$/, "_id"));
            return ("\"".concat(v, "\" looks like a name, not a valid ").concat(key, ". ") +
                "IDs are typically numeric (e.g. \"258\") or code-formatted (e.g. \"eng.1\"). " +
                suggestion);
        }
    }
    return null;
}
// ---------------------------------------------------------------------------
// Input validation
// ---------------------------------------------------------------------------
var SAFE_IDENTIFIER = /^[a-zA-Z0-9_-]+$/;
function validateIdentifier(value, label) {
    if (!SAFE_IDENTIFIER.test(value)) {
        return "Invalid ".concat(label, ": must contain only alphanumeric characters, underscores, and hyphens");
    }
    return null;
}
// ---------------------------------------------------------------------------
// Tool Registry — instance-level, not module singletons
// ---------------------------------------------------------------------------
/**
 * Instance-level tool registry. Each sportsclawEngine owns its own registry,
 * preventing shared mutable state when multiple engines run concurrently.
 */
var ToolRegistry = /** @class */ (function () {
    function ToolRegistry() {
        this.dynamicSpecs = [];
        this.routeMap = new Map();
        this.mcpSpecs = [];
        this.mcpRouteMap = new Map();
        this.mcpManager = null;
        this.cache = new Map();
        this.cacheHits = 0;
        this.cacheMisses = 0;
        this.cacheEnabled = true;
        this.cacheTtlMs = 300000; // 5 minutes default
    }
    /**
     * Configure cache settings. Must be called before any tool calls to take effect.
     */
    ToolRegistry.prototype.configureCaching = function (options) {
        if (options.enabled !== undefined) {
            this.cacheEnabled = options.enabled;
        }
        if (options.ttlMs !== undefined && options.ttlMs > 0) {
            this.cacheTtlMs = options.ttlMs;
        }
    };
    /**
     * Inject MCP tools into the registry. Called after McpManager.connectAll().
     */
    ToolRegistry.prototype.injectMcpTools = function (manager) {
        this.mcpManager = manager;
        this.mcpSpecs = manager.getToolSpecs();
        this.mcpRouteMap = manager.getRouteMap();
    };
    /**
     * Get cache statistics for debugging.
     */
    ToolRegistry.prototype.getCacheStats = function () {
        return {
            hits: this.cacheHits,
            misses: this.cacheMisses,
            size: this.cache.size,
        };
    };
    /**
     * Generate a cache key from tool name and sorted arguments.
     */
    ToolRegistry.prototype.generateCacheKey = function (toolName, input) {
        // Sort keys for consistent hashing
        var sortedArgs = Object.keys(input)
            .sort()
            .reduce(function (acc, key) {
            acc[key] = input[key];
            return acc;
        }, {});
        return "".concat(toolName, ":").concat(JSON.stringify(sortedArgs));
    };
    /**
     * Check if a tool is an internal (non-sport) tool.
     */
    ToolRegistry.prototype.isInternalTool = function (toolName) {
        return (toolName.startsWith("update_") ||
            toolName === "reflect" ||
            toolName === "evolve_strategy" ||
            toolName === "get_agent_config" ||
            toolName === "install_sport" ||
            toolName === "remove_sport" ||
            toolName === "upgrade_sports_skills");
    };
    /**
     * Internal tools should skip caching.
     */
    ToolRegistry.prototype.shouldSkipCache = function (toolName) {
        return this.isInternalTool(toolName);
    };
    /**
     * Inject a sport schema's tools into the dynamic registry.
     * Validates sport and command identifiers at injection time.
     */
    ToolRegistry.prototype.injectSchema = function (schema, allowTrading) {
        var _a, _b;
        var sportError = validateIdentifier(schema.sport, "sport");
        if (sportError) {
            console.error("[sportsclaw] skipping schema \"".concat(schema.sport, "\": ").concat(sportError));
            return;
        }
        var _loop_1 = function (tool) {
            var cmdError = validateIdentifier(tool.command, "command");
            if (cmdError) {
                console.error("[sportsclaw] skipping tool \"".concat(tool.name, "\": ").concat(cmdError));
                return "continue";
            }
            // Security: Skip blocked tools entirely — don't even expose them to the LLM
            var blockReason = (0, security_js_1.isBlockedTool)(tool.name, allowTrading);
            if (blockReason) {
                console.error("[sportsclaw] blocking tool \"".concat(tool.name, "\": trading operation"));
                return "continue";
            }
            var existingIdx = this_1.dynamicSpecs.findIndex(function (s) { return s.name === tool.name; });
            // Support both Vercel-compatible `parameters` and legacy `input_schema`
            var schemaObj = (_b = (_a = tool.parameters) !== null && _a !== void 0 ? _a : tool.input_schema) !== null && _b !== void 0 ? _b : {};
            var spec = {
                name: tool.name,
                description: tool.description,
                input_schema: schemaObj,
            };
            if (existingIdx >= 0) {
                this_1.dynamicSpecs[existingIdx] = spec;
            }
            else {
                this_1.dynamicSpecs.push(spec);
            }
            this_1.routeMap.set(tool.name, { sport: schema.sport, command: tool.command });
        };
        var this_1 = this;
        for (var _i = 0, _c = schema.tools; _i < _c.length; _i++) {
            var tool = _c[_i];
            _loop_1(tool);
        }
    };
    /** Clear all dynamically injected tools */
    ToolRegistry.prototype.clearDynamicTools = function () {
        this.dynamicSpecs.length = 0;
        this.routeMap.clear();
    };
    /**
     * Remove all tools belonging to a specific sport from the registry.
     * Used by the `remove_sport` internal tool for immediate unload.
     */
    ToolRegistry.prototype.removeSchemaTools = function (sport) {
        var removed = 0;
        var toRemove = [];
        for (var _i = 0, _a = this.routeMap.entries(); _i < _a.length; _i++) {
            var _b = _a[_i], toolName = _b[0], route = _b[1];
            if (route.sport === sport) {
                toRemove.push(toolName);
            }
        }
        var _loop_2 = function (toolName) {
            this_2.routeMap.delete(toolName);
            var idx = this_2.dynamicSpecs.findIndex(function (s) { return s.name === toolName; });
            if (idx >= 0) {
                this_2.dynamicSpecs.splice(idx, 1);
            }
            removed++;
        };
        var this_2 = this;
        for (var _c = 0, toRemove_1 = toRemove; _c < toRemove_1.length; _c++) {
            var toolName = toRemove_1[_c];
            _loop_2(toolName);
        }
        return removed;
    };
    /**
     * Get all tool specs.
     *
     * When dynamic schemas are loaded, prefer those sport-specific tools and
     * hide the legacy generic `sports_query` tool to reduce ambiguous routing.
     */
    ToolRegistry.prototype.getAllToolSpecs = function () {
        var base = this.dynamicSpecs.length > 0 ? __spreadArray([], this.dynamicSpecs, true) : __spreadArray([], exports.TOOL_SPECS, true);
        // Append MCP tools after Python bridge tools
        if (this.mcpSpecs.length > 0) {
            base.push.apply(base, this.mcpSpecs);
        }
        return base;
    };
    /** Get the dispatch route for a dynamically injected tool */
    ToolRegistry.prototype.getToolRoute = function (toolName) {
        return this.routeMap.get(toolName);
    };
    /** Get the skill (sport) name that owns a tool, if any */
    ToolRegistry.prototype.getSkillName = function (toolName) {
        var _a;
        return (_a = this.routeMap.get(toolName)) === null || _a === void 0 ? void 0 : _a.sport;
    };
    /** List installed dynamic skills (sports) currently available to the engine */
    ToolRegistry.prototype.getInstalledSkills = function () {
        var skills = new Set();
        for (var _i = 0, _a = this.routeMap.values(); _i < _a.length; _i++) {
            var route = _a[_i];
            skills.add(route.sport);
        }
        return Array.from(skills);
    };
    /**
     * Dispatch a tool call by name and return the structured result for the LLM.
     *
     * Handles both the built-in `sports_query` tool and any dynamically injected
     * tools from sport schemas.
     */
    ToolRegistry.prototype.dispatchToolCall = function (toolName, input, config) {
        return __awaiter(this, void 0, void 0, function () {
            var blockReason, cacheKey, cached, age, result, route, cacheKey;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        blockReason = (0, security_js_1.isBlockedTool)(toolName, config === null || config === void 0 ? void 0 : config.allowTrading);
                        if (blockReason) {
                            (0, security_js_1.logSecurityEvent)("blocked_tool", { toolName: toolName, input: input });
                            return [2 /*return*/, {
                                    content: JSON.stringify({
                                        error: blockReason,
                                        error_code: "blocked_tool",
                                        hint: "This tool is disabled for security reasons. sportsclaw is a read-only sports data agent.",
                                    }),
                                    isError: true,
                                }];
                        }
                        // Check cache if enabled and tool is cacheable
                        if (this.cacheEnabled && !this.shouldSkipCache(toolName)) {
                            cacheKey = this.generateCacheKey(toolName, input);
                            cached = this.cache.get(cacheKey);
                            if (cached) {
                                age = Date.now() - cached.timestamp;
                                if (age < this.cacheTtlMs) {
                                    this.cacheHits++;
                                    if (config === null || config === void 0 ? void 0 : config.verbose) {
                                        console.error("[sportsclaw] cache hit for ".concat(toolName, " (age: ").concat(Math.round(age / 1000), "s)"));
                                    }
                                    return [2 /*return*/, cached.result];
                                }
                                // Expired entry — remove it
                                this.cache.delete(cacheKey);
                            }
                            this.cacheMisses++;
                        }
                        if (!(toolName === "sports_query")) return [3 /*break*/, 2];
                        return [4 /*yield*/, this.handleSportsQuery(input, config)];
                    case 1:
                        result = _a.sent();
                        return [3 /*break*/, 7];
                    case 2:
                        if (!(this.mcpRouteMap.has(toolName) && this.mcpManager)) return [3 /*break*/, 4];
                        return [4 /*yield*/, this.mcpManager.callTool(toolName, input)];
                    case 3:
                        // MCP tool — dispatch via MCP client
                        result = _a.sent();
                        return [3 /*break*/, 7];
                    case 4:
                        route = this.routeMap.get(toolName);
                        if (!route) return [3 /*break*/, 6];
                        return [4 /*yield*/, this.handleDynamicTool(route.sport, route.command, input, config)];
                    case 5:
                        result = _a.sent();
                        return [3 /*break*/, 7];
                    case 6:
                        result = {
                            content: JSON.stringify({ error: "Unknown tool: ".concat(toolName) }),
                            isError: true,
                        };
                        _a.label = 7;
                    case 7:
                        // Store successful results in cache
                        if (this.cacheEnabled && !this.shouldSkipCache(toolName) && !result.isError) {
                            cacheKey = this.generateCacheKey(toolName, input);
                            this.cache.set(cacheKey, {
                                result: result,
                                timestamp: Date.now(),
                            });
                        }
                        return [2 /*return*/, result];
                }
            });
        });
    };
    // -------------------------------------------------------------------------
    // Private handlers
    // -------------------------------------------------------------------------
    ToolRegistry.prototype.buildBridgeErrorResult = function (result, sport, repairCmd) {
        var classified = classifyBridgeError(result.error, result.stderr);
        var hint;
        if (classified.errorCode === "dependency_missing") {
            hint = sport === "f1"
                ? "F1 support is unavailable. Repair with: ".concat(repairCmd)
                : "The sports-skills Python package may be missing. Install/repair with: ".concat(repairCmd);
        }
        else {
            hint = classified.hint;
        }
        return {
            content: JSON.stringify({
                error: result.error,
                error_code: classified.errorCode,
                stderr: result.stderr,
                hint: hint,
            }),
            isError: true,
        };
    };
    ToolRegistry.prototype.handleSportsQuery = function (input, config) {
        return __awaiter(this, void 0, void 0, function () {
            var pythonPath, repairCmd, sportError, cmdError, result;
            var _a;
            return __generator(this, function (_b) {
                switch (_b.label) {
                    case 0:
                        pythonPath = (_a = config === null || config === void 0 ? void 0 : config.pythonPath) !== null && _a !== void 0 ? _a : "python3";
                        repairCmd = (0, python_js_1.buildSportsSkillsRepairCommand)(pythonPath);
                        if (!input.sport || !input.command) {
                            return [2 /*return*/, {
                                    content: JSON.stringify({
                                        error: "Missing required parameters: sport and command",
                                    }),
                                    isError: true,
                                }];
                        }
                        sportError = validateIdentifier(input.sport, "sport");
                        if (sportError) {
                            return [2 /*return*/, {
                                    content: JSON.stringify({ error: sportError }),
                                    isError: true,
                                }];
                        }
                        cmdError = validateIdentifier(input.command, "command");
                        if (cmdError) {
                            return [2 /*return*/, {
                                    content: JSON.stringify({ error: cmdError }),
                                    isError: true,
                                }];
                        }
                        return [4 /*yield*/, executePythonBridge(input.sport, input.command, input.args, config)];
                    case 1:
                        result = _b.sent();
                        if (!result.success) {
                            return [2 /*return*/, this.buildBridgeErrorResult(result, input.sport, repairCmd)];
                        }
                        return [2 /*return*/, {
                                content: JSON.stringify(result.data),
                                isError: false,
                            }];
                }
            });
        });
    };
    ToolRegistry.prototype.handleDynamicTool = function (sport, command, input, config) {
        return __awaiter(this, void 0, void 0, function () {
            var pythonPath, repairCmd, idIssue, args, _i, _a, _b, key, value, result;
            var _c;
            return __generator(this, function (_d) {
                switch (_d.label) {
                    case 0:
                        pythonPath = (_c = config === null || config === void 0 ? void 0 : config.pythonPath) !== null && _c !== void 0 ? _c : "python3";
                        repairCmd = (0, python_js_1.buildSportsSkillsRepairCommand)(pythonPath);
                        idIssue = detectGuessedId(sport, input);
                        if (idIssue) {
                            return [2 /*return*/, { content: JSON.stringify({ error: idIssue }), isError: true }];
                        }
                        args = {};
                        for (_i = 0, _a = Object.entries(input); _i < _a.length; _i++) {
                            _b = _a[_i], key = _b[0], value = _b[1];
                            if (value !== undefined && value !== null) {
                                args[key] = value;
                            }
                        }
                        return [4 /*yield*/, executePythonBridge(sport, command, args, config)];
                    case 1:
                        result = _d.sent();
                        if (!result.success) {
                            return [2 /*return*/, this.buildBridgeErrorResult(result, sport, repairCmd)];
                        }
                        return [2 /*return*/, {
                                content: JSON.stringify(result.data),
                                isError: false,
                            }];
                }
            });
        });
    };
    return ToolRegistry;
}());
exports.ToolRegistry = ToolRegistry;
// ---------------------------------------------------------------------------
// Minimal env vars for the subprocess
// ---------------------------------------------------------------------------
function buildSubprocessEnv(extra) {
    // Inherit the full parent env — process.env already has ~/.sportsclaw/.env
    // loaded by applyConfigToEnv(), so all service credentials (POLYMARKET_*,
    // KALSHI_*, etc.) are available without hardcoding prefixes.
    var env = {};
    for (var _i = 0, _a = Object.entries(process.env); _i < _a.length; _i++) {
        var _b = _a[_i], key = _b[0], value = _b[1];
        if (value !== undefined)
            env[key] = value;
    }
    if (extra) {
        Object.assign(env, extra);
    }
    // Activate the managed venv for all subprocess calls
    if ((0, python_js_1.isVenvSetup)()) {
        var venvDir = (0, python_js_1.getVenvDir)();
        env.VIRTUAL_ENV = venvDir;
        var venvBin = venvDir + "/bin";
        env.PATH = env.PATH ? "".concat(venvBin, ":").concat(env.PATH) : venvBin;
    }
    return env;
}
// ---------------------------------------------------------------------------
// Python Subprocess Bridge
// ---------------------------------------------------------------------------
/**
 * Build the CLI arguments for invoking sports-skills.
 *
 * Invocation pattern:
 *   python3 -m sports_skills <sport> <command> [--key value ...]
 */
function buildArgs(sport, command, args) {
    var cliArgs = ["-m", "sports_skills", sport, command];
    if (args) {
        for (var _i = 0, _a = Object.entries(args); _i < _a.length; _i++) {
            var _b = _a[_i], key = _b[0], value = _b[1];
            if (value === undefined || value === null)
                continue;
            var keyError = validateIdentifier(key, "argument key");
            if (keyError)
                continue;
            if (typeof value === "boolean") {
                if (value)
                    cliArgs.push("--".concat(key));
            }
            else {
                var strValue = typeof value === "object" ? JSON.stringify(value) : String(value);
                cliArgs.push("--".concat(key, "=").concat(strValue));
            }
        }
    }
    return cliArgs;
}
/**
 * Execute a sports-skills command via an async child process.
 *
 * Returns a structured result with stdout parsed as JSON when possible.
 */
function executePythonBridge(sport, command, args, config) {
    var _this = this;
    var _a, _b;
    var pythonPath = (_a = config === null || config === void 0 ? void 0 : config.pythonPath) !== null && _a !== void 0 ? _a : "python3";
    var cliArgs = buildArgs(sport, command, args);
    var timeout = (_b = config === null || config === void 0 ? void 0 : config.timeout) !== null && _b !== void 0 ? _b : 60000;
    var retryTimeout = Math.max(timeout * 2, 90000);
    if (config === null || config === void 0 ? void 0 : config.verbose) {
        console.error("[sportsclaw] exec: ".concat(pythonPath, " ").concat(cliArgs.join(" ")));
    }
    var runOnce = function (attemptTimeout) {
        return new Promise(function (resolve) {
            (0, node_child_process_1.execFile)(pythonPath, cliArgs, {
                encoding: "utf-8",
                timeout: attemptTimeout,
                maxBuffer: 25 * 1024 * 1024, // 25 MB for verbose FastF1 stderr on degraded networks
                env: buildSubprocessEnv(config === null || config === void 0 ? void 0 : config.env),
            }, function (error, stdout, stderr) {
                if (error) {
                    var execErr = error;
                    var timedOut = /timed out/i.test(error.message) ||
                        (execErr.signal === "SIGTERM" && execErr.code === null);
                    resolve({
                        success: false,
                        error: error.message,
                        stdout: stdout || undefined,
                        stderr: stderr || undefined,
                        timedOut: timedOut,
                    });
                    return;
                }
                var trimmed = (stdout !== null && stdout !== void 0 ? stdout : "").trim();
                if (!trimmed) {
                    resolve({
                        success: true,
                        data: null,
                        stdout: "",
                    });
                    return;
                }
                try {
                    var data = JSON.parse(trimmed);
                    resolve({ success: true, data: data });
                }
                catch (_a) {
                    // Not JSON — return raw stdout
                    resolve({ success: true, data: trimmed, stdout: trimmed });
                }
            });
        });
    };
    return (function () { return __awaiter(_this, void 0, void 0, function () {
        var firstAttempt, secondTimeout, secondAttempt;
        var _a, _b, _c, _d;
        return __generator(this, function (_e) {
            switch (_e.label) {
                case 0: return [4 /*yield*/, runOnce(timeout)];
                case 1:
                    firstAttempt = _e.sent();
                    if (firstAttempt.success) {
                        return [2 /*return*/, firstAttempt];
                    }
                    // Retry once on any failure (timeout gets a longer window; transient
                    // errors like network blips / RSS parse failures get a second chance).
                    if (firstAttempt.timedOut) {
                        if (config === null || config === void 0 ? void 0 : config.verbose) {
                            console.error("[sportsclaw] exec timeout after ".concat(timeout, "ms; retrying with ").concat(retryTimeout, "ms"));
                        }
                    }
                    else if (config === null || config === void 0 ? void 0 : config.verbose) {
                        console.error("[sportsclaw] exec failed; retrying once: ".concat((_a = firstAttempt.error) === null || _a === void 0 ? void 0 : _a.slice(0, 120)));
                    }
                    secondTimeout = firstAttempt.timedOut ? retryTimeout : timeout;
                    return [4 /*yield*/, runOnce(secondTimeout)];
                case 2:
                    secondAttempt = _e.sent();
                    if (secondAttempt.success) {
                        return [2 /*return*/, secondAttempt];
                    }
                    // Preserve first error context so callers can surface the true cause.
                    return [2 /*return*/, __assign(__assign({}, secondAttempt), { error: firstAttempt.timedOut
                                ? "Command timed out after ".concat(timeout, "ms and retry after ").concat(retryTimeout, "ms failed. ") +
                                    "".concat((_c = (_b = secondAttempt.error) !== null && _b !== void 0 ? _b : firstAttempt.error) !== null && _c !== void 0 ? _c : "").trim()
                                : (_d = secondAttempt.error) !== null && _d !== void 0 ? _d : firstAttempt.error })];
            }
        });
    }); })();
}
