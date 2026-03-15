"use strict";
/**
 * sportsclaw Engine — Multi-LLM Credential Manager (Keychain)
 *
 * Securely stores and retrieves API keys for multiple LLM providers
 * (Anthropic, OpenAI, Gemini) concurrently in ~/.sportsclaw/credentials.json.
 *
 * Resolution order per provider:
 *   1. Environment variable (always wins)
 *   2. credentials.json keychain
 *   3. Legacy config.json migration (one-time)
 *   4. Interactive prompt (if TTY)
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
Object.defineProperty(exports, "__esModule", { value: true });
exports.ALL_CREDENTIAL_FIELDS = void 0;
exports.getCredentials = getCredentials;
exports.saveCredentials = saveCredentials;
exports.deleteCredential = deleteCredential;
exports.migrateLegacyConfig = migrateLegacyConfig;
exports.resolveCredential = resolveCredential;
exports.hasCredential = hasCredential;
exports.ensureCredential = ensureCredential;
exports.listProviderStatus = listProviderStatus;
exports.printCredentialStatus = printCredentialStatus;
var node_fs_1 = require("node:fs");
var node_os_1 = require("node:os");
var node_path_1 = require("node:path");
var p = require("@clack/prompts");
// ---------------------------------------------------------------------------
// Paths
// ---------------------------------------------------------------------------
var CRED_DIR = (0, node_path_1.join)((0, node_os_1.homedir)(), ".sportsclaw");
var CRED_FILE = (0, node_path_1.join)(CRED_DIR, "credentials.json");
var CONFIG_FILE = (0, node_path_1.join)(CRED_DIR, "config.json");
/** Map provider name → keychain field + env var */
var PROVIDER_MAP = {
    anthropic: { field: "ANTHROPIC_API_KEY", envVar: "ANTHROPIC_API_KEY", label: "Anthropic (Claude)" },
    openai: { field: "OPENAI_API_KEY", envVar: "OPENAI_API_KEY", label: "OpenAI (GPT)" },
    gemini: { field: "GEMINI_API_KEY", envVar: "GEMINI_API_KEY", label: "Google (Gemini)" },
};
/** All recognized credential fields */
exports.ALL_CREDENTIAL_FIELDS = Object.values(PROVIDER_MAP).map(function (v) { return v.field; });
// ---------------------------------------------------------------------------
// Read / Write
// ---------------------------------------------------------------------------
function ensureDir() {
    if (!(0, node_fs_1.existsSync)(CRED_DIR))
        (0, node_fs_1.mkdirSync)(CRED_DIR, { recursive: true });
}
function getCredentials() {
    if (!(0, node_fs_1.existsSync)(CRED_FILE))
        return {};
    try {
        return JSON.parse((0, node_fs_1.readFileSync)(CRED_FILE, "utf-8"));
    }
    catch (_a) {
        return {};
    }
}
function saveCredentials(creds) {
    ensureDir();
    var existing = getCredentials();
    var merged = __assign(__assign({}, existing), creds);
    (0, node_fs_1.writeFileSync)(CRED_FILE, JSON.stringify(merged, null, 2) + "\n", "utf-8");
    try {
        (0, node_fs_1.chmodSync)(CRED_FILE, 384);
    }
    catch (_a) {
        // chmod may not be supported on all platforms
    }
}
function deleteCredential(field) {
    var existing = getCredentials();
    delete existing[field];
    ensureDir();
    (0, node_fs_1.writeFileSync)(CRED_FILE, JSON.stringify(existing, null, 2) + "\n", "utf-8");
}
// ---------------------------------------------------------------------------
// Legacy migration (config.json → credentials.json)
// ---------------------------------------------------------------------------
var migrationDone = false;
function migrateLegacyConfig() {
    var _a;
    if (migrationDone)
        return;
    migrationDone = true;
    if (!(0, node_fs_1.existsSync)(CONFIG_FILE))
        return;
    try {
        var legacy = JSON.parse((0, node_fs_1.readFileSync)(CONFIG_FILE, "utf-8"));
        if (legacy.apiKey && legacy.provider) {
            var providerToField = {
                google: "GEMINI_API_KEY",
                anthropic: "ANTHROPIC_API_KEY",
                openai: "OPENAI_API_KEY",
            };
            var field = providerToField[legacy.provider];
            if (field) {
                var existing = getCredentials();
                if (!existing[field]) {
                    saveCredentials((_a = {}, _a[field] = legacy.apiKey, _a));
                    p.log.info("Migrated legacy ".concat(legacy.provider, " API key to the multi-LLM keychain."));
                }
            }
        }
    }
    catch (_b) {
        // Ignore parse errors in legacy config
    }
}
// ---------------------------------------------------------------------------
// Resolution: env → keychain → undefined
// ---------------------------------------------------------------------------
/**
 * Resolve a provider's API key without prompting.
 * Returns the key string or undefined if not found anywhere.
 */
function resolveCredential(provider) {
    migrateLegacyConfig();
    var info = PROVIDER_MAP[provider];
    // 1. Environment variable
    var envVal = process.env[info.envVar];
    if (envVal && envVal.trim().length > 0)
        return envVal.trim();
    // 2. Keychain file
    var creds = getCredentials();
    var stored = creds[info.field];
    if (stored && stored.trim().length > 0)
        return stored.trim();
    return undefined;
}
/**
 * Check whether a provider has a valid credential available (env or keychain).
 */
function hasCredential(provider) {
    return resolveCredential(provider) !== undefined;
}
// ---------------------------------------------------------------------------
// Interactive credential prompting
// ---------------------------------------------------------------------------
/**
 * Ensure a provider credential is available.
 * If missing, interactively prompts the user (unless nonInteractive is true).
 * Returns the API key or exits if the user cancels.
 */
function ensureCredential(provider, opts) {
    return __awaiter(this, void 0, void 0, function () {
        var existing, info, key, trimmed;
        var _a;
        return __generator(this, function (_b) {
            switch (_b.label) {
                case 0:
                    existing = resolveCredential(provider);
                    if (existing)
                        return [2 /*return*/, existing];
                    info = PROVIDER_MAP[provider];
                    if (opts === null || opts === void 0 ? void 0 : opts.nonInteractive) {
                        p.log.error("".concat(info.label, " API key is required but not found.\n") +
                            "  Set ".concat(info.envVar, " in your environment or run: sportsclaw config"));
                        process.exit(1);
                    }
                    if (opts === null || opts === void 0 ? void 0 : opts.reason) {
                        p.log.warn(opts.reason);
                    }
                    return [4 /*yield*/, p.text({
                            message: "Enter your ".concat(info.label, " API key:"),
                            placeholder: provider === "gemini" ? "AIzaSy..." : "sk-...",
                            validate: function (val) { return (!val || val.trim().length === 0 ? "API key is required." : undefined); },
                        })];
                case 1:
                    key = _b.sent();
                    if (p.isCancel(key)) {
                        p.cancel("Operation cancelled.");
                        process.exit(0);
                    }
                    trimmed = key.trim();
                    saveCredentials((_a = {}, _a[info.field] = trimmed, _a));
                    p.log.success("".concat(info.label, " API key saved to keychain."));
                    return [2 /*return*/, trimmed];
            }
        });
    });
}
// ---------------------------------------------------------------------------
// Status / listing
// ---------------------------------------------------------------------------
/**
 * Get the authentication status of all supported providers.
 */
function listProviderStatus() {
    migrateLegacyConfig();
    return Object.entries(PROVIDER_MAP).map(function (_a) {
        var provider = _a[0], info = _a[1];
        var envVal = process.env[info.envVar];
        if (envVal && envVal.trim().length > 0) {
            return { provider: provider, label: info.label, authenticated: true, source: "env" };
        }
        var creds = getCredentials();
        var stored = creds[info.field];
        if (stored && stored.trim().length > 0) {
            return { provider: provider, label: info.label, authenticated: true, source: "keychain" };
        }
        return { provider: provider, label: info.label, authenticated: false, source: "none" };
    });
}
/**
 * Print a formatted status table of all provider credentials.
 */
function printCredentialStatus() {
    var statuses = listProviderStatus();
    for (var _i = 0, statuses_1 = statuses; _i < statuses_1.length; _i++) {
        var s = statuses_1[_i];
        var icon = s.authenticated ? "+" : "-";
        var sourceHint = s.source === "env" ? " (env)" : s.source === "keychain" ? " (keychain)" : "";
        var status_1 = s.authenticated ? "authenticated".concat(sourceHint) : "not configured";
        p.log.info("[".concat(icon, "] ").concat(s.label, ": ").concat(status_1));
    }
}
