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
     * Build full context from messages, schedules, summary, and goals
     * @param {Array} messages - Recent messages
     * @param {Array} schedules - Active schedules
     * @param {string|null} summary - Conversation summary
     * @param {Array|null} goals - Active goals with progress
     * @param {Array|null} todayLogs - Today's daily logs
     * @returns {string} Formatted context string
     */
    buildContext(messages, schedules, summary = null, goals = null, todayLogs = null) {
        const now = new Date();
        const sections = [
            buildTimeContext(now),
            buildSummarySection(summary),
            buildGoalsSection(goals, todayLogs),
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

function buildGoalsSection(goals, todayLogs) {
    if (!goals?.length) return null;

    const lines = ["\n\n## GOALS CONTEXT", "*Active goals with progress and KPI IDs (use these IDs when logging KPIs):*\n"];

    for (const goal of goals) {
        const p = goal.progress;
        lines.push(`### Goal: ${goal.objective} [ID: ${goal.id}]`);
        lines.push(`**Status:** ${goal.status} | **Progress:** ${p.percent}% | **Pace:** ${p.pace} | **Days left:** ${p.daysRemaining}/${p.totalDays}`);

        if (goal.context) lines.push(`**Why:** ${goal.context}`);

        if (goal.key_results?.length) {
            lines.push("**Key Results:**");
            for (const kr of goal.key_results) {
                const pct = kr.target_value > 0 ? Math.round((kr.current_value / kr.target_value) * 100) : 0;
                lines.push(`- ${kr.description}: ${kr.current_value}/${kr.target_value} ${kr.unit} (${pct}%) [KR ID: ${kr.id}]`);
            }
        }

        if (goal.kpis?.length) {
            lines.push("**Daily KPIs:**");
            for (const kpi of goal.kpis) {
                const target = kpi.daily_target ? ` — target: ${JSON.stringify(kpi.daily_target)}` : "";
                lines.push(`- ${kpi.name} (${kpi.type})${target} [KPI ID: ${kpi.id}]`);
            }
        }

        // Check today's log
        const todayLog = todayLogs?.find((l) => l.goal_id === goal.id);
        if (todayLog) {
            lines.push(`**Today's log:** ✅ Logged — ${JSON.stringify(todayLog.kpi_values)}`);
        } else {
            lines.push("**Today's log:** ❌ Not yet logged");
        }

        lines.push("");
    }

    lines.push("**IMPORTANT: These goals already exist. Do NOT create a new \`\`\`goal block for any topic already covered above. Reference existing goals by name instead. Only create a NEW goal if it's a genuinely different objective.**");
    lines.push("(Reference these goals naturally. Ask about progress. Remind them to log KPIs if not done today.)");
    return lines.join("\n");
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
