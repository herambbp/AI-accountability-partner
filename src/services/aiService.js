import { anthropic } from "../config/index.js";
import {
    MODELS,
    SYSTEM_PROMPT,
    SUMMARY_PROMPT,
    CHECKIN_PROMPT,
    WEEKLY_REVIEW_PROMPT,
    MONTHLY_REVIEW_PROMPT,
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

        const response = await anthropic.chat.completions.create({
            model: selectedModel,
            max_tokens: tokens,
            messages: [
                { role: "system", content: SYSTEM_PROMPT + context },
                { role: "user", content: message },
            ],
        });

        return response.choices[0].message.content;
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
            const response = await anthropic.chat.completions.create({
                model: MODELS.haiku,
                max_tokens: 8000,
                messages: [
                    { role: "system", content: SUMMARY_PROMPT },
                    { role: "user", content: prompt },
                ],
            });

            return response.choices[0].message.content;
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
        const response = await anthropic.chat.completions.create({
            model: MODELS.haiku,
            max_tokens: TOKEN_LIMITS.CHECKIN,
            messages: [
                { role: "system", content: SYSTEM_PROMPT + context },
                { role: "user", content: CHECKIN_PROMPT },
            ],
        });

        return response.choices[0].message.content;
    },

    async generateWeeklyReview(goalContext) {
        const response = await anthropic.chat.completions.create({
            model: MODELS.haiku,
            max_tokens: TOKEN_LIMITS.DEFAULT,
            messages: [
                { role: "system", content: WEEKLY_REVIEW_PROMPT },
                { role: "user", content: goalContext },
            ],
        });

        return response.choices[0].message.content;
    },

    async generateMonthlyReview(goalContext) {
        const response = await anthropic.chat.completions.create({
            model: MODELS.haiku,
            max_tokens: TOKEN_LIMITS.DEFAULT,
            messages: [
                { role: "system", content: MONTHLY_REVIEW_PROMPT },
                { role: "user", content: goalContext },
            ],
        });

        return response.choices[0].message.content;
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
