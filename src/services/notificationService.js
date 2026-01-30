import { expo } from "../config/index.js";
import { Expo } from "expo-server-sdk";

/**
 * Service for push notifications via Expo
 */
export const notificationService = {
    /**
     * Check if a push token is valid
     * @param {string} token - Expo push token
     * @returns {boolean}
     */
    isValidToken(token) {
        return Expo.isExpoPushToken(token);
    },

    /**
     * Send a push notification
     * @param {string} pushToken - Expo push token
     * @param {string} title - Notification title
     * @param {string} body - Notification body
     * @param {Object} data - Additional data payload
     * @returns {Promise<Object>} Result with success flag
     */
    async send(pushToken, title, body, data = {}) {
        console.log(
            `Attempting to send push notification to: ${pushToken?.substring(0, 30)}...`
        );

        if (!this.isValidToken(pushToken)) {
            console.log("Invalid push token:", pushToken);
            return { success: false, error: "Invalid token" };
        }

        try {
            const result = await expo.sendPushNotificationsAsync([
                {
                    to: pushToken,
                    sound: "default",
                    title,
                    body,
                    data,
                },
            ]);

            console.log("Push notification result:", JSON.stringify(result));
            return { success: true, result };
        } catch (error) {
            console.error("Push notification error:", error);
            return { success: false, error: error.message };
        }
    },

    /**
     * Send a schedule reminder notification
     * @param {string} pushToken - Expo push token
     * @param {Object} schedule - Schedule object
     */
    async sendScheduleReminder(pushToken, schedule) {
        return this.send(
            pushToken,
            `⏰ ${schedule.title}`,
            schedule.description || "Time for your scheduled activity!",
            { type: "schedule", scheduleId: schedule.id }
        );
    },

    /**
     * Send a check-in notification
     * @param {string} pushToken - Expo push token
     * @param {string} message - Check-in message
     */
    async sendCheckin(pushToken, message) {
        return this.send(pushToken, "👋 Quick check-in", message, {
            type: "checkin",
        });
    },
};
