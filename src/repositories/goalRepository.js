import { supabase } from "../config/index.js";

/**
 * Repository for goal, key result, and KPI operations
 */
export const goalRepository = {
    /**
     * Create a new goal
     * @param {string} userId - User ID
     * @param {Object} goalData - Goal data
     * @returns {Promise<Object>} Created goal
     */
    async create(userId, goalData) {
        const { data, error } = await supabase
            .from("goals")
            .insert({
                user_id: userId,
                objective: goalData.objective,
                context: goalData.context || null,
                start_date: goalData.startDate || new Date().toISOString().split("T")[0],
                end_date: goalData.endDate,
                status: "active",
            })
            .select()
            .single();

        if (error) throw error;
        return data;
    },

    /**
     * Find all goals for a user with key results and KPIs
     * @param {string} userId - User ID
     * @returns {Promise<Array>}
     */
    async findByUserId(userId) {
        const { data, error } = await supabase
            .from("goals")
            .select("*, key_results(*), kpis(*)")
            .eq("user_id", userId)
            .order("created_at", { ascending: false });

        if (error) throw error;
        return data || [];
    },

    /**
     * Find active goals for a user with key results and KPIs
     * @param {string} userId - User ID
     * @returns {Promise<Array>}
     */
    async findActiveByUserId(userId) {
        const { data, error } = await supabase
            .from("goals")
            .select("*, key_results(*), kpis(*)")
            .eq("user_id", userId)
            .eq("status", "active")
            .order("created_at", { ascending: false });

        if (error) throw error;
        return data || [];
    },

    /**
     * Find a goal by ID with key results and KPIs
     * @param {string} goalId - Goal ID
     * @returns {Promise<Object|null>}
     */
    async findById(goalId) {
        const { data, error } = await supabase
            .from("goals")
            .select("*, key_results(*), kpis(*)")
            .eq("id", goalId)
            .single();

        if (error && error.code !== "PGRST116") throw error;
        return data;
    },

    /**
     * Update goal status
     * @param {string} goalId - Goal ID
     * @param {string} status - New status
     * @returns {Promise<Object>} Updated goal
     */
    async updateStatus(goalId, status) {
        const { data, error } = await supabase
            .from("goals")
            .update({ status, updated_at: new Date().toISOString() })
            .eq("id", goalId)
            .select()
            .single();

        if (error) throw error;
        return data;
    },

    /**
     * Count active goals for a user
     * @param {string} userId - User ID
     * @returns {Promise<number>}
     */
    async countActiveByUserId(userId) {
        const { count, error } = await supabase
            .from("goals")
            .select("*", { count: "exact", head: true })
            .eq("user_id", userId)
            .eq("status", "active");

        if (error) throw error;
        return count || 0;
    },

    /**
     * Create a key result for a goal
     * @param {string} goalId - Goal ID
     * @param {Object} krData - Key result data
     * @returns {Promise<Object>} Created key result
     */
    async createKeyResult(goalId, krData) {
        const { data, error } = await supabase
            .from("key_results")
            .insert({
                goal_id: goalId,
                description: krData.description,
                target_value: krData.targetValue,
                current_value: krData.currentValue || 0,
                unit: krData.unit || "count",
            })
            .select()
            .single();

        if (error) throw error;
        return data;
    },

    /**
     * Update a key result's current value
     * @param {string} krId - Key result ID
     * @param {Object} updates - Update data
     * @returns {Promise<Object>} Updated key result
     */
    async updateKeyResult(krId, updates) {
        const { data, error } = await supabase
            .from("key_results")
            .update({ current_value: updates.currentValue })
            .eq("id", krId)
            .select()
            .single();

        if (error) throw error;
        return data;
    },

    /**
     * Create a KPI for a goal
     * @param {string} goalId - Goal ID
     * @param {Object} kpiData - KPI data
     * @returns {Promise<Object>} Created KPI
     */
    async createKpi(goalId, kpiData) {
        const { data, error } = await supabase
            .from("kpis")
            .insert({
                goal_id: goalId,
                name: kpiData.name,
                type: kpiData.type || "number",
                daily_target: kpiData.dailyTarget || null,
            })
            .select()
            .single();

        if (error) throw error;
        return data;
    },

    /**
     * Find all unique user IDs with active goals
     * @returns {Promise<string[]>}
     */
    async findAllUsersWithActiveGoals() {
        const { data, error } = await supabase
            .from("goals")
            .select("user_id")
            .eq("status", "active");

        if (error) throw error;
        return [...new Set((data || []).map((g) => g.user_id))];
    },
};
