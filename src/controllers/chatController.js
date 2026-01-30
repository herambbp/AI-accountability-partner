import { messageRepository } from "../repositories/messageRepository.js";
import { scheduleRepository } from "../repositories/scheduleRepository.js";
import { userRepository } from "../repositories/userRepository.js";
import { aiService } from "../services/aiService.js";
import { contextService } from "../services/contextService.js";
import { summaryService } from "../services/summaryService.js";
import { parseScheduleFromResponse, cleanScheduleFromMessage, validateRequired } from "../utils/textUtils.js";
import { asyncHandler } from "../middleware/errorHandler.js";
import { AppError } from "../utils/AppError.js";

/**
 * POST /api/chat
 * Main chat endpoint for AI conversations
 */
export const postChat = asyncHandler(async (req, res) => {
    const { userId, message, maxTokens = 4096, model = "haiku" } = req.body;

    const validation = validateRequired(req.body, ["userId", "message"]);
    if (!validation.isValid) {
        throw AppError.badRequest(validation.message);
    }

    // Save user message
    await messageRepository.create(userId, "user", message);

    // Update user activity
    await userRepository.updateActivity(userId);

    // Fetch context data in parallel
    const [summaryData, recentMessages, schedules] = await Promise.all([
        userRepository.getSummaryData(userId),
        messageRepository.findRecentForContext(userId, 10),
        scheduleRepository.findActiveByUserId(userId),
    ]);

    // Exclude the message we just saved
    const messagesForContext = recentMessages.slice(0, -1);
    const context = contextService.buildContext(
        messagesForContext,
        schedules,
        summaryData.summary
    );

    // Generate AI response
    const aiResponse = await aiService.generateChatResponse(message, context, {
        model,
        maxTokens,
    });

    // Check for schedule suggestion
    const schedule = parseScheduleFromResponse(aiResponse);

    // Save assistant message (clean version without schedule block)
    const cleanMessage = cleanScheduleFromMessage(aiResponse);
    await messageRepository.create(userId, "assistant", cleanMessage);

    // Update summary in background (don't await)
    summaryService.updateUserSummary(userId).catch((err) =>
        console.error("Background summary update failed:", err)
    );

    res.json({ message: cleanMessage, schedule, model });
});
