import { userRepository } from "../repositories/userRepository.js";
import { messageRepository } from "../repositories/messageRepository.js";
import { scheduleRepository } from "../repositories/scheduleRepository.js";
import { aiService } from "../services/aiService.js";
import { contextService } from "../services/contextService.js";
import { notificationService } from "../services/notificationService.js";
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

    console.log(
        `Saving push token for user ${userId}: ${token?.substring(0, 30)}...`
    );

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

    const context = contextService.buildContext(
        history,
        [],
        profile.conversation_summary
    );

    const checkinMessage = await aiService.generateCheckinMessage(context);

    const pushResult = await notificationService.sendCheckin(
        profile.expo_push_token,
        checkinMessage
    );

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

    console.log(
        `Running notifications cron: ${currentHour}:${currentMinute} on ${currentDay} (IST)`
    );

    // 1. Send scheduled reminders
    const schedules = await scheduleRepository.findDueSchedules(
        currentHour,
        currentMinute,
        currentDay
    );

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

    // 2. Send proactive check-ins (users inactive for 3+ hours, between 9am-9pm IST)
    if (
        currentHour >= TIME_CONSTANTS.CHECKIN_START_HOUR &&
        currentHour <= TIME_CONSTANTS.CHECKIN_END_HOUR
    ) {
        const threeHoursAgo = new Date(
            now.getTime() - TIME_CONSTANTS.INACTIVITY_HOURS * 60 * 60 * 1000
        ).toISOString();

        console.log(`Checking for inactive users (inactive since ${threeHoursAgo})`);

        const inactiveUsers = await userRepository.findInactiveUsers(threeHoursAgo);

        console.log(`Found ${inactiveUsers.length} inactive users`);

        for (const user of inactiveUsers) {
            const profile = await userRepository.findProfileById(user.user_id);
            const token = profile?.expo_push_token;

            if (!token) {
                console.log(`User ${user.user_id}: No push token`);
                continue;
            }

            // Check if we already sent a check-in in the last 3 hours
            if (user.last_checkin_at) {
                const lastCheckin = new Date(user.last_checkin_at);
                const threeHoursAgoDate = new Date(
                    now.getTime() - TIME_CONSTANTS.INACTIVITY_HOURS * 60 * 60 * 1000
                );
                if (lastCheckin > threeHoursAgoDate) {
                    console.log(`User ${user.user_id}: Already sent check-in recently`);
                    continue;
                }
            }

            console.log(`Generating check-in for user ${user.user_id}`);

            const history = await messageRepository.findRecentForContext(
                user.user_id,
                10
            );

            if (history?.length) {
                const context = contextService.buildContext(
                    history,
                    [],
                    profile.conversation_summary
                );

                const checkinMessage = await aiService.generateCheckinMessage(context);

                await notificationService.sendCheckin(token, checkinMessage);

                // Save as assistant message
                await messageRepository.create(
                    user.user_id,
                    "assistant",
                    checkinMessage
                );

                // Update last checkin time
                await userRepository.updateLastCheckin(user.user_id);

                console.log(`Sent proactive check-in to user: ${user.user_id}`);
            } else {
                console.log(`User ${user.user_id}: No message history`);
            }
        }
    } else {
        console.log(
            `Outside check-in hours (current: ${currentHour} IST, allowed: ${TIME_CONSTANTS.CHECKIN_START_HOUR}-${TIME_CONSTANTS.CHECKIN_END_HOUR})`
        );
    }

    res.json({ success: true, timestamp: now.toISOString() });
});
