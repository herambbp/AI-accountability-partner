import { messageRepository } from "../repositories/messageRepository.js";
import { userRepository } from "../repositories/userRepository.js";
import { aiService } from "./aiService.js";
import { TIME_CONSTANTS } from "../config/constants.js";

/**
 * Service for managing conversation summaries
 */
export const summaryService = {
    /**
     * Update user's conversation summary if needed
     * Summarizes messages beyond the recent 10 to keep context manageable
     * @param {string} userId - User ID
     * @returns {Promise<string|null>} New summary or null if not updated
     */
    async updateUserSummary(userId) {
        try {
            const summaryData = await userRepository.getSummaryData(userId);
            const messagesSummarized = summaryData.messagesSummarized;
            const existingSummary = summaryData.summary;

            const allMessages = await messageRepository.findAllForSummary(userId);

            // Not enough messages to summarize
            if (!allMessages || allMessages.length <= TIME_CONSTANTS.SUMMARY_THRESHOLD_MESSAGES) {
                return null;
            }

            // Keep last 10 messages unsummarized for recent context
            const messagesToSummarize = allMessages.slice(0, -TIME_CONSTANTS.SUMMARY_THRESHOLD_MESSAGES);

            // No new messages to summarize
            if (messagesToSummarize.length <= messagesSummarized) {
                return null;
            }

            const newMessages = messagesToSummarize.slice(messagesSummarized);

            console.log(
                `Summarizing ${newMessages.length} new messages for user ${userId}`
            );

            const newSummary = await aiService.generateSummary(
                newMessages,
                existingSummary
            );

            await userRepository.updateSummary(
                userId,
                newSummary,
                messagesToSummarize.length
            );

            console.log(`Summary updated for user ${userId}`);
            return newSummary;
        } catch (error) {
            console.error("Update summary error:", error);
            return null;
        }
    },
};
