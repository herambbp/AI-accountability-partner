import OpenAI from "openai";
import { createClient } from "@supabase/supabase-js";
import { Expo } from "expo-server-sdk";
import "dotenv/config";

// Required environment variables
const REQUIRED_ENV_VARS = [
    "OPENROUTER_API_KEY",
    "SUPABASE_URL",
    "SUPABASE_SERVICE_KEY",
];

// Validate environment on startup
function validateEnvironment() {
    const missing = REQUIRED_ENV_VARS.filter((key) => !process.env[key]);
    if (missing.length > 0) {
        throw new Error(
            `Missing required environment variables: ${missing.join(", ")}`
        );
    }
}

validateEnvironment();

// Initialize clients
export const anthropic = new OpenAI({
    apiKey: process.env.OPENROUTER_API_KEY,
    baseURL: "https://openrouter.ai/api/v1",
    defaultHeaders: {
        "HTTP-Referer": "https://github.com/AI-accountability-partner",
        "X-Title": "AI Accountability Coach",
    },
});

export const supabase = createClient(
    process.env.SUPABASE_URL,
    process.env.SUPABASE_SERVICE_KEY
);

export const expo = new Expo();

// Server configuration
export const PORT = process.env.PORT || 3000;
