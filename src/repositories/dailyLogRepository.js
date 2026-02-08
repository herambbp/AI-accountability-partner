import { supabase } from "../config/index.js";

/**
 * Repository for daily log operations
 */
export const dailyLogRepository = {
    /**
     * Upsert a daily log (one per goal per day)
     * @param {string} goalId - Goal ID
     * @param {string} userId - User ID
     * @param {string} logDate - Date string (YYYY-MM-DD)
     * @param {Array} kpiValues - KPI values array
     * @param {string|null} notes - Optional notes
     * @returns {Promise<Object>} Upserted log
     */
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

    /**
     * Find logs for a goal with optional date range
     * @param {string} goalId - Goal ID
     * @param {Object} options - Date range options
     * @returns {Promise<Array>}
     */
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

    /**
     * Find all logs for a user on a specific date
     * @param {string} userId - User ID
     * @param {string} logDate - Date string (YYYY-MM-DD)
     * @returns {Promise<Array>}
     */
    async findByUserAndDate(userId, logDate) {
        const { data, error } = await supabase
            .from("daily_logs")
            .select("*, goals(objective)")
            .eq("user_id", userId)
            .eq("log_date", logDate);

        if (error) throw error;
        return data || [];
    },

    /**
     * Calculate current logging streak for a goal
     * @param {string} goalId - Goal ID
     * @returns {Promise<number>} Streak count in days
     */
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
            } else if (streak === 0) {
                // Allow starting from yesterday if no log today yet
                const yesterday = new Date(checkDate.getTime() - 86400000).toISOString().split("T")[0];
                if (logDate === yesterday) {
                    checkDate.setDate(checkDate.getDate() - 1);
                    streak++;
                    checkDate.setDate(checkDate.getDate() - 1);
                } else {
                    break;
                }
            } else {
                break;
            }
        }

        return streak;
    },

    /**
     * Find recent logs for a user
     * @param {string} userId - User ID
     * @param {number} limit - Max logs to return
     * @returns {Promise<Array>}
     */
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
