import { aiService } from "./aiService.js";
import { goalService } from "./goalService.js";
import { goalRepository } from "../repositories/goalRepository.js";
import { dailyLogRepository } from "../repositories/dailyLogRepository.js";

export const progressReviewService = {
    async generateWeeklyReview(goalId) {
        const goal = await goalService.getGoalDetail(goalId);
        if (!goal) throw new Error("Goal not found");

        const sevenDaysAgo = new Date();
        sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
        const logs = await dailyLogRepository.findByGoalId(goalId, {
            startDate: sevenDaysAgo.toISOString().split("T")[0],
        });

        const context = buildReviewContext(goal, logs, "weekly");
        return aiService.generateWeeklyReview(context);
    },

    async generateMonthlyReview(goalId) {
        const goal = await goalService.getGoalDetail(goalId);
        if (!goal) throw new Error("Goal not found");

        const thirtyDaysAgo = new Date();
        thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
        const logs = await dailyLogRepository.findByGoalId(goalId, {
            startDate: thirtyDaysAgo.toISOString().split("T")[0],
        });

        const context = buildReviewContext(goal, logs, "monthly");
        return aiService.generateMonthlyReview(context);
    },

    async runAutomatedReviews() {
        const now = new Date();
        const dayOfWeek = now.getDay(); // 0 = Sunday
        const dayOfMonth = now.getDate();

        const userIds = await goalRepository.findAllUsersWithActiveGoals();
        const results = { weekly: [], monthly: [] };

        for (const userId of userIds) {
            const goals = await goalService.getActiveGoalsWithProgress(userId);

            for (const goal of goals) {
                // Weekly review on Sundays
                if (dayOfWeek === 0) {
                    try {
                        const review = await this.generateWeeklyReview(goal.id);
                        results.weekly.push({ goalId: goal.id, userId, review });
                    } catch (err) {
                        console.error(`Weekly review failed for goal ${goal.id}:`, err.message);
                    }
                }

                // Monthly review on 1st of month
                if (dayOfMonth === 1) {
                    try {
                        const review = await this.generateMonthlyReview(goal.id);
                        results.monthly.push({ goalId: goal.id, userId, review });
                    } catch (err) {
                        console.error(`Monthly review failed for goal ${goal.id}:`, err.message);
                    }
                }
            }
        }

        return results;
    },
};

function buildReviewContext(goal, logs, type) {
    const now = new Date();
    const lines = [
        `## Time Context`,
        `**Today:** ${now.toISOString().split("T")[0]} (${now.toLocaleDateString("en-IN", { weekday: "long" })})`,
        `**Goal started:** ${goal.start_date} (${goal.progress.daysElapsed} days ago)`,
        `**Goal ends:** ${goal.end_date} (${goal.progress.daysRemaining} days from now)`,
        "",
        `## Goal: ${goal.objective}`,
        goal.context ? `**Why:** ${goal.context}` : "",
        `**Status:** ${goal.status} | **Progress:** ${goal.progress.percent}% | **Pace:** ${goal.progress.pace}`,
        `**Days elapsed:** ${goal.progress.daysElapsed} of ${goal.progress.totalDays} | **Days remaining:** ${goal.progress.daysRemaining}`,
        "",
        "### Key Results:",
    ];

    if (goal.key_results?.length) {
        for (const kr of goal.key_results) {
            const pct = kr.target_value > 0 ? Math.round((kr.current_value / kr.target_value) * 100) : 0;
            lines.push(`- ${kr.description}: ${kr.current_value}/${kr.target_value} ${kr.unit} (${pct}%)`);
        }
    }

    lines.push("", "### KPIs:");
    if (goal.kpis?.length) {
        for (const kpi of goal.kpis) {
            lines.push(`- ${kpi.name} (${kpi.type})${kpi.daily_target ? ` — target: ${JSON.stringify(kpi.daily_target)}` : ""}`);
        }
    }

    lines.push("", `### ${type === "weekly" ? "Last 7 days" : "Last 30 days"} logs:`);
    if (logs.length) {
        const daysLogged = logs.length;
        const expectedDays = type === "weekly" ? 7 : 30;
        lines.push(`Logged ${daysLogged}/${expectedDays} days`);
        for (const log of logs.slice(0, 10)) {
            lines.push(`- ${log.log_date}: ${JSON.stringify(log.kpi_values)}${log.notes ? ` — "${log.notes}"` : ""}`);
        }
    } else {
        lines.push("No logs recorded.");
    }

    if (goal.streak !== undefined) {
        lines.push("", `**Current streak:** ${goal.streak} days`);
    }

    return lines.join("\n");
}
