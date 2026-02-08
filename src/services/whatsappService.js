import { getWhatsAppConfig } from "../config/whatsapp.js";
import { whatsappContactRepository } from "../repositories/whatsappContactRepository.js";
import { goalService } from "./goalService.js";
import { dailyLogRepository } from "../repositories/dailyLogRepository.js";

export const whatsappService = {
    async sendMessage(phoneNumber, message) {
        const config = getWhatsAppConfig();
        if (!config.phoneNumberId || !config.accessToken) {
            console.warn("WhatsApp not configured — skipping message");
            return null;
        }

        const url = `https://graph.facebook.com/v21.0/${config.phoneNumberId}/messages`;

        const response = await fetch(url, {
            method: "POST",
            headers: {
                Authorization: `Bearer ${config.accessToken}`,
                "Content-Type": "application/json",
            },
            body: JSON.stringify({
                messaging_product: "whatsapp",
                to: phoneNumber.replace("+", ""),
                type: "text",
                text: { body: message },
            }),
        });

        if (!response.ok) {
            const err = await response.text();
            console.error(`WhatsApp send failed to ${phoneNumber}:`, err);
            return null;
        }

        return response.json();
    },

    async sendDailyProgress(userId) {
        const contacts = await whatsappContactRepository.findActiveByUserId(userId);
        if (!contacts.length) return { sent: 0 };

        const goals = await goalService.getActiveGoalsWithProgress(userId);
        if (!goals.length) return { sent: 0 };

        const today = new Date().toISOString().split("T")[0];
        const todayLogs = await dailyLogRepository.findByUserAndDate(userId, today);

        const message = formatDailyProgressMessage(goals, todayLogs);

        let sent = 0;
        for (const contact of contacts) {
            const personalMessage = `Hey ${contact.name}! ${message}`;
            const result = await this.sendMessage(contact.phone_number, personalMessage);
            if (result) sent++;
        }

        return { sent, total: contacts.length };
    },

    async sendWeeklyReview(userId, reviewText) {
        const contacts = await whatsappContactRepository.findActiveByUserId(userId);
        if (!contacts.length) return { sent: 0 };

        let sent = 0;
        for (const contact of contacts) {
            const message = `Hey ${contact.name}! Here's the weekly review:\n\n${reviewText}`;
            const result = await this.sendMessage(contact.phone_number, message);
            if (result) sent++;
        }

        return { sent, total: contacts.length };
    },

    async sendAllDailyProgress() {
        const userIds = await whatsappContactRepository.findAllUsersWithActiveContacts();
        const results = [];

        for (const userId of userIds) {
            try {
                const result = await this.sendDailyProgress(userId);
                results.push({ userId, ...result });
            } catch (err) {
                console.error(`WhatsApp daily progress failed for user ${userId}:`, err.message);
                results.push({ userId, error: err.message });
            }
        }

        return results;
    },
};

function formatDailyProgressMessage(goals, todayLogs) {
    const lines = ["Here's today's progress update:\n"];

    for (const goal of goals) {
        lines.push(`*${goal.objective}* — ${goal.progress.percent}% complete (${goal.progress.pace.replace("_", " ")})`);

        // Check if logged today
        const log = todayLogs.find((l) => l.goal_id === goal.id);
        if (log) {
            const values = log.kpi_values || [];
            if (values.length) {
                const kpiSummary = values.map((v) => `${v.name || v.kpiId}: ${v.value}`).join(", ");
                lines.push(`  Today: ${kpiSummary}`);
            }
            if (log.notes) lines.push(`  Notes: ${log.notes}`);
        } else {
            lines.push("  No log submitted today yet.");
        }

        // Key results summary
        if (goal.key_results?.length) {
            for (const kr of goal.key_results) {
                const pct = kr.target_value > 0 ? Math.round((kr.current_value / kr.target_value) * 100) : 0;
                lines.push(`  → ${kr.description}: ${kr.current_value}/${kr.target_value} (${pct}%)`);
            }
        }
        lines.push("");
    }

    lines.push("Keep going! 💪");
    return lines.join("\n");
}
