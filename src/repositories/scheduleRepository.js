import { supabase } from "../config/index.js";

/**
 * Repository for schedule-related database operations
 */
export const scheduleRepository = {
    /**
     * Create a new schedule
     * @param {Object} scheduleData - Schedule data
     * @returns {Promise<Object>} Created schedule
     */
    async create({ userId, title, description, hour, minute, days }) {
        const { data, error } = await supabase
            .from("schedules")
            .insert({
                user_id: userId,
                title,
                description,
                hour,
                minute,
                days,
                is_active: true,
            })
            .select()
            .single();

        if (error) throw error;

        return data;
    },

    /**
     * Find all schedules for a user
     * @param {string} userId - User ID
     * @returns {Promise<Array>}
     */
    async findByUserId(userId) {
        const { data, error } = await supabase
            .from("schedules")
            .select("*")
            .eq("user_id", userId)
            .order("created_at", { ascending: false });

        if (error) throw error;

        return data || [];
    },

    /**
     * Find only active schedules for a user
     * @param {string} userId - User ID
     * @returns {Promise<Array>}
     */
    async findActiveByUserId(userId) {
        const { data, error } = await supabase
            .from("schedules")
            .select("*")
            .eq("user_id", userId)
            .eq("is_active", true);

        if (error) throw error;

        return data || [];
    },

    /**
     * Find schedules due at a specific time
     * @param {number} hour - Hour (0-23)
     * @param {number} minute - Minute (0-59)
     * @param {string} day - Day of week (mon, tue, etc.)
     * @returns {Promise<Array>}
     */
    async findDueSchedules(hour, minute, day) {
        const { data, error } = await supabase
            .from("schedules")
            .select("*")
            .eq("is_active", true)
            .eq("hour", hour)
            .gte("minute", minute - 5)
            .lte("minute", minute + 5)
            .contains("days", [day]);

        if (error) {
            console.log("Error fetching schedules:", error);
            return [];
        }

        return data || [];
    },

    /**
     * Delete a schedule by ID
     * @param {string} id - Schedule ID
     */
    async deleteById(id) {
        const { error } = await supabase.from("schedules").delete().eq("id", id);

        if (error) throw error;
    },

    /**
     * Toggle schedule active status
     * @param {string} id - Schedule ID
     * @returns {Promise<Object>} Updated schedule
     */
    async toggleActive(id) {
        const { data: current } = await supabase
            .from("schedules")
            .select("is_active")
            .eq("id", id)
            .single();

        const { data, error } = await supabase
            .from("schedules")
            .update({ is_active: !current?.is_active })
            .eq("id", id)
            .select()
            .single();

        if (error) throw error;

        return data;
    },
};
