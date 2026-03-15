"use strict";
/**
 * sportsclaw Engine — Type Definitions
 *
 * Shared types for the agent execution loop, tool bridge, and configuration.
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.DEFAULT_CONFIG = exports.DEFAULT_TOKEN_BUDGETS = exports.DEFAULT_MODELS = exports.PROVIDER_MODEL_PROFILES = void 0;
exports.buildProviderOptions = buildProviderOptions;
exports.PROVIDER_MODEL_PROFILES = {
    anthropic: {
        defaultModel: "claude-opus-4-6",
        selectableModels: [
            {
                value: "claude-opus-4-6",
                label: "Claude Opus 4.6",
                hint: "recommended",
            },
            {
                value: "claude-sonnet-4-5-20250514",
                label: "Claude Sonnet 4.5",
                hint: "faster, cheaper",
            },
        ],
    },
    openai: {
        defaultModel: "gpt-5.3-codex",
        selectableModels: [
            {
                value: "gpt-5.3-codex",
                label: "GPT-5.3 Codex",
                hint: "recommended",
            },
        ],
    },
    google: {
        defaultModel: "gemini-3-flash-preview",
        selectableModels: [
            {
                value: "gemini-3-flash-preview",
                label: "Gemini 3 Flash",
                hint: "recommended",
            },
            {
                value: "gemini-3-pro-preview",
                label: "Gemini 3 Pro",
                hint: "advanced reasoning",
            },
            {
                value: "gemini-3.1-pro-preview",
                label: "Gemini 3.1 Pro",
                hint: "most capable",
            },
        ],
    },
};
exports.DEFAULT_MODELS = {
    anthropic: exports.PROVIDER_MODEL_PROFILES.anthropic.defaultModel,
    openai: exports.PROVIDER_MODEL_PROFILES.openai.defaultModel,
    google: exports.PROVIDER_MODEL_PROFILES.google.defaultModel,
};
exports.DEFAULT_TOKEN_BUDGETS = {
    main: 16384,
    synthesis: 2048,
    evidenceGate: 4096,
    router: 220,
};
exports.DEFAULT_CONFIG = {
    provider: "anthropic",
    model: exports.DEFAULT_MODELS.anthropic,
    maxTurns: 25,
    maxTokens: 16384,
    systemPrompt: "",
    pythonPath: "python3",
    timeout: 60000,
    env: {},
    verbose: false,
    routingMode: "soft_lock",
    routingMaxSkills: 2,
    routingAllowSpillover: 1,
    cacheEnabled: true,
    cacheTtlMs: 300000,
    clarifyOnLowConfidence: true,
    clarifyThreshold: 0.5,
    skipFanProfile: false,
    allowTrading: false,
    thinkingBudget: 8192,
    tokenBudgets: {},
    parallelAgents: false,
};
function buildProviderOptions(provider, budget) {
    if (budget <= 0)
        return undefined;
    switch (provider) {
        case "anthropic":
            return { anthropic: { thinking: { type: "enabled", budgetTokens: budget } } };
        case "openai": {
            var effort = budget <= 4096 ? "low" : budget <= 16384 ? "medium" : "high";
            return { openai: { reasoningEffort: effort } };
        }
        case "google":
            return { google: { thinkingConfig: { thinkingBudget: budget } } };
        default:
            return undefined;
    }
}
