// AI Model configuration
export const MODELS = {
    haiku: "deepseek/deepseek-v4-pro",
    sonnet: "deepseek/deepseek-v4-pro",
};

// Re-export prompts from dedicated file
export { SYSTEM_PROMPT, SUMMARY_PROMPT, CHECKIN_PROMPT, WEEKLY_REVIEW_PROMPT, MONTHLY_REVIEW_PROMPT } from "./prompts.js";

// Time constants
const MS_PER_HOUR = 60 * 60 * 1000;

export const TIME_CONSTANTS = {
    MS_PER_HOUR,
    IST_OFFSET_MS: 5.5 * MS_PER_HOUR,
    CHECKIN_START_HOUR: 9,
    CHECKIN_END_HOUR: 21,
    INACTIVITY_HOURS: 3,
    SUMMARY_THRESHOLD_MESSAGES: 10,
};

// Days mapping for scheduling (indexed by getUTCDay())
export const DAYS_MAP = ["sun", "mon", "tue", "wed", "thu", "fri", "sat"];

// Pagination limits
export const PAGINATION = {
    DEFAULT_LIMIT: 10,
    MAX_LIMIT: 50,
};

// Token limits
export const TOKEN_LIMITS = {
    DEFAULT: 4096,
    MIN: 256,
    MAX: 16384,
    CHECKIN: 300,
};
