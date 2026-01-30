import { anthropic } from "../config/index.js";
import {
    MODELS,
    SYSTEM_PROMPT,
    SUMMARY_PROMPT,
    CHECKIN_PROMPT,
    TOKEN_LIMITS,
} from "../config/constants.js";

/**
 * Service for Claude AI interactions
 */
export const aiService = {
    /**
     * Generate a chat response from Claude
     * @param {string} message - User message
     * @param {string} context - Built context string
     * @param {Object} options - Options
     * @param {string} options.model - Model name (haiku/sonnet)
     * @param {number} options.maxTokens - Max tokens for response
     * @returns {Promise<string>} AI response text
     */
    async generateChatResponse(
        message,
        context,
        { model = "haiku", maxTokens = TOKEN_LIMITS.DEFAULT } = {}
    ) {
        const selectedModel = MODELS[model] || MODELS.haiku;
        const tokens = Math.min(
            Math.max(maxTokens, TOKEN_LIMITS.MIN),
            TOKEN_LIMITS.MAX
        );

        console.log(`AI Chat: model=${model} (${selectedModel}), tokens=${tokens}`);

        const response = await anthropic.messages.create({
            model: selectedModel,
            max_tokens: tokens,
            system: SYSTEM_PROMPT + context,
            messages: [{ role: "user", content: message }],
        });

        return response.content[0].text;
    },

    /**
     * Generate a conversation summary
     * @param {Array} messages - Messages to summarize
     * @param {string|null} existingSummary - Existing summary to merge with
     * @returns {Promise<string|null>} Generated summary
     */
    async generateSummary(messages, existingSummary = null) {
        if (!messages?.length) return existingSummary;

        const prompt = buildSummaryPrompt(messages, existingSummary);

        try {
            const response = await anthropic.messages.create({
                model: MODELS.haiku,
                max_tokens: 8000,
                system: SUMMARY_PROMPT,
                messages: [{ role: "user", content: prompt }],
            });

            return response.content[0].text;
        } catch (error) {
            console.error("Summary generation error:", error);
            return existingSummary;
        }
    },

    /**
     * Generate a proactive check-in message
     * @param {string} context - Built context string
     * @returns {Promise<string>} Check-in message
     */
    async generateCheckinMessage(context) {
        const response = await anthropic.messages.create({
            model: MODELS.haiku,
            max_tokens: TOKEN_LIMITS.CHECKIN,
            system: SYSTEM_PROMPT + context,
            messages: [{ role: "user", content: CHECKIN_PROMPT }],
        });

        return response.content[0].text;
    },
};

/**
 * Build the prompt for summary generation
 */
function buildSummaryPrompt(messages, existingSummary) {
    const messageLines = messages.map((m) => {
        const role = m.role === "user" ? "User" : "Coach";
        return `${role}: ${m.content}`;
    });

    if (existingSummary) {
        return `Existing summary:\n${existingSummary}\n\nNew messages to incorporate:\n\n${messageLines.join("\n\n")}`;
    }

    return `Summarize this conversation:\n\n${messageLines.join("\n\n")}`;
}
