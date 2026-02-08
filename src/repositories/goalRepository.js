import { supabase } from "../config/index.js";

export const goalRepository = {
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

    async findByUserId(userId) {
        const { data, error } = await supabase
            .from("goals")
            .select("*, key_results(*), kpis(*)")
            .eq("user_id", userId)
            .order("created_at", { ascending: false });

        if (error) throw error;
        return data || [];
    },

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

    async findById(goalId) {
        const { data, error } = await supabase
            .from("goals")
            .select("*, key_results(*), kpis(*)")
            .eq("id", goalId)
            .single();

        if (error && error.code !== "PGRST116") throw error;
        return data;
    },

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

    async countActiveByUserId(userId) {
        const { count, error } = await supabase
            .from("goals")
            .select("*", { count: "exact", head: true })
            .eq("user_id", userId)
            .eq("status", "active");

        if (error) throw error;
        return count || 0;
    },

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

    async findAllUsersWithActiveGoals() {
        const { data, error } = await supabase
            .from("goals")
            .select("user_id")
            .eq("status", "active");

        if (error) throw error;
        const unique = [...new Set((data || []).map((g) => g.user_id))];
        return unique;
    },
};
