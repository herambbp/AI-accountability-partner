import { supabase } from "../config/index.js";

export const dailyLogRepository = {
    async upsert(goalId, userId, logDate, kpiValues, notes = null) {
        const { data, error } = await supabase
            .from("daily_logs")
            .upsert(
                {
                    goal_id: goalId,
                    user_id: userId,
                    log_date: logDate,
                    kpi_values: kpiValues,
                    notes,
                },
                { onConflict: "goal_id,log_date" }
            )
            .select()
            .single();

        if (error) throw error;
        return data;
    },

    async findByGoalId(goalId, { startDate, endDate } = {}) {
        let query = supabase
            .from("daily_logs")
            .select("*")
            .eq("goal_id", goalId)
            .order("log_date", { ascending: false });

        if (startDate) query = query.gte("log_date", startDate);
        if (endDate) query = query.lte("log_date", endDate);

        const { data, error } = await query;
        if (error) throw error;
        return data || [];
    },

    async findByUserAndDate(userId, logDate) {
        const { data, error } = await supabase
            .from("daily_logs")
            .select("*, goals(objective)")
            .eq("user_id", userId)
            .eq("log_date", logDate);

        if (error) throw error;
        return data || [];
    },

    async getStreak(goalId) {
        const { data, error } = await supabase
            .from("daily_logs")
            .select("log_date")
            .eq("goal_id", goalId)
            .order("log_date", { ascending: false });

        if (error) throw error;
        if (!data?.length) return 0;

        let streak = 0;
        const today = new Date().toISOString().split("T")[0];
        let checkDate = new Date(today);

        for (const log of data) {
            const logDate = log.log_date;
            const expected = checkDate.toISOString().split("T")[0];

            if (logDate === expected) {
                streak++;
                checkDate.setDate(checkDate.getDate() - 1);
            } else if (streak === 0 && logDate === new Date(checkDate.getTime() - 86400000).toISOString().split("T")[0]) {
                // Allow starting from yesterday if no log today yet
                checkDate.setDate(checkDate.getDate() - 1);
                if (logDate === checkDate.toISOString().split("T")[0]) {
                    streak++;
                    checkDate.setDate(checkDate.getDate() - 1);
                }
            } else {
                break;
            }
        }

        return streak;
    },

    async findRecentByUserId(userId, limit = 7) {
        const { data, error } = await supabase
            .from("daily_logs")
            .select("*, goals(objective)")
            .eq("user_id", userId)
            .order("log_date", { ascending: false })
            .limit(limit);

        if (error) throw error;
        return data || [];
    },
};
