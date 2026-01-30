import { TIME_CONSTANTS, DAYS_MAP } from "../config/constants.js";

/**
 * Get current time in IST timezone
 * @param {Date} date - Optional date to convert, defaults to now
 * @returns {Date} Date adjusted to IST
 */
export function getISTTime(date = new Date()) {
    return new Date(date.getTime() + TIME_CONSTANTS.IST_OFFSET_MS);
}

/**
 * Get time of day description
 * @param {number} hour - Hour in 24-hour format
 * @returns {string} morning, afternoon, evening, or night
 */
export function getTimeOfDay(hour) {
    if (hour >= 5 && hour < 12) return "morning";
    if (hour >= 12 && hour < 17) return "afternoon";
    if (hour >= 17 && hour < 21) return "evening";
    return "night";
}

/**
 * Get lowercase day name for a date
 * @param {Date} date
 * @returns {string} sun, mon, tue, wed, thu, fri, or sat
 */
export function getDayName(date) {
    return DAYS_MAP[date.getUTCDay()];
}

/**
 * Format date for display in IST
 * @param {Date} date
 * @returns {Object} Object with formatted date and time strings
 */
export function formatDateTime(date) {
    const options = { timeZone: "Asia/Kolkata" };

    return {
        full: date.toLocaleString("en-IN", {
            ...options,
            weekday: "long",
            year: "numeric",
            month: "long",
            day: "numeric",
            hour: "2-digit",
            minute: "2-digit",
            hour12: true,
        }),
        date: date.toLocaleDateString("en-IN", {
            ...options,
            weekday: "long",
            month: "short",
            day: "numeric",
            year: "numeric",
        }),
        time: date.toLocaleTimeString("en-IN", {
            ...options,
            hour: "2-digit",
            minute: "2-digit",
            hour12: true,
        }),
        weekday: date.toLocaleDateString("en-IN", {
            ...options,
            weekday: "long",
        }),
    };
}

/**
 * Calculate human-readable relative time
 * @param {Date} fromDate - The past date
 * @param {Date} now - Current date to compare against
 * @returns {string} Human-readable relative time string
 */
export function calculateRelativeTime(fromDate, now = new Date()) {
    const diffMs = now - fromDate;
    const diffMins = Math.floor(diffMs / (1000 * 60));
    const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
    const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

    if (diffMins < 5) return "just now";
    if (diffMins < 60) return `${diffMins} minutes ago`;
    if (diffHours < 24) return `${diffHours} hours ago`;
    if (diffDays === 1) return "yesterday";
    if (diffDays < 7) return `${diffDays} days ago`;
    return `${Math.floor(diffDays / 7)} weeks ago`;
}

/**
 * Calculate time gap description for context building
 * @param {Date} lastMessageTime
 * @param {Date} now
 * @returns {Object} Object with gap info and description
 */
export function calculateTimeGap(lastMessageTime, now = new Date()) {
    const timeDiff = now - lastMessageTime;
    const hoursDiff = Math.floor(timeDiff / (1000 * 60 * 60));
    const daysDiff = Math.floor(timeDiff / (1000 * 60 * 60 * 24));

    let description = "";
    let severity = "low";

    if (daysDiff > 0) {
        description = `⚠️ **${daysDiff} day(s)** since they last messaged. `;
        if (daysDiff >= 3) {
            description +=
                "This is a significant gap - they might be avoiding, struggling, or just busy. Address this directly but with care.";
            severity = "high";
        } else {
            description += "Worth acknowledging - check in on how they've been.";
            severity = "medium";
        }
    } else if (hoursDiff > 6) {
        description = `It's been **${hoursDiff} hours** since they last messaged. `;
        description += "A decent gap - might ask what they've been up to.";
        severity = "medium";
    } else if (hoursDiff > 0) {
        description = `It's been **${hoursDiff} hour(s)** since their last message.`;
        severity = "low";
    } else {
        description = "They just messaged recently - this is an active conversation.";
        severity = "low";
    }

    return { hoursDiff, daysDiff, description, severity };
}

/**
 * Format reminder time string
 * @param {number} hour
 * @param {number} minute
 * @returns {string} Formatted time like "7:00" or "14:30"
 */
export function formatReminderTime(hour, minute) {
    return `${hour}:${String(minute).padStart(2, "0")}`;
}
