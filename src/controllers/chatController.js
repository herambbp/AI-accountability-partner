import { messageRepository } from "../repositories/messageRepository.js";
import { scheduleRepository } from "../repositories/scheduleRepository.js";
import { userRepository } from "../repositories/userRepository.js";
import { aiService } from "../services/aiService.js";
import { contextService } from "../services/contextService.js";
import { summaryService } from "../services/summaryService.js";
import { goalService } from "../services/goalService.js";
import { dailyLogRepository } from "../repositories/dailyLogRepository.js";
import {
    parseScheduleFromResponse,
    parseGoalFromResponse,
    parseKpiLogFromResponse,
    cleanAllBlocksFromMessage,
    validateRequired,
} from "../utils/textUtils.js";
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

    // Fetch context data in parallel (including goals)
    const today = new Date().toISOString().split("T")[0];
    const [summaryData, recentMessages, schedules, activeGoals, todayLogs] = await Promise.all([
        userRepository.getSummaryData(userId),
        messageRepository.findRecentForContext(userId, 10),
        scheduleRepository.findActiveByUserId(userId),
        goalService.getActiveGoalsWithProgress(userId),
        dailyLogRepository.findByUserAndDate(userId, today),
    ]);

    // Exclude the message we just saved
    const messagesForContext = recentMessages.slice(0, -1);
    const context = contextService.buildContext(
        messagesForContext,
        schedules,
        summaryData.summary,
        activeGoals,
        todayLogs
    );

    // Generate AI response
    const aiResponse = await aiService.generateChatResponse(message, context, {
        model,
        maxTokens,
    });

    // Parse structured blocks from response
    const schedule = parseScheduleFromResponse(aiResponse);
    const goalData = parseGoalFromResponse(aiResponse);
    const kpiLogData = parseKpiLogFromResponse(aiResponse);

    // Process goal creation
    let goal = null;
    if (goalData) {
        try {
            goal = await goalService.createGoalFromAI(userId, goalData);
            console.log(`Goal created via chat: ${goal.id} — ${goal.objective}`);
        } catch (err) {
            console.error("Goal creation from chat failed:", err.message);
        }
    }

    // Process KPI log
    let kpiLog = null;
    if (kpiLogData?.goalId && kpiLogData?.values?.length) {
        try {
            const kpiValues = kpiLogData.values.map((v) => ({
                kpiId: v.kpiId,
                value: v.value,
                name: v.name,
            }));
            kpiLog = await dailyLogRepository.upsert(
                kpiLogData.goalId,
                userId,
                today,
                kpiValues,
                kpiLogData.notes || null
            );
            console.log(`KPI log saved via chat for goal ${kpiLogData.goalId}`);
        } catch (err) {
            console.error("KPI log from chat failed:", err.message);
        }
    }

    // Save assistant message (clean version without any structured blocks)
    const cleanMessage = cleanAllBlocksFromMessage(aiResponse);
    await messageRepository.create(userId, "assistant", cleanMessage);

    // Update summary in background (don't await)
    summaryService.updateUserSummary(userId).catch((err) =>
        console.error("Background summary update failed:", err)
    );

    res.json({ message: cleanMessage, schedule, goal, kpiLog, model });
});
