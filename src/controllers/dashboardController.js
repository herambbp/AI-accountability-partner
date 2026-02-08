import { goalService } from "../services/goalService.js";
import { dailyLogRepository } from "../repositories/dailyLogRepository.js";
import { asyncHandler } from "../middleware/errorHandler.js";

export const getDashboard = asyncHandler(async (req, res) => {
    const { userId } = req.params;

    const [goals, recentLogs] = await Promise.all([
        goalService.getGoalsWithProgress(userId),
        dailyLogRepository.findRecentByUserId(userId, 7),
    ]);

    const activeGoals = goals.filter((g) => g.status === "active");

    // Calculate streaks for active goals
    const streaks = {};
    for (const goal of activeGoals) {
        streaks[goal.id] = await dailyLogRepository.getStreak(goal.id);
    }

    // Today's log status
    const today = new Date().toISOString().split("T")[0];
    const todayLogs = await dailyLogRepository.findByUserAndDate(userId, today);
    const loggedToday = todayLogs.map((l) => l.goal_id);

    res.json({
        goals,
        activeGoals: activeGoals.length,
        totalGoals: goals.length,
        streaks,
        recentLogs,
        todayStatus: {
            date: today,
            loggedGoals: loggedToday,
            missingGoals: activeGoals.filter((g) => !loggedToday.includes(g.id)).map((g) => g.id),
        },
    });
});
