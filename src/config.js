"use strict";
/**
 * sportsclaw Engine — Persistent CLI Configuration
 *
 * Reads/writes user config from ~/.sportsclaw/config.json.
 * Environment variables always override config file values.
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
exports.ASCII_LOGO = exports.PROVIDER_ENV = exports.ENV_PATH = exports.CONFIG_DIR = exports.SPORTS_SKILLS_DISCLAIMER = void 0;
exports.loadConfig = loadConfig;
exports.saveConfig = saveConfig;
exports.parseEnvFile = parseEnvFile;
exports.writeEnvVar = writeEnvVar;
exports.resolveConfig = resolveConfig;
exports.applyConfigToEnv = applyConfigToEnv;
exports.runConfigFlow = runConfigFlow;
exports.runChannelsFlow = runChannelsFlow;
exports.runSportSelectionFlow = runSportSelectionFlow;
var node_fs_1 = require("node:fs");
var node_os_1 = require("node:os");
var node_path_1 = require("node:path");
var picocolors_1 = require("picocolors");
var p = require("@clack/prompts");
var types_js_1 = require("./types.js");
var schema_js_1 = require("./schema.js");
var python_js_1 = require("./python.js");
// ---------------------------------------------------------------------------
// Config shape persisted to disk
// ---------------------------------------------------------------------------
exports.SPORTS_SKILLS_DISCLAIMER = "sportsclaw uses the open-source sports-skills package for live sports data.\n" +
    "sports-skills is provided \"as is\" for personal, non-commercial use.\n" +
    "You are solely responsible for how you use the data it provides.";
// ---------------------------------------------------------------------------
// Paths
// ---------------------------------------------------------------------------
exports.CONFIG_DIR = (0, node_path_1.join)((0, node_os_1.homedir)(), ".sportsclaw");
var CONFIG_PATH = (0, node_path_1.join)(exports.CONFIG_DIR, "config.json");
exports.ENV_PATH = (0, node_path_1.join)(exports.CONFIG_DIR, ".env");
// ---------------------------------------------------------------------------
// Provider ↔ API key env var mapping (duplicated here to avoid circular deps)
// ---------------------------------------------------------------------------
exports.PROVIDER_ENV = {
    anthropic: "ANTHROPIC_API_KEY",
    openai: "OPENAI_API_KEY",
    google: "GOOGLE_GENERATIVE_AI_API_KEY",
};
exports.ASCII_LOGO = "\n\u2588\u2588\u2588\u2588\u2588\u2588\u2588\u2557\u2588\u2588\u2588\u2588\u2588\u2588\u2557  \u2588\u2588\u2588\u2588\u2588\u2588\u2557 \u2588\u2588\u2588\u2588\u2588\u2588\u2557 \u2588\u2588\u2588\u2588\u2588\u2588\u2588\u2588\u2557\u2588\u2588\u2588\u2588\u2588\u2588\u2588\u2557 \u2588\u2588\u2588\u2588\u2588\u2588\u2557\u2588\u2588\u2557      \u2588\u2588\u2588\u2588\u2588\u2557 \u2588\u2588\u2557    \u2588\u2588\u2557\n\u2588\u2588\u2554\u2550\u2550\u2550\u2550\u255D\u2588\u2588\u2554\u2550\u2550\u2588\u2588\u2557\u2588\u2588\u2554\u2550\u2550\u2550\u2588\u2588\u2557\u2588\u2588\u2554\u2550\u2550\u2588\u2588\u2557\u255A\u2550\u2550\u2588\u2588\u2554\u2550\u2550\u255D\u2588\u2588\u2554\u2550\u2550\u2550\u2550\u255D\u2588\u2588\u2554\u2550\u2550\u2550\u2550\u255D\u2588\u2588\u2551     \u2588\u2588\u2554\u2550\u2550\u2588\u2588\u2557\u2588\u2588\u2551    \u2588\u2588\u2551\n\u2588\u2588\u2588\u2588\u2588\u2588\u2588\u2557\u2588\u2588\u2588\u2588\u2588\u2588\u2554\u255D\u2588\u2588\u2551   \u2588\u2588\u2551\u2588\u2588\u2588\u2588\u2588\u2588\u2554\u255D   \u2588\u2588\u2551   \u2588\u2588\u2588\u2588\u2588\u2588\u2588\u2557\u2588\u2588\u2551     \u2588\u2588\u2551     \u2588\u2588\u2588\u2588\u2588\u2588\u2588\u2551\u2588\u2588\u2551 \u2588\u2557 \u2588\u2588\u2551\n\u255A\u2550\u2550\u2550\u2550\u2588\u2588\u2551\u2588\u2588\u2554\u2550\u2550\u2550\u255D \u2588\u2588\u2551   \u2588\u2588\u2551\u2588\u2588\u2554\u2550\u2550\u2588\u2588\u2557   \u2588\u2588\u2551   \u255A\u2550\u2550\u2550\u2550\u2588\u2588\u2551\u2588\u2588\u2551     \u2588\u2588\u2551     \u2588\u2588\u2554\u2550\u2550\u2588\u2588\u2551\u2588\u2588\u2551\u2588\u2588\u2588\u2557\u2588\u2588\u2551\n\u2588\u2588\u2588\u2588\u2588\u2588\u2588\u2551\u2588\u2588\u2551     \u255A\u2588\u2588\u2588\u2588\u2588\u2588\u2554\u255D\u2588\u2588\u2551  \u2588\u2588\u2551   \u2588\u2588\u2551   \u2588\u2588\u2588\u2588\u2588\u2588\u2588\u2551\u255A\u2588\u2588\u2588\u2588\u2588\u2588\u2557\u2588\u2588\u2588\u2588\u2588\u2588\u2588\u2557\u2588\u2588\u2551  \u2588\u2588\u2551\u255A\u2588\u2588\u2588\u2554\u2588\u2588\u2588\u2554\u255D\n\u255A\u2550\u2550\u2550\u2550\u2550\u2550\u255D\u255A\u2550\u255D      \u255A\u2550\u2550\u2550\u2550\u2550\u255D \u255A\u2550\u255D  \u255A\u2550\u255D   \u255A\u2550\u255D   \u255A\u2550\u2550\u2550\u2550\u2550\u2550\u255D \u255A\u2550\u2550\u2550\u2550\u2550\u255D\u255A\u2550\u2550\u2550\u2550\u2550\u2550\u255D\u255A\u2550\u255D  \u255A\u2550\u255D \u255A\u2550\u2550\u255D\u255A\u2550\u2550\u255D\n";
// ---------------------------------------------------------------------------
// Read / Write
// ---------------------------------------------------------------------------
function loadConfig() {
    if (!(0, node_fs_1.existsSync)(CONFIG_PATH))
        return {};
    try {
        return JSON.parse((0, node_fs_1.readFileSync)(CONFIG_PATH, "utf-8"));
    }
    catch (_a) {
        return {};
    }
}
function saveConfig(config) {
    if (!(0, node_fs_1.existsSync)(exports.CONFIG_DIR)) {
        (0, node_fs_1.mkdirSync)(exports.CONFIG_DIR, { recursive: true });
    }
    (0, node_fs_1.writeFileSync)(CONFIG_PATH, JSON.stringify(config, null, 2) + "\n", "utf-8");
}
function firstEnv() {
    var keys = [];
    for (var _i = 0; _i < arguments.length; _i++) {
        keys[_i] = arguments[_i];
    }
    for (var _a = 0, keys_1 = keys; _a < keys_1.length; _a++) {
        var key = keys_1[_a];
        var value = process.env[key];
        if (value && value.trim().length > 0) {
            return value;
        }
    }
    return undefined;
}
function parsePositiveInt(value, fallback) {
    if (!value)
        return fallback;
    var parsed = Number.parseInt(value, 10);
    if (!Number.isFinite(parsed) || parsed <= 0)
        return fallback;
    return parsed;
}
var parseCommaList = function (raw) { return raw.split(",").map(function (s) { return s.trim(); }).filter(Boolean); };
/**
 * Parse all key-value pairs from a dotenv-style file.
 * Returns a record of key → value (empty values are omitted).
 */
function parseEnvFile(filePath) {
    if (!(0, node_fs_1.existsSync)(filePath))
        return {};
    try {
        var result = {};
        var content = (0, node_fs_1.readFileSync)(filePath, "utf-8");
        for (var _i = 0, _a = content.split("\n"); _i < _a.length; _i++) {
            var line = _a[_i];
            var trimmed = line.trim();
            if (!trimmed || trimmed.startsWith("#"))
                continue;
            var eqIdx = trimmed.indexOf("=");
            if (eqIdx < 0)
                continue;
            var k = trimmed.slice(0, eqIdx).trim();
            var v = trimmed.slice(eqIdx + 1).trim();
            if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) {
                v = v.slice(1, -1);
            }
            if (v)
                result[k] = v;
        }
        return result;
    }
    catch (_b) {
        return {};
    }
}
/**
 * Write or update a single key=value pair in a dotenv-style file.
 * Creates the file (and parent dirs) if it doesn't exist.
 * Replaces the line if the key already exists, appends otherwise.
 */
function writeEnvVar(filePath, key, value) {
    var dir = filePath.replace(/\/[^/]+$/, "");
    if (!(0, node_fs_1.existsSync)(dir))
        (0, node_fs_1.mkdirSync)(dir, { recursive: true });
    var lines = [];
    if ((0, node_fs_1.existsSync)(filePath)) {
        lines = (0, node_fs_1.readFileSync)(filePath, "utf-8").split("\n");
    }
    var prefix = "".concat(key, "=");
    var replaced = false;
    for (var i = 0; i < lines.length; i++) {
        if (lines[i].trimStart().startsWith(prefix)) {
            lines[i] = "".concat(key, "=").concat(value);
            replaced = true;
            break;
        }
    }
    if (!replaced) {
        // Remove trailing empty lines before appending
        while (lines.length > 0 && lines[lines.length - 1].trim() === "") {
            lines.pop();
        }
        lines.push("".concat(key, "=").concat(value));
    }
    (0, node_fs_1.writeFileSync)(filePath, lines.join("\n") + "\n", "utf-8");
}
/**
 * Read a token value from a dotenv-style file (KEY=VALUE format).
 * Returns the value for the given key, or undefined if not found.
 */
function readEnvFile(filePath, key) {
    return parseEnvFile(filePath)[key];
}
function resolveConfig() {
    var _a, _b, _c, _d, _e, _f, _g, _h, _j, _k, _l, _m;
    var file = loadConfig();
    var provider = (firstEnv("SPORTSCLAW_PROVIDER", "sportsclaw_PROVIDER") ||
        file.provider ||
        "anthropic");
    var envVar = exports.PROVIDER_ENV[provider];
    var model = firstEnv("SPORTSCLAW_MODEL", "sportsclaw_MODEL") ||
        file.model ||
        types_js_1.DEFAULT_MODELS[provider];
    // env var > config-file apiKey (only if provider matches)
    var apiKey = process.env[envVar] || file.apiKey;
    var defaultPythonPath = (0, node_fs_1.existsSync)("/opt/homebrew/bin/python3")
        ? "/opt/homebrew/bin/python3"
        : "python3";
    var configuredPython = firstEnv("PYTHON_PATH") || file.pythonPath;
    // Resolution order: env/config > managed venv > Homebrew auto-detect > "python3"
    var pythonPath = configuredPython && configuredPython !== "python3"
        ? configuredPython
        : (0, python_js_1.isVenvSetup)()
            ? (0, python_js_1.getVenvPythonPath)()
            : defaultPythonPath;
    var routingMode = "soft_lock";
    var routingMaxSkills = parsePositiveInt((_a = firstEnv("SPORTSCLAW_ROUTING_MAX_SKILLS", "sportsclaw_ROUTING_MAX_SKILLS")) !== null && _a !== void 0 ? _a : (typeof file.routingMaxSkills === "number"
        ? String(file.routingMaxSkills)
        : undefined), 2);
    var routingAllowSpillover = parsePositiveInt((_b = firstEnv("SPORTSCLAW_ROUTING_ALLOW_SPILLOVER", "sportsclaw_ROUTING_ALLOW_SPILLOVER")) !== null && _b !== void 0 ? _b : (typeof file.routingAllowSpillover === "number"
        ? String(file.routingAllowSpillover)
        : undefined), 1);
    var discordBotToken = firstEnv("DISCORD_BOT_TOKEN") || ((_d = (_c = file.chatIntegrations) === null || _c === void 0 ? void 0 : _c.discord) === null || _d === void 0 ? void 0 : _d.botToken);
    var discordAllowedUsersRaw = firstEnv("ALLOWED_USERS");
    var discordAllowedUsers = discordAllowedUsersRaw
        ? parseCommaList(discordAllowedUsersRaw)
        : (_f = (_e = file.chatIntegrations) === null || _e === void 0 ? void 0 : _e.discord) === null || _f === void 0 ? void 0 : _f.allowedUsers;
    var discordPrefix = firstEnv("DISCORD_PREFIX") || ((_h = (_g = file.chatIntegrations) === null || _g === void 0 ? void 0 : _g.discord) === null || _h === void 0 ? void 0 : _h.prefix) || "!sportsclaw";
    // Telegram: env var (incl. ~/.sportsclaw/.env) > config file
    var telegramBotToken = firstEnv("TELEGRAM_BOT_TOKEN") ||
        ((_k = (_j = file.chatIntegrations) === null || _j === void 0 ? void 0 : _j.telegram) === null || _k === void 0 ? void 0 : _k.botToken);
    var telegramAllowedUsersRaw = firstEnv("TELEGRAM_ALLOWED_USERS");
    var telegramAllowedUsers = telegramAllowedUsersRaw
        ? parseCommaList(telegramAllowedUsersRaw)
        : (_m = (_l = file.chatIntegrations) === null || _l === void 0 ? void 0 : _l.telegram) === null || _m === void 0 ? void 0 : _m.allowedUsers;
    return {
        provider: provider,
        model: model,
        apiKey: apiKey,
        pythonPath: pythonPath,
        routingMode: routingMode,
        routingMaxSkills: routingMaxSkills,
        routingAllowSpillover: routingAllowSpillover,
        discordBotToken: discordBotToken,
        discordAllowedUsers: discordAllowedUsers,
        discordPrefix: discordPrefix,
        telegramBotToken: telegramBotToken,
        telegramAllowedUsers: telegramAllowedUsers,
    };
}
/**
 * Load all key-value pairs from a dotenv-style file into process.env.
 * Existing env vars are NOT overwritten (env always wins).
 */
function loadEnvFile(filePath) {
    for (var _i = 0, _a = Object.entries(parseEnvFile(filePath)); _i < _a.length; _i++) {
        var _b = _a[_i], k = _b[0], v = _b[1];
        if (!process.env[k])
            process.env[k] = v;
    }
}
/**
 * Apply saved config into process.env so downstream code (engine, listeners)
 * picks it up transparently. Env vars already set take precedence.
 */
function applyConfigToEnv() {
    var _a, _b;
    // Load ~/.sportsclaw/.env first (user secrets, wallet addresses, etc.)
    loadEnvFile(exports.ENV_PATH);
    var resolved = resolveConfig();
    var envVar = exports.PROVIDER_ENV[resolved.provider];
    if (resolved.apiKey && !process.env[envVar]) {
        process.env[envVar] = resolved.apiKey;
    }
    var envMap = {
        SPORTSCLAW_MODEL: resolved.model,
        SPORTSCLAW_PROVIDER: resolved.provider,
        SPORTSCLAW_ROUTING_MODE: resolved.routingMode,
        SPORTSCLAW_ROUTING_MAX_SKILLS: String(resolved.routingMaxSkills),
        SPORTSCLAW_ROUTING_ALLOW_SPILLOVER: String(resolved.routingAllowSpillover),
    };
    for (var _i = 0, _c = Object.entries(envMap); _i < _c.length; _i++) {
        var _d = _c[_i], key = _d[0], value = _d[1];
        if (value && !process.env[key])
            process.env[key] = value;
    }
    if (!process.env.PYTHON_PATH && resolved.pythonPath !== "python3") {
        process.env.PYTHON_PATH = resolved.pythonPath;
    }
    if (resolved.discordBotToken && !process.env.DISCORD_BOT_TOKEN)
        process.env.DISCORD_BOT_TOKEN = resolved.discordBotToken;
    if (((_a = resolved.discordAllowedUsers) === null || _a === void 0 ? void 0 : _a.length) && !process.env.ALLOWED_USERS)
        process.env.ALLOWED_USERS = resolved.discordAllowedUsers.join(",");
    if (resolved.discordPrefix && !process.env.DISCORD_PREFIX)
        process.env.DISCORD_PREFIX = resolved.discordPrefix;
    if (resolved.telegramBotToken && !process.env.TELEGRAM_BOT_TOKEN)
        process.env.TELEGRAM_BOT_TOKEN = resolved.telegramBotToken;
    if (((_b = resolved.telegramAllowedUsers) === null || _b === void 0 ? void 0 : _b.length) && !process.env.TELEGRAM_ALLOWED_USERS)
        process.env.TELEGRAM_ALLOWED_USERS = resolved.telegramAllowedUsers.join(",");
    return resolved;
}
// ---------------------------------------------------------------------------
// Interactive setup via @clack/prompts
// ---------------------------------------------------------------------------
function runConfigFlow() {
    return __awaiter(this, void 0, void 0, function () {
        function hasApiKey(prov) {
            if (process.env[exports.PROVIDER_ENV[prov]])
                return true;
            if (savedConfig.provider === prov && savedConfig.apiKey)
                return true;
            return false;
        }
        var savedConfig, provider, model, selectedProvider, envName, existingKey, finalApiKey, apiKey, detectedPython, os, hb, installHb, s, hbResult, mgr, installPy, s, pyResult, mgr, installPy, s, pyResult, pythonDefault, pythonPath, pyCheck, existingSchemas, sportSelections, reconfigure, selections, selections, discordConfig, configureDiscord, existingDiscordToken, discordToken, tokenInput, existingAllowed, allowedUsersInput, allowedUsers, existingPrefix, prefixInput, existingTelegram, chatIntegrations, config, resolvedPython;
        var _a, _b, _c, _d, _e, _f, _g, _h, _j, _k, _l, _m, _o, _p;
        return __generator(this, function (_q) {
            switch (_q.label) {
                case 0:
                    console.log(picocolors_1.default.bold(picocolors_1.default.blue(exports.ASCII_LOGO)));
                    p.intro("🦞 sportsclaw Configuration");
                    savedConfig = loadConfig();
                    return [4 /*yield*/, p.select({
                            message: "⚡ Which LLM provider would you like to use?",
                            options: [
                                { value: "anthropic", label: "Anthropic", hint: hasApiKey("anthropic") ? "Claude · authenticated" : "Claude" },
                                { value: "openai", label: "OpenAI", hint: hasApiKey("openai") ? "GPT · authenticated" : "GPT" },
                                { value: "google", label: "Google", hint: hasApiKey("google") ? "Gemini · authenticated" : "Gemini" },
                            ],
                        })];
                case 1:
                    provider = _q.sent();
                    if (p.isCancel(provider)) {
                        p.cancel("🚫 Setup cancelled.");
                        process.exit(0);
                    }
                    return [4 /*yield*/, p.select({
                            message: "🧠 Which model?",
                            options: (_b = (_a = types_js_1.PROVIDER_MODEL_PROFILES[provider]) === null || _a === void 0 ? void 0 : _a.selectableModels) !== null && _b !== void 0 ? _b : [],
                        })];
                case 2:
                    model = _q.sent();
                    if (p.isCancel(model)) {
                        p.cancel("🚫 Setup cancelled.");
                        process.exit(0);
                    }
                    selectedProvider = provider;
                    envName = exports.PROVIDER_ENV[selectedProvider];
                    existingKey = process.env[exports.PROVIDER_ENV[selectedProvider]]
                        || (savedConfig.provider === selectedProvider ? savedConfig.apiKey : undefined);
                    if (!(existingKey && existingKey.trim().length > 0)) return [3 /*break*/, 3];
                    p.log.info("Using existing ".concat(envName, " (already configured)."));
                    finalApiKey = existingKey.trim();
                    return [3 /*break*/, 5];
                case 3: return [4 /*yield*/, p.password({
                        message: "\uD83D\uDD11 Paste your ".concat(envName, ":"),
                        validate: function (val) {
                            if (!val || val.trim().length === 0)
                                return "API key is required.";
                        },
                    })];
                case 4:
                    apiKey = _q.sent();
                    if (p.isCancel(apiKey)) {
                        p.cancel("🚫 Setup cancelled.");
                        process.exit(0);
                    }
                    finalApiKey = apiKey.trim();
                    _q.label = 5;
                case 5:
                    detectedPython = (0, python_js_1.findBestPython)();
                    if (!detectedPython) return [3 /*break*/, 6];
                    p.log.success("Python ".concat(detectedPython.version.version, " detected at ").concat(detectedPython.path));
                    return [3 /*break*/, 17];
                case 6:
                    p.log.warn("Python ".concat(python_js_1.MIN_PYTHON_VERSION.major, ".").concat(python_js_1.MIN_PYTHON_VERSION.minor, "+ not detected on this system."));
                    return [4 /*yield*/, Promise.resolve().then(function () { return require("node:os"); })];
                case 7:
                    os = (_q.sent()).platform();
                    if (!(os === "darwin")) return [3 /*break*/, 13];
                    hb = (0, python_js_1.detectHomebrew)();
                    if (!!hb.installed) return [3 /*break*/, 9];
                    return [4 /*yield*/, p.confirm({
                            message: "Homebrew is not installed. Install it now? (needed for Python)",
                            initialValue: true,
                        })];
                case 8:
                    installHb = _q.sent();
                    if (p.isCancel(installHb)) {
                        p.cancel("🚫 Setup cancelled.");
                        process.exit(0);
                    }
                    if (installHb) {
                        s = p.spinner();
                        s.start("Installing Homebrew...");
                        hbResult = (0, python_js_1.installHomebrew)();
                        if (hbResult.ok) {
                            s.stop("Homebrew installed.");
                        }
                        else {
                            s.stop("Homebrew installation failed.");
                            p.log.error((_c = hbResult.error) !== null && _c !== void 0 ? _c : "Unknown error");
                            p.log.info('Install manually: /bin/bash -c "$(curl -fsSL https://raw.githubusercontent.com/Homebrew/install/HEAD/install.sh)"');
                        }
                    }
                    else {
                        p.log.info('Install Homebrew manually: /bin/bash -c "$(curl -fsSL https://raw.githubusercontent.com/Homebrew/install/HEAD/install.sh)"');
                    }
                    _q.label = 9;
                case 9:
                    // Check again after potential Homebrew install
                    detectedPython = (0, python_js_1.findBestPython)();
                    if (!!detectedPython) return [3 /*break*/, 12];
                    mgr = (0, python_js_1.detectPlatformPackageManager)();
                    if (!(mgr === "brew")) return [3 /*break*/, 11];
                    return [4 /*yield*/, p.confirm({
                            message: "Python 3.10+ not found. Install Python 3.12 via Homebrew?",
                            initialValue: true,
                        })];
                case 10:
                    installPy = _q.sent();
                    if (p.isCancel(installPy)) {
                        p.cancel("🚫 Setup cancelled.");
                        process.exit(0);
                    }
                    if (installPy) {
                        s = p.spinner();
                        s.start("Installing Python 3.12 via Homebrew...");
                        pyResult = (0, python_js_1.installPythonViaPackageManager)("brew");
                        if (pyResult.ok) {
                            s.stop("Python installed via Homebrew.");
                        }
                        else {
                            s.stop("Python installation failed.");
                            p.log.error((_d = pyResult.error) !== null && _d !== void 0 ? _d : "Unknown error");
                            p.log.info("Install manually: brew install python@3.12");
                        }
                    }
                    else {
                        p.log.info("Install manually: brew install python@3.12");
                    }
                    return [3 /*break*/, 12];
                case 11:
                    p.log.info("Install Python 3.10+ manually (e.g. brew install python@3.12) and re-run config.");
                    _q.label = 12;
                case 12: return [3 /*break*/, 16];
                case 13:
                    mgr = (0, python_js_1.detectPlatformPackageManager)();
                    if (!mgr) return [3 /*break*/, 15];
                    return [4 /*yield*/, p.confirm({
                            message: "Python 3.10+ not found. Install via ".concat(mgr, "?"),
                            initialValue: true,
                        })];
                case 14:
                    installPy = _q.sent();
                    if (p.isCancel(installPy)) {
                        p.cancel("🚫 Setup cancelled.");
                        process.exit(0);
                    }
                    if (installPy) {
                        s = p.spinner();
                        s.start("Installing Python via ".concat(mgr, "..."));
                        pyResult = (0, python_js_1.installPythonViaPackageManager)(mgr);
                        if (pyResult.ok) {
                            s.stop("Python installed via ".concat(mgr, "."));
                        }
                        else {
                            s.stop("Python installation failed.");
                            p.log.error((_e = pyResult.error) !== null && _e !== void 0 ? _e : "Unknown error");
                        }
                    }
                    return [3 /*break*/, 16];
                case 15:
                    p.log.info("Install Python 3.10+ using your system package manager and re-run config.");
                    _q.label = 16;
                case 16:
                    // Re-detect after install attempts
                    detectedPython = (0, python_js_1.findBestPython)();
                    if (detectedPython) {
                        p.log.success("Python ".concat(detectedPython.version.version, " installed at ").concat(detectedPython.path));
                    }
                    _q.label = 17;
                case 17:
                    pythonDefault = (_f = detectedPython === null || detectedPython === void 0 ? void 0 : detectedPython.path) !== null && _f !== void 0 ? _f : ((0, node_fs_1.existsSync)("/opt/homebrew/bin/python3") ? "/opt/homebrew/bin/python3" : "python3");
                    return [4 /*yield*/, p.text({
                            message: "🐍 Path to Python interpreter:",
                            placeholder: "python3",
                            defaultValue: pythonDefault,
                        })];
                case 18:
                    pythonPath = _q.sent();
                    if (p.isCancel(pythonPath)) {
                        p.cancel("🚫 Setup cancelled.");
                        process.exit(0);
                    }
                    pyCheck = (0, python_js_1.checkPythonVersion)(pythonPath || "python3");
                    if (pyCheck.ok) {
                        p.log.success("Python ".concat(pyCheck.version, " OK"));
                    }
                    else if (pyCheck.version) {
                        p.log.error("Python ".concat(pyCheck.version, " is too old. v").concat(python_js_1.MIN_PYTHON_VERSION.major, ".").concat(python_js_1.MIN_PYTHON_VERSION.minor, "+ is required."));
                        p.log.info("Install a newer Python and re-run: sportsclaw config");
                        process.exit(1);
                    }
                    else {
                        p.log.warn("Could not verify Python version at \"".concat(pythonPath || "python3", "\". Proceeding anyway."));
                    }
                    existingSchemas = (0, schema_js_1.listSchemas)();
                    if (!(existingSchemas.length > 0)) return [3 /*break*/, 22];
                    p.log.info("".concat(existingSchemas.length, " sport schema(s) already installed: ").concat(existingSchemas.join(", ")));
                    return [4 /*yield*/, p.confirm({
                            message: "Reconfigure installed sports?",
                            initialValue: false,
                        })];
                case 19:
                    reconfigure = _q.sent();
                    if (p.isCancel(reconfigure)) {
                        p.cancel("🚫 Setup cancelled.");
                        process.exit(0);
                    }
                    if (!reconfigure) return [3 /*break*/, 21];
                    p.log.warn(exports.SPORTS_SKILLS_DISCLAIMER);
                    return [4 /*yield*/, promptSportSelection()];
                case 20:
                    selections = _q.sent();
                    if (p.isCancel(selections)) {
                        p.cancel("🚫 Setup cancelled.");
                        process.exit(0);
                    }
                    sportSelections = selections;
                    _q.label = 21;
                case 21: return [3 /*break*/, 24];
                case 22:
                    p.log.warn(exports.SPORTS_SKILLS_DISCLAIMER);
                    return [4 /*yield*/, promptSportSelection()];
                case 23:
                    selections = _q.sent();
                    if (p.isCancel(selections)) {
                        p.cancel("🚫 Setup cancelled.");
                        process.exit(0);
                    }
                    sportSelections = selections;
                    _q.label = 24;
                case 24: return [4 /*yield*/, p.confirm({
                        message: "🤖 Configure Discord bot integration? (optional)",
                        initialValue: false,
                    })];
                case 25:
                    configureDiscord = _q.sent();
                    if (!(!p.isCancel(configureDiscord) && configureDiscord)) return [3 /*break*/, 31];
                    existingDiscordToken = (_h = (_g = savedConfig.chatIntegrations) === null || _g === void 0 ? void 0 : _g.discord) === null || _h === void 0 ? void 0 : _h.botToken;
                    discordToken = void 0;
                    if (!(existingDiscordToken && existingDiscordToken.trim().length > 0)) return [3 /*break*/, 26];
                    p.log.info("Using existing Discord bot token (already configured).");
                    discordToken = existingDiscordToken.trim();
                    return [3 /*break*/, 28];
                case 26: return [4 /*yield*/, p.password({
                        message: "🔑 Paste your Discord bot token:",
                        validate: function (val) {
                            if (!val || val.trim().length === 0)
                                return "Bot token is required.";
                        },
                    })];
                case 27:
                    tokenInput = _q.sent();
                    if (p.isCancel(tokenInput)) {
                        p.cancel("🚫 Setup cancelled.");
                        process.exit(0);
                    }
                    discordToken = tokenInput.trim();
                    _q.label = 28;
                case 28:
                    existingAllowed = (_k = (_j = savedConfig.chatIntegrations) === null || _j === void 0 ? void 0 : _j.discord) === null || _k === void 0 ? void 0 : _k.allowedUsers;
                    return [4 /*yield*/, p.text({
                            message: "👥 Allowed Discord user IDs (comma-separated, or blank to let anyone chat):",
                            placeholder: "Leave blank for public access",
                            defaultValue: (_l = existingAllowed === null || existingAllowed === void 0 ? void 0 : existingAllowed.join(",")) !== null && _l !== void 0 ? _l : "",
                        })];
                case 29:
                    allowedUsersInput = _q.sent();
                    if (p.isCancel(allowedUsersInput)) {
                        p.cancel("🚫 Setup cancelled.");
                        process.exit(0);
                    }
                    allowedUsers = parseCommaList(allowedUsersInput);
                    existingPrefix = (_o = (_m = savedConfig.chatIntegrations) === null || _m === void 0 ? void 0 : _m.discord) === null || _o === void 0 ? void 0 : _o.prefix;
                    return [4 /*yield*/, p.text({
                            message: "💬 Command prefix:",
                            placeholder: "!sportsclaw",
                            defaultValue: existingPrefix || "!sportsclaw",
                        })];
                case 30:
                    prefixInput = _q.sent();
                    if (p.isCancel(prefixInput)) {
                        p.cancel("🚫 Setup cancelled.");
                        process.exit(0);
                    }
                    discordConfig = __assign(__assign({ botToken: discordToken }, (allowedUsers.length > 0 && { allowedUsers: allowedUsers })), { prefix: prefixInput || "!sportsclaw" });
                    _q.label = 31;
                case 31:
                    existingTelegram = (_p = savedConfig.chatIntegrations) === null || _p === void 0 ? void 0 : _p.telegram;
                    chatIntegrations = __assign(__assign({}, (discordConfig && { discord: discordConfig })), (existingTelegram && { telegram: existingTelegram }));
                    config = __assign(__assign({ provider: selectedProvider, model: model, apiKey: finalApiKey, pythonPath: pythonPath || "python3" }, (sportSelections && { selectedSports: sportSelections })), (Object.keys(chatIntegrations).length > 0 && { chatIntegrations: chatIntegrations }));
                    saveConfig(config);
                    p.outro("\u2705 Config saved to ".concat(CONFIG_PATH));
                    if (!sportSelections) return [3 /*break*/, 33];
                    resolvedPython = config.pythonPath || "python3";
                    return [4 /*yield*/, installSelectedSports(sportSelections, resolvedPython)];
                case 32:
                    _q.sent();
                    _q.label = 33;
                case 33:
                    // Post-config usage guide
                    console.log("");
                    console.log(picocolors_1.default.bold("You're all set! Here's how to get started:"));
                    console.log("");
                    console.log("  ".concat(picocolors_1.default.cyan("sportsclaw chat"), "              Start an interactive session"));
                    console.log("  ".concat(picocolors_1.default.cyan('sportsclaw "your question"'), "   One-shot query"));
                    console.log("  ".concat(picocolors_1.default.cyan("sportsclaw add <sport>"), "       Install more sports"));
                    console.log("  ".concat(picocolors_1.default.cyan("sportsclaw list"), "              See installed sports"));
                    console.log("  ".concat(picocolors_1.default.cyan("sportsclaw agents"), "            See installed agents"));
                    console.log("  ".concat(picocolors_1.default.cyan("sportsclaw config"), "            Reconfigure anytime"));
                    console.log("  ".concat(picocolors_1.default.cyan("sportsclaw channels"), "          Set up Discord & Telegram tokens"));
                    if (discordConfig === null || discordConfig === void 0 ? void 0 : discordConfig.botToken) {
                        console.log("  ".concat(picocolors_1.default.cyan("sportsclaw listen discord"), "    Start Discord bot"));
                    }
                    if (existingTelegram === null || existingTelegram === void 0 ? void 0 : existingTelegram.botToken) {
                        console.log("  ".concat(picocolors_1.default.cyan("sportsclaw listen telegram"), "   Start Telegram bot"));
                    }
                    console.log("");
                    return [2 /*return*/, config];
            }
        });
    });
}
// ---------------------------------------------------------------------------
// CLI: `sportsclaw channels` — channel token wizard
// ---------------------------------------------------------------------------
/**
 * Interactive wizard to configure Discord and Telegram tokens.
 * Saves tokens into ~/.sportsclaw/config.json under chatIntegrations.
 */
function runChannelsFlow() {
    return __awaiter(this, void 0, void 0, function () {
        var savedConfig, existingDiscord, existingTelegram, discordStatus, telegramStatus, configureDiscord, discordConfig, masked, tokenInput, allowedUsersInput, allowedUsers, prefixInput, configureTelegram, telegramConfig, masked, tokenInput, allowedUsersInput, allowedUsers, chatIntegrations, updatedConfig;
        var _a, _b, _c, _d, _e, _f;
        return __generator(this, function (_g) {
            switch (_g.label) {
                case 0:
                    console.log(picocolors_1.default.bold(picocolors_1.default.blue(exports.ASCII_LOGO)));
                    p.intro("Channel Configuration");
                    savedConfig = loadConfig();
                    existingDiscord = (_a = savedConfig.chatIntegrations) === null || _a === void 0 ? void 0 : _a.discord;
                    existingTelegram = (_b = savedConfig.chatIntegrations) === null || _b === void 0 ? void 0 : _b.telegram;
                    discordStatus = (existingDiscord === null || existingDiscord === void 0 ? void 0 : existingDiscord.botToken)
                        ? picocolors_1.default.green("configured")
                        : firstEnv("DISCORD_BOT_TOKEN")
                            ? picocolors_1.default.green("set via env")
                            : picocolors_1.default.dim("not configured");
                    telegramStatus = (existingTelegram === null || existingTelegram === void 0 ? void 0 : existingTelegram.botToken)
                        ? picocolors_1.default.green("configured")
                        : firstEnv("TELEGRAM_BOT_TOKEN")
                            ? picocolors_1.default.green("set via env/.env")
                            : picocolors_1.default.dim("not configured");
                    p.log.info("Discord:  ".concat(discordStatus));
                    p.log.info("Telegram: ".concat(telegramStatus));
                    return [4 /*yield*/, p.confirm({
                            message: "Configure Discord bot token?",
                            initialValue: !(existingDiscord === null || existingDiscord === void 0 ? void 0 : existingDiscord.botToken),
                        })];
                case 1:
                    configureDiscord = _g.sent();
                    discordConfig = existingDiscord;
                    if (!(!p.isCancel(configureDiscord) && configureDiscord)) return [3 /*break*/, 5];
                    if (existingDiscord === null || existingDiscord === void 0 ? void 0 : existingDiscord.botToken) {
                        masked = existingDiscord.botToken.slice(0, 8) + "..." + existingDiscord.botToken.slice(-4);
                        p.log.info("Current token: ".concat(picocolors_1.default.dim(masked)));
                    }
                    return [4 /*yield*/, p.password({
                            message: "Paste your Discord bot token:",
                            validate: function (val) {
                                if (!val || val.trim().length === 0)
                                    return "Bot token is required.";
                            },
                        })];
                case 2:
                    tokenInput = _g.sent();
                    if (p.isCancel(tokenInput)) {
                        p.cancel("Setup cancelled.");
                        process.exit(0);
                    }
                    return [4 /*yield*/, p.text({
                            message: "Allowed Discord user IDs (comma-separated, blank for public):",
                            placeholder: "Leave blank for public access",
                            defaultValue: (_d = (_c = existingDiscord === null || existingDiscord === void 0 ? void 0 : existingDiscord.allowedUsers) === null || _c === void 0 ? void 0 : _c.join(",")) !== null && _d !== void 0 ? _d : "",
                        })];
                case 3:
                    allowedUsersInput = _g.sent();
                    if (p.isCancel(allowedUsersInput)) {
                        p.cancel("Setup cancelled.");
                        process.exit(0);
                    }
                    allowedUsers = parseCommaList(allowedUsersInput);
                    return [4 /*yield*/, p.text({
                            message: "Command prefix:",
                            placeholder: "!sportsclaw",
                            defaultValue: (existingDiscord === null || existingDiscord === void 0 ? void 0 : existingDiscord.prefix) || "!sportsclaw",
                        })];
                case 4:
                    prefixInput = _g.sent();
                    if (p.isCancel(prefixInput)) {
                        p.cancel("Setup cancelled.");
                        process.exit(0);
                    }
                    discordConfig = __assign(__assign(__assign(__assign({ botToken: tokenInput.trim() }, (allowedUsers.length > 0 && { allowedUsers: allowedUsers })), { prefix: prefixInput || "!sportsclaw" }), ((existingDiscord === null || existingDiscord === void 0 ? void 0 : existingDiscord.features) && { features: existingDiscord.features })), ((existingDiscord === null || existingDiscord === void 0 ? void 0 : existingDiscord.channels) && { channels: existingDiscord.channels }));
                    _g.label = 5;
                case 5: return [4 /*yield*/, p.confirm({
                        message: "Configure Telegram bot token?",
                        initialValue: !(existingTelegram === null || existingTelegram === void 0 ? void 0 : existingTelegram.botToken),
                    })];
                case 6:
                    configureTelegram = _g.sent();
                    telegramConfig = existingTelegram;
                    if (!(!p.isCancel(configureTelegram) && configureTelegram)) return [3 /*break*/, 9];
                    if (existingTelegram === null || existingTelegram === void 0 ? void 0 : existingTelegram.botToken) {
                        masked = existingTelegram.botToken.slice(0, 8) + "..." + existingTelegram.botToken.slice(-4);
                        p.log.info("Current token: ".concat(picocolors_1.default.dim(masked)));
                    }
                    p.log.info("Get a token from ".concat(picocolors_1.default.cyan("@BotFather"), " on Telegram.\n") +
                        "  The token will be saved to ~/.sportsclaw/config.json.\n" +
                        "  You can also set TELEGRAM_BOT_TOKEN in env or ~/.sportsclaw/.env.");
                    return [4 /*yield*/, p.password({
                            message: "Paste your Telegram bot token:",
                            validate: function (val) {
                                if (!val || val.trim().length === 0)
                                    return "Bot token is required.";
                            },
                        })];
                case 7:
                    tokenInput = _g.sent();
                    if (p.isCancel(tokenInput)) {
                        p.cancel("Setup cancelled.");
                        process.exit(0);
                    }
                    return [4 /*yield*/, p.text({
                            message: "Allowed Telegram user IDs (comma-separated, blank for public):",
                            placeholder: "Leave blank for public access",
                            defaultValue: (_f = (_e = existingTelegram === null || existingTelegram === void 0 ? void 0 : existingTelegram.allowedUsers) === null || _e === void 0 ? void 0 : _e.join(",")) !== null && _f !== void 0 ? _f : "",
                        })];
                case 8:
                    allowedUsersInput = _g.sent();
                    if (p.isCancel(allowedUsersInput)) {
                        p.cancel("Setup cancelled.");
                        process.exit(0);
                    }
                    allowedUsers = parseCommaList(allowedUsersInput);
                    telegramConfig = __assign({ botToken: tokenInput.trim() }, (allowedUsers.length > 0 && { allowedUsers: allowedUsers }));
                    _g.label = 9;
                case 9:
                    chatIntegrations = __assign(__assign({}, (discordConfig && { discord: discordConfig })), (telegramConfig && { telegram: telegramConfig }));
                    updatedConfig = __assign(__assign({}, savedConfig), (Object.keys(chatIntegrations).length > 0 && { chatIntegrations: chatIntegrations }));
                    saveConfig(updatedConfig);
                    p.outro("Config saved to ".concat(CONFIG_PATH));
                    // Quick next-steps guide
                    console.log("");
                    if (discordConfig === null || discordConfig === void 0 ? void 0 : discordConfig.botToken) {
                        console.log("  ".concat(picocolors_1.default.cyan("sportsclaw listen discord"), "    Start Discord bot"));
                    }
                    if (telegramConfig === null || telegramConfig === void 0 ? void 0 : telegramConfig.botToken) {
                        console.log("  ".concat(picocolors_1.default.cyan("sportsclaw listen telegram"), "   Start Telegram bot"));
                    }
                    console.log("");
                    return [2 /*return*/];
            }
        });
    });
}
// ---------------------------------------------------------------------------
// Sport multi-select prompt (reusable)
// ---------------------------------------------------------------------------
function desc(sport) {
    var _a;
    return (_a = schema_js_1.SKILL_DESCRIPTIONS[sport]) !== null && _a !== void 0 ? _a : sport;
}
function promptSportSelection() {
    return __awaiter(this, void 0, void 0, function () {
        var selections;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0: return [4 /*yield*/, p.groupMultiselect({
                        message: "🏟️  Which sports do you want to install?",
                        options: {
                            "US Pro": [
                                { value: "nfl", label: "NFL", hint: desc("nfl") },
                                { value: "nba", label: "NBA", hint: desc("nba") },
                                { value: "nhl", label: "NHL", hint: desc("nhl") },
                                { value: "mlb", label: "MLB", hint: desc("mlb") },
                                { value: "wnba", label: "WNBA", hint: desc("wnba") },
                            ],
                            "College": [
                                { value: "cfb", label: "College Football", hint: desc("cfb") },
                                { value: "cbb", label: "College Basketball", hint: desc("cbb") },
                            ],
                            "Global": [
                                { value: "football", label: "Football (Soccer)", hint: desc("football") },
                                { value: "tennis", label: "Tennis", hint: desc("tennis") },
                                { value: "golf", label: "Golf", hint: desc("golf") },
                                { value: "f1", label: "Formula 1", hint: desc("f1") },
                            ],
                            "Markets & News": [
                                { value: "kalshi", label: "Kalshi", hint: desc("kalshi") },
                                { value: "polymarket", label: "Polymarket", hint: desc("polymarket") },
                                { value: "news", label: "Sports News", hint: desc("news") },
                            ],
                        },
                    })];
                case 1:
                    selections = _a.sent();
                    return [2 /*return*/, selections];
            }
        });
    });
}
function installSelectedSports(sports, pythonPath) {
    return __awaiter(this, void 0, void 0, function () {
        var s, installed, _i, sports_1, sport, schema, _a;
        return __generator(this, function (_b) {
            switch (_b.label) {
                case 0:
                    if (sports.length === 0)
                        return [2 /*return*/, 0];
                    s = p.spinner();
                    s.start("Installing ".concat(sports.length, " sport schema(s)..."));
                    installed = 0;
                    _i = 0, sports_1 = sports;
                    _b.label = 1;
                case 1:
                    if (!(_i < sports_1.length)) return [3 /*break*/, 6];
                    sport = sports_1[_i];
                    _b.label = 2;
                case 2:
                    _b.trys.push([2, 4, , 5]);
                    return [4 /*yield*/, (0, schema_js_1.fetchSportSchema)(sport, { pythonPath: pythonPath })];
                case 3:
                    schema = _b.sent();
                    (0, schema_js_1.saveSchema)(schema);
                    installed++;
                    return [3 /*break*/, 5];
                case 4:
                    _a = _b.sent();
                    // Log but continue
                    console.error("[sportsclaw] warning: could not fetch schema for \"".concat(sport, "\""));
                    return [3 /*break*/, 5];
                case 5:
                    _i++;
                    return [3 /*break*/, 1];
                case 6:
                    s.stop("Installed ".concat(installed, "/").concat(sports.length, " sport schema(s)."));
                    return [2 /*return*/, installed];
            }
        });
    });
}
/**
 * Standalone sport selection flow — usable from ensureDefaultSchemas()
 * when a first-time user hasn't run `sportsclaw config` yet.
 */
function runSportSelectionFlow(pythonPath) {
    return __awaiter(this, void 0, void 0, function () {
        var sportSelections, selected, resolvedPython, config;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0:
                    p.log.warn(exports.SPORTS_SKILLS_DISCLAIMER);
                    return [4 /*yield*/, promptSportSelection()];
                case 1:
                    sportSelections = _a.sent();
                    if (p.isCancel(sportSelections)) {
                        // User cancelled — install all defaults as a safe fallback
                        p.log.info("No selection made — installing all default sports.");
                        return [2 /*return*/, __spreadArray([], schema_js_1.DEFAULT_SKILLS, true)];
                    }
                    selected = sportSelections;
                    if (selected.length === 0) {
                        p.log.info("No sports selected — installing all defaults.");
                        return [2 /*return*/, __spreadArray([], schema_js_1.DEFAULT_SKILLS, true)];
                    }
                    resolvedPython = pythonPath || "python3";
                    return [4 /*yield*/, installSelectedSports(selected, resolvedPython)];
                case 2:
                    _a.sent();
                    config = loadConfig();
                    config.selectedSports = selected;
                    saveConfig(config);
                    return [2 /*return*/, selected];
            }
        });
    });
}
