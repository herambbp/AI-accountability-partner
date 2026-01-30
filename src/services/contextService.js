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
        const sections = [
            buildTimeContext(now),
            buildSummarySection(summary),
            buildSchedulesSection(schedules),
            buildMessagesSection(messages, now),
            buildTimeGapSection(messages, now),
        ];

        return sections.filter(Boolean).join("");
    },
};

function buildTimeContext(now) {
    const formatted = formatDateTime(now);
    const timeOfDay = getTimeOfDay(now.getHours());

    return `\n\n---
## TIME CONTEXT
**Current time:** ${formatted.full} (IST)
**Time of day:** ${timeOfDay}
**Day:** ${formatted.weekday}

Use this to contextualize your responses (e.g., "It's late, why are you still up?" or "Good morning!" or "How was your day?")
---`;
}

function buildSummarySection(summary) {
    if (!summary) return null;

    return `\n\n## CONVERSATION HISTORY SUMMARY
*This summarizes your earlier conversations with them (older messages):*

${summary}

---`;
}

function buildSchedulesSection(schedules) {
    if (!schedules?.length) return null;

    const lines = schedules.map((s) => {
        const reminderTime = formatReminderTime(s.hour, s.minute);
        return `- **${s.title}** at ${reminderTime} on ${s.days.join(", ")}`;
    });

    return `\n\n## THEIR ACTIVE REMINDERS
${lines.join("\n")}

(You can reference these - ask if they did them, how it went, etc.)`;
}

function buildMessagesSection(messages, now) {
    if (!messages?.length) return null;

    const parts = [
        "\n\n## RECENT CONVERSATION HISTORY",
        "*Messages are labeled with timestamps. Use these to:*",
        '- *Reference specific moments ("yesterday morning you said...", "3 days ago you promised...")*',
        '- *Notice patterns ("you always message late at night", "you disappeared for 2 days")*',
        "- *Track time between check-ins*\n",
    ];

    let lastDate = "";

    for (const m of messages) {
        const msgDate = new Date(m.created_at);
        const relativeTime = calculateRelativeTime(msgDate, now);
        const formatted = formatDateTime(msgDate);

        if (formatted.date !== lastDate) {
            parts.push(`\n### ${formatted.date}`);
            lastDate = formatted.date;
        }

        const role = m.role === "user" ? "**THEM**" : "**YOU**";
        parts.push(`[${formatted.time} - ${relativeTime}] ${role}:\n${m.content}\n`);
    }

    return parts.join("\n");
}

function buildTimeGapSection(messages, now) {
    if (!messages?.length) return null;

    const lastMsg = messages[messages.length - 1];
    const lastMsgTime = new Date(lastMsg.created_at);
    const gap = calculateTimeGap(lastMsgTime, now);

    return `\n---\n## TIME SINCE LAST MESSAGE\n${gap.description}\n---`;
}
