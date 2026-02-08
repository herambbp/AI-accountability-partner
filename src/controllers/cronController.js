import { userRepository } from "../repositories/userRepository.js";
import { messageRepository } from "../repositories/messageRepository.js";
import { scheduleRepository } from "../repositories/scheduleRepository.js";
import { aiService } from "../services/aiService.js";
import { contextService } from "../services/contextService.js";
import { notificationService } from "../services/notificationService.js";
import { progressReviewService } from "../services/progressReviewService.js";
import { sheetsService } from "../services/sheetsService.js";
import { whatsappService } from "../services/whatsappService.js";
import { asyncHandler } from "../middleware/errorHandler.js";
import { AppError } from "../utils/AppError.js";
import { getISTTime, getDayName } from "../utils/dateUtils.js";
import { TIME_CONSTANTS } from "../config/constants.js";

/**
 * POST /api/push-token
 * Save user's push notification token
 */
export const savePushToken = asyncHandler(async (req, res) => {
    const { userId, token } = req.body;

    console.log(`Saving push token for user ${userId}: ${token?.substring(0, 30)}...`);

    await userRepository.upsertPushToken(userId, token);
    res.json({ success: true });
});

/**
 * GET /api/debug/user/:userId
 * Get debug info for a user
 */
export const debugUser = asyncHandler(async (req, res) => {
    const debugInfo = await userRepository.getDebugInfo(req.params.userId);
    res.json(debugInfo);
});

/**
 * POST /api/test-checkin/:userId
 * Test check-in endpoint
 */
export const testCheckin = asyncHandler(async (req, res) => {
    const { userId } = req.params;

    const profile = await userRepository.findProfileById(userId);
    if (!profile?.expo_push_token) {
        throw AppError.badRequest("No push token found for user");
    }

    const history = await messageRepository.findRecentForContext(userId, 10);
    if (!history?.length) {
        throw AppError.badRequest("No message history for user");
    }

    const context = contextService.buildContext(history, [], profile.conversation_summary);
    const checkinMessage = await aiService.generateCheckinMessage(context);
    const pushResult = await notificationService.sendCheckin(profile.expo_push_token, checkinMessage);

    res.json({
        success: true,
        message: checkinMessage,
        pushResult,
        token: profile.expo_push_token.substring(0, 30) + "...",
    });
});

/**
 * POST /api/cron/notifications
 * Cron endpoint for scheduled notifications and proactive check-ins
 */
export const runNotifications = asyncHandler(async (req, res) => {
    const now = new Date();
    const istTime = getISTTime(now);
    const currentHour = istTime.getUTCHours();
    const currentMinute = istTime.getUTCMinutes();
    const currentDay = getDayName(istTime);

    console.log(`Running notifications cron: ${currentHour}:${currentMinute} on ${currentDay} (IST)`);

    await sendScheduledReminders(currentHour, currentMinute, currentDay);
    await sendProactiveCheckins(now, currentHour);

    res.json({ success: true, timestamp: now.toISOString() });
});

/**
 * Send scheduled reminder notifications
 */
async function sendScheduledReminders(currentHour, currentMinute, currentDay) {
    const schedules = await scheduleRepository.findDueSchedules(currentHour, currentMinute, currentDay);
    console.log(`Found ${schedules.length} schedules to notify`);

    for (const schedule of schedules) {
        const token = await userRepository.getPushToken(schedule.user_id);
        if (token) {
            await notificationService.sendScheduleReminder(token, schedule);
            console.log(`Sent schedule notification for: ${schedule.title}`);
        } else {
            console.log(`No push token for schedule: ${schedule.title}`);
        }
    }
}

/**
 * Send proactive check-ins to inactive users (only during allowed hours)
 */
async function sendProactiveCheckins(now, currentHour) {
    const isWithinCheckinHours =
        currentHour >= TIME_CONSTANTS.CHECKIN_START_HOUR &&
        currentHour <= TIME_CONSTANTS.CHECKIN_END_HOUR;

    if (!isWithinCheckinHours) {
        console.log(`Outside check-in hours (current: ${currentHour} IST, allowed: ${TIME_CONSTANTS.CHECKIN_START_HOUR}-${TIME_CONSTANTS.CHECKIN_END_HOUR})`);
        return;
    }

    const inactivityMs = TIME_CONSTANTS.INACTIVITY_HOURS * TIME_CONSTANTS.MS_PER_HOUR;
    const threeHoursAgo = new Date(now.getTime() - inactivityMs).toISOString();

    console.log(`Checking for inactive users (inactive since ${threeHoursAgo})`);

    const inactiveUsers = await userRepository.findInactiveUsers(threeHoursAgo);
    console.log(`Found ${inactiveUsers.length} inactive users`);

    for (const user of inactiveUsers) {
        await processUserCheckin(user, now, inactivityMs);
    }
}

/**
 * Process check-in for a single inactive user
 */
async function processUserCheckin(user, now, inactivityMs) {
    const profile = await userRepository.findProfileById(user.user_id);
    const token = profile?.expo_push_token;

    if (!token) {
        console.log(`User ${user.user_id}: No push token`);
        return;
    }

    if (wasRecentlyCheckedIn(user.last_checkin_at, now, inactivityMs)) {
        console.log(`User ${user.user_id}: Already sent check-in recently`);
        return;
    }

    const history = await messageRepository.findRecentForContext(user.user_id, 10);
    if (!history?.length) {
        console.log(`User ${user.user_id}: No message history`);
        return;
    }

    console.log(`Generating check-in for user ${user.user_id}`);

    const context = contextService.buildContext(history, [], profile.conversation_summary);
    const checkinMessage = await aiService.generateCheckinMessage(context);

    await notificationService.sendCheckin(token, checkinMessage);
    await messageRepository.create(user.user_id, "assistant", checkinMessage);
    await userRepository.updateLastCheckin(user.user_id);

    console.log(`Sent proactive check-in to user: ${user.user_id}`);
}

/**
 * Check if user was already checked in within the inactivity window
 */
function wasRecentlyCheckedIn(lastCheckinAt, now, inactivityMs) {
    if (!lastCheckinAt) return false;
    const lastCheckin = new Date(lastCheckinAt);
    const threshold = new Date(now.getTime() - inactivityMs);
    return lastCheckin > threshold;
}

/**
 * POST /api/cron/reviews
 * Automated weekly (Sunday) + monthly (1st) AI reviews
 */
export const runReviews = asyncHandler(async (req, res) => {
    console.log("Running automated reviews cron...");

    const results = await progressReviewService.runAutomatedReviews();

    // Send weekly reviews via WhatsApp
    for (const item of results.weekly) {
        try {
            await whatsappService.sendWeeklyReview(item.userId, item.review);
            await messageRepository.create(item.userId, "assistant", `**Weekly Review (${item.goalId}):**\n\n${item.review}`);
        } catch (err) {
            console.error(`Failed to send weekly review for ${item.userId}:`, err.message);
        }
    }

    res.json({
        success: true,
        weeklyReviews: results.weekly.length,
        monthlyReviews: results.monthly.length,
    });
});

/**
 * POST /api/cron/sheets-sync
 * Daily Google Sheets sync for all users
 */
export const runSheetsSync = asyncHandler(async (req, res) => {
    console.log("Running Google Sheets sync cron...");
    const result = await sheetsService.syncAllUsers();
    res.json({ success: true, ...result });
});

/**
 * POST /api/cron/whatsapp-daily
 * Daily WhatsApp progress update to all users with active contacts
 */
export const runWhatsAppDaily = asyncHandler(async (req, res) => {
    console.log("Running WhatsApp daily progress cron...");
    const results = await whatsappService.sendAllDailyProgress();
    res.json({ success: true, results });
});
