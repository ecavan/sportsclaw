"use strict";
/**
 * sportsclaw Engine — MCP Client Manager
 *
 * Connects to external MCP servers (e.g. Machina Core) via SSE/HTTP transport,
 * discovers their tools, and converts them to sportsclaw ToolSpec format.
 *
 * Configuration comes from:
 *   - Env var SPORTSCLAW_MCP_SERVERS (JSON)
 *   - Or a mcp.json file in the working directory
 *
 * Token resolution: if a server config has no auth header, the manager looks
 * for SPORTSCLAW_MCP_TOKEN_<SERVER_NAME_UPPER> in the environment.
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
exports.McpManager = void 0;
var index_js_1 = require("@modelcontextprotocol/sdk/client/index.js");
var sse_js_1 = require("@modelcontextprotocol/sdk/client/sse.js");
var streamableHttp_js_1 = require("@modelcontextprotocol/sdk/client/streamableHttp.js");
var node_fs_1 = require("node:fs");
// ---------------------------------------------------------------------------
// MCP Manager
// ---------------------------------------------------------------------------
var McpManager = /** @class */ (function () {
    function McpManager(verbose) {
        if (verbose === void 0) { verbose = false; }
        this.configs = {};
        this.connections = new Map();
        this.toolSpecs = [];
        /** Maps prefixed tool name → { serverName, originalToolName } */
        this.routeMap = new Map();
        this.verbose = verbose;
        this.configs = this.loadConfigs();
    }
    Object.defineProperty(McpManager.prototype, "serverCount", {
        /** Number of configured MCP servers */
        get: function () {
            return Object.keys(this.configs).length;
        },
        enumerable: false,
        configurable: true
    });
    // -------------------------------------------------------------------------
    // Config loading
    // -------------------------------------------------------------------------
    McpManager.prototype.loadConfigs = function () {
        // 1. Try env var first
        var envJson = process.env.SPORTSCLAW_MCP_SERVERS;
        if (envJson) {
            try {
                var parsed = JSON.parse(envJson);
                if (this.verbose) {
                    console.error("[sportsclaw] mcp: loaded ".concat(Object.keys(parsed).length, " server(s) from env"));
                }
                return this.resolveTokens(parsed);
            }
            catch (err) {
                console.error("[sportsclaw] mcp: invalid SPORTSCLAW_MCP_SERVERS JSON: ".concat(err instanceof Error ? err.message : err));
                return {};
            }
        }
        // 2. Try mcp.json file
        try {
            var raw = (0, node_fs_1.readFileSync)("mcp.json", "utf-8");
            var parsed = JSON.parse(raw);
            if (this.verbose) {
                console.error("[sportsclaw] mcp: loaded ".concat(Object.keys(parsed).length, " server(s) from mcp.json"));
            }
            return this.resolveTokens(parsed);
        }
        catch (_a) {
            // No mcp.json — that's fine
        }
        return {};
    };
    /**
     * For each server, if no auth headers are set, look for
     * SPORTSCLAW_MCP_TOKEN_<SERVER_NAME_UPPER> in env.
     */
    McpManager.prototype.resolveTokens = function (configs) {
        for (var _i = 0, _a = Object.entries(configs); _i < _a.length; _i++) {
            var _b = _a[_i], name_1 = _b[0], config = _b[1];
            var hasAuth = config.headers &&
                Object.keys(config.headers).some(function (h) { return h.toLowerCase() === "authorization" || h.toLowerCase() === "x-api-token"; });
            if (!hasAuth) {
                var envKey = "SPORTSCLAW_MCP_TOKEN_".concat(name_1.replace(/-/g, "_").toUpperCase());
                var token = process.env[envKey];
                if (token) {
                    config.headers = __assign(__assign({}, config.headers), { "X-Api-Token": token });
                    if (this.verbose) {
                        console.error("[sportsclaw] mcp: resolved token for \"".concat(name_1, "\" from ").concat(envKey));
                    }
                }
            }
        }
        return configs;
    };
    // -------------------------------------------------------------------------
    // Connection
    // -------------------------------------------------------------------------
    /** Connect to all configured MCP servers. Non-fatal: logs and skips failures. */
    McpManager.prototype.connectAll = function () {
        return __awaiter(this, void 0, void 0, function () {
            var entries, results, i, result, name_2;
            var _this = this;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        entries = Object.entries(this.configs);
                        if (entries.length === 0)
                            return [2 /*return*/];
                        return [4 /*yield*/, Promise.allSettled(entries.map(function (_a) {
                                var name = _a[0], config = _a[1];
                                return _this.connectOne(name, config);
                            }))];
                    case 1:
                        results = _a.sent();
                        for (i = 0; i < results.length; i++) {
                            result = results[i];
                            name_2 = entries[i][0];
                            if (result.status === "rejected") {
                                console.error("[sportsclaw] mcp: failed to connect to \"".concat(name_2, "\": ").concat(result.reason));
                            }
                        }
                        return [2 /*return*/];
                }
            });
        });
    };
    McpManager.prototype.connectOne = function (name, config) {
        return __awaiter(this, void 0, void 0, function () {
            var url, headers, isSseEndpoint, client, sseTransport, connected, transport, _a, sseTransport, allTools, allowSet, tools, filtered, _i, tools_1, tool, prefixedName, spec;
            var _b, _c, _d, _e;
            return __generator(this, function (_f) {
                switch (_f.label) {
                    case 0:
                        url = new URL(config.url);
                        headers = (_b = config.headers) !== null && _b !== void 0 ? _b : {};
                        isSseEndpoint = /\/sse\b/i.test(url.pathname);
                        if (!isSseEndpoint) return [3 /*break*/, 2];
                        // Skip StreamableHTTP entirely for known SSE endpoints
                        client = new index_js_1.Client({ name: "sportsclaw-".concat(name), version: "1.0.0" });
                        sseTransport = new sse_js_1.SSEClientTransport(url, {
                            requestInit: { headers: headers },
                            eventSourceInit: {
                                fetch: function (input, init) {
                                    return fetch(input, __assign(__assign({}, init), { headers: __assign(__assign({}, headers), init === null || init === void 0 ? void 0 : init.headers) }));
                                },
                            },
                        });
                        return [4 /*yield*/, client.connect(sseTransport)];
                    case 1:
                        _f.sent();
                        if (this.verbose) {
                            console.error("[sportsclaw] mcp: \"".concat(name, "\" connected via SSE"));
                        }
                        return [3 /*break*/, 8];
                    case 2:
                        connected = false;
                        client = new index_js_1.Client({ name: "sportsclaw-".concat(name), version: "1.0.0" });
                        _f.label = 3;
                    case 3:
                        _f.trys.push([3, 5, , 6]);
                        transport = new streamableHttp_js_1.StreamableHTTPClientTransport(url, {
                            requestInit: { headers: headers, signal: AbortSignal.timeout(5000) },
                        });
                        return [4 /*yield*/, client.connect(transport)];
                    case 4:
                        _f.sent();
                        connected = true;
                        if (this.verbose) {
                            console.error("[sportsclaw] mcp: \"".concat(name, "\" connected via StreamableHTTP"));
                        }
                        return [3 /*break*/, 6];
                    case 5:
                        _a = _f.sent();
                        // Fall back to SSE — need a fresh client after failed connect
                        client = new index_js_1.Client({ name: "sportsclaw-".concat(name), version: "1.0.0" });
                        return [3 /*break*/, 6];
                    case 6:
                        if (!!connected) return [3 /*break*/, 8];
                        sseTransport = new sse_js_1.SSEClientTransport(url, {
                            requestInit: { headers: headers },
                            eventSourceInit: {
                                fetch: function (input, init) {
                                    return fetch(input, __assign(__assign({}, init), { headers: __assign(__assign({}, headers), init === null || init === void 0 ? void 0 : init.headers) }));
                                },
                            },
                        });
                        return [4 /*yield*/, client.connect(sseTransport)];
                    case 7:
                        _f.sent();
                        if (this.verbose) {
                            console.error("[sportsclaw] mcp: \"".concat(name, "\" connected via SSE"));
                        }
                        _f.label = 8;
                    case 8:
                        this.connections.set(name, { client: client, serverName: name });
                        return [4 /*yield*/, client.listTools()];
                    case 9:
                        allTools = (_f.sent()).tools;
                        allowSet = ((_c = config.tools) === null || _c === void 0 ? void 0 : _c.length)
                            ? new Set(config.tools.map(function (t) { return t.trim(); }))
                            : null;
                        tools = allowSet
                            ? allTools.filter(function (t) { return allowSet.has(t.name); })
                            : allTools;
                        if (this.verbose) {
                            filtered = allowSet ? " (filtered from ".concat(allTools.length, ")") : "";
                            console.error("[sportsclaw] mcp: \"".concat(name, "\" has ").concat(tools.length, " tool(s)").concat(filtered, ": ").concat(tools.map(function (t) { return t.name; }).join(", ")));
                        }
                        for (_i = 0, tools_1 = tools; _i < tools_1.length; _i++) {
                            tool = tools_1[_i];
                            prefixedName = "mcp__".concat(name, "__").concat(tool.name);
                            spec = {
                                name: prefixedName,
                                description: (_d = tool.description) !== null && _d !== void 0 ? _d : "MCP tool: ".concat(tool.name, " (").concat(name, ")"),
                                input_schema: (_e = tool.inputSchema) !== null && _e !== void 0 ? _e : {
                                    type: "object",
                                    properties: {},
                                },
                            };
                            this.toolSpecs.push(spec);
                            this.routeMap.set(prefixedName, { serverName: name, toolName: tool.name });
                        }
                        return [2 /*return*/];
                }
            });
        });
    };
    // -------------------------------------------------------------------------
    // Tool access
    // -------------------------------------------------------------------------
    /** Get all discovered MCP tool specs (already prefixed with mcp__<server>__) */
    McpManager.prototype.getToolSpecs = function () {
        return __spreadArray([], this.toolSpecs, true);
    };
    /** Get the MCP route map for injection into ToolRegistry */
    McpManager.prototype.getRouteMap = function () {
        return new Map(this.routeMap);
    };
    /** Call an MCP tool by its prefixed name */
    McpManager.prototype.callTool = function (prefixedName, args) {
        return __awaiter(this, void 0, void 0, function () {
            var route, connection, result, contentBlocks, text, err_1;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        route = this.routeMap.get(prefixedName);
                        if (!route) {
                            return [2 /*return*/, {
                                    content: JSON.stringify({ error: "Unknown MCP tool: ".concat(prefixedName) }),
                                    isError: true,
                                }];
                        }
                        connection = this.connections.get(route.serverName);
                        if (!connection) {
                            return [2 /*return*/, {
                                    content: JSON.stringify({
                                        error: "MCP server \"".concat(route.serverName, "\" is not connected"),
                                    }),
                                    isError: true,
                                }];
                        }
                        _a.label = 1;
                    case 1:
                        _a.trys.push([1, 3, , 4]);
                        return [4 /*yield*/, connection.client.callTool({
                                name: route.toolName,
                                arguments: args,
                            })];
                    case 2:
                        result = _a.sent();
                        contentBlocks = result.content;
                        text = contentBlocks
                            .filter(function (c) { return c.type === "text" && c.text; })
                            .map(function (c) { return c.text; })
                            .join("\n");
                        return [2 /*return*/, {
                                content: text || JSON.stringify(result.content),
                                isError: result.isError === true,
                            }];
                    case 3:
                        err_1 = _a.sent();
                        return [2 /*return*/, {
                                content: JSON.stringify({
                                    error: "MCP tool call failed: ".concat(err_1 instanceof Error ? err_1.message : String(err_1)),
                                }),
                                isError: true,
                            }];
                    case 4: return [2 /*return*/];
                }
            });
        });
    };
    /** Disconnect all MCP clients */
    McpManager.prototype.disconnectAll = function () {
        return __awaiter(this, void 0, void 0, function () {
            var _i, _a, _b, name_3, conn, _c;
            return __generator(this, function (_d) {
                switch (_d.label) {
                    case 0:
                        _i = 0, _a = this.connections;
                        _d.label = 1;
                    case 1:
                        if (!(_i < _a.length)) return [3 /*break*/, 6];
                        _b = _a[_i], name_3 = _b[0], conn = _b[1];
                        _d.label = 2;
                    case 2:
                        _d.trys.push([2, 4, , 5]);
                        return [4 /*yield*/, conn.client.close()];
                    case 3:
                        _d.sent();
                        if (this.verbose) {
                            console.error("[sportsclaw] mcp: disconnected \"".concat(name_3, "\""));
                        }
                        return [3 /*break*/, 5];
                    case 4:
                        _c = _d.sent();
                        return [3 /*break*/, 5];
                    case 5:
                        _i++;
                        return [3 /*break*/, 1];
                    case 6:
                        this.connections.clear();
                        return [2 /*return*/];
                }
            });
        });
    };
    return McpManager;
}());
exports.McpManager = McpManager;
