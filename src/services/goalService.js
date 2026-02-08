import { goalRepository } from "../repositories/goalRepository.js";
import { dailyLogRepository } from "../repositories/dailyLogRepository.js";

const MAX_ACTIVE_GOALS = 3;

export const goalService = {
    async createGoalFromAI(userId, goalData) {
        const activeCount = await goalRepository.countActiveByUserId(userId);
        if (activeCount >= MAX_ACTIVE_GOALS) {
            throw new Error(`Maximum ${MAX_ACTIVE_GOALS} active goals allowed. Complete or pause an existing goal first.`);
        }

        const endDate = new Date();
        endDate.setDate(endDate.getDate() + (goalData.durationDays || 90));

        const goal = await goalRepository.create(userId, {
            objective: goalData.objective,
            context: goalData.context,
            startDate: goalData.startDate,
            endDate: goalData.endDate || endDate.toISOString().split("T")[0],
        });

        // Create key results
        if (goalData.keyResults?.length) {
            for (const kr of goalData.keyResults) {
                await goalRepository.createKeyResult(goal.id, {
                    description: kr.description,
                    targetValue: kr.targetValue,
                    unit: kr.unit || "count",
                });
            }
        }

        // Create KPIs
        if (goalData.kpis?.length) {
            for (const kpi of goalData.kpis) {
                await goalRepository.createKpi(goal.id, {
                    name: kpi.name,
                    type: kpi.type || "number",
                    dailyTarget: kpi.dailyTarget || null,
                });
            }
        }

        return goalRepository.findById(goal.id);
    },

    async getGoalsWithProgress(userId) {
        const goals = await goalRepository.findByUserId(userId);
        return goals.map(addProgressToGoal);
    },

    async getActiveGoalsWithProgress(userId) {
        const goals = await goalRepository.findActiveByUserId(userId);
        return goals.map(addProgressToGoal);
    },

    async getGoalDetail(goalId) {
        const goal = await goalRepository.findById(goalId);
        if (!goal) return null;

        const [streak, logs] = await Promise.all([
            dailyLogRepository.getStreak(goalId),
            dailyLogRepository.findByGoalId(goalId),
        ]);

        const enriched = addProgressToGoal(goal);
        enriched.streak = streak;
        enriched.recentLogs = logs.slice(0, 7);
        return enriched;
    },

    async updateGoalStatus(goalId, status) {
        return goalRepository.updateStatus(goalId, status);
    },

    async updateKeyResult(krId, currentValue) {
        return goalRepository.updateKeyResult(krId, { currentValue });
    },
};

function addProgressToGoal(goal) {
    const now = new Date();
    const start = new Date(goal.start_date);
    const end = new Date(goal.end_date);

    const totalDays = Math.ceil((end - start) / (1000 * 60 * 60 * 24));
    const daysElapsed = Math.ceil((now - start) / (1000 * 60 * 60 * 24));
    const daysRemaining = Math.max(0, Math.ceil((end - now) / (1000 * 60 * 60 * 24)));

    // Calculate progress from key results
    let progressPercent = 0;
    if (goal.key_results?.length) {
        const totalProgress = goal.key_results.reduce((sum, kr) => {
            const pct = kr.target_value > 0 ? (kr.current_value / kr.target_value) * 100 : 0;
            return sum + Math.min(pct, 100);
        }, 0);
        progressPercent = Math.round(totalProgress / goal.key_results.length);
    }

    // Pace indicator
    const expectedProgress = totalDays > 0 ? (daysElapsed / totalDays) * 100 : 0;
    let pace = "on_track";
    if (progressPercent < expectedProgress - 10) pace = "behind";
    else if (progressPercent > expectedProgress + 10) pace = "ahead";

    return {
        ...goal,
        progress: {
            percent: progressPercent,
            daysElapsed,
            daysRemaining,
            totalDays,
            pace,
        },
    };
}
