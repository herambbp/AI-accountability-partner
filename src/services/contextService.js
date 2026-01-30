import {
    formatDateTime,
    getTimeOfDay,
    calculateRelativeTime,
    calculateTimeGap,
    formatReminderTime,
} from "../utils/dateUtils.js";

/**
 * Service for building conversation context for AI
 */
export const contextService = {
    /**
     * Build full context from messages, schedules, and summary
     * @param {Array} messages - Recent messages
     * @param {Array} schedules - Active schedules
     * @param {string|null} summary - Conversation summary
     * @returns {string} Formatted context string
     */
    buildContext(messages, schedules, summary = null) {
        const now = new Date();
        const formatted = formatDateTime(now);
        const hour = now.getHours();
        const timeOfDay = getTimeOfDay(hour);

        let context = `\n\n---
## TIME CONTEXT
**Current time:** ${formatted.full} (IST)
**Time of day:** ${timeOfDay}
**Day:** ${formatted.weekday}

Use this to contextualize your responses (e.g., "It's late, why are you still up?" or "Good morning!" or "How was your day?")
---`;

        // Add summary section
        if (summary) {
            context += `\n\n## CONVERSATION HISTORY SUMMARY
*This summarizes your earlier conversations with them (older messages):*

${summary}

---`;
        }

        // Add schedules section
        if (schedules?.length) {
            context += "\n\n## THEIR ACTIVE REMINDERS\n";
            schedules.forEach((s) => {
                const reminderTime = formatReminderTime(s.hour, s.minute);
                context += `- **${s.title}** at ${reminderTime} on ${s.days.join(", ")}\n`;
            });
            context +=
                "\n(You can reference these - ask if they did them, how it went, etc.)";
        }

        // Add messages section
        if (messages?.length) {
            context += this._buildMessagesContext(messages, now);
        }

        // Add time gap analysis
        if (messages?.length) {
            const lastMsg = messages[messages.length - 1];
            const lastMsgTime = new Date(lastMsg.created_at);
            const gap = calculateTimeGap(lastMsgTime, now);

            context += `\n---\n## TIME SINCE LAST MESSAGE\n${gap.description}\n---`;
        }

        return context;
    },

    /**
     * Build messages portion of context
     * @private
     */
    _buildMessagesContext(messages, now) {
        let context = "\n\n## RECENT CONVERSATION HISTORY\n";
        context += "*Messages are labeled with timestamps. Use these to:*\n";
        context +=
            '- *Reference specific moments ("yesterday morning you said...", "3 days ago you promised...")*\n';
        context +=
            '- *Notice patterns ("you always message late at night", "you disappeared for 2 days")*\n';
        context += "- *Track time between check-ins*\n\n";

        let lastDate = "";

        messages.forEach((m) => {
            const msgDate = new Date(m.created_at);
            const relativeTime = calculateRelativeTime(msgDate, now);
            const formatted = formatDateTime(msgDate);

            // Add date header if it's a new day
            if (formatted.date !== lastDate) {
                context += `\n### 📅 ${formatted.date}\n`;
                lastDate = formatted.date;
            }

            const role = m.role === "user" ? "**THEM**" : "**YOU**";
            context += `[${formatted.time} - ${relativeTime}] ${role}:\n${m.content}\n\n`;
        });

        return context;
    },
};
