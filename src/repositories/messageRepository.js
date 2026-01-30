import { supabase } from "../config/index.js";

/**
 * Repository for message-related database operations
 */
export const messageRepository = {
    /**
     * Create a new message
     * @param {string} userId - User ID
     * @param {string} role - Either "user" or "assistant"
     * @param {string} content - Message content
     */
    async create(userId, role, content) {
        const { error } = await supabase.from("messages").insert({
            user_id: userId,
            role,
            content,
        });

        if (error) throw error;
    },

    /**
     * Find messages by user ID with pagination
     * @param {string} userId - User ID
     * @param {Object} options - Query options
     * @param {number} options.limit - Max messages to return
     * @param {string} options.before - Timestamp to fetch messages before
     * @returns {Promise<{messages: Array, hasMore: boolean}>}
     */
    async findByUserId(userId, { limit = 10, before = null } = {}) {
        let query = supabase
            .from("messages")
            .select("*")
            .eq("user_id", userId)
            .order("created_at", { ascending: false })
            .limit(limit);

        if (before) {
            query = query.lt("created_at", before);
        }

        const { data, error } = await query;

        if (error) throw error;

        return {
            messages: (data || []).reverse(),
            hasMore: data && data.length === limit,
        };
    },

    /**
     * Find recent messages for context building
     * @param {string} userId - User ID
     * @param {number} limit - Max messages
     * @returns {Promise<Array>}
     */
    async findRecentForContext(userId, limit = 10) {
        const { data, error } = await supabase
            .from("messages")
            .select("*")
            .eq("user_id", userId)
            .order("created_at", { ascending: false })
            .limit(limit);

        if (error) throw error;

        return (data || []).reverse();
    },

    /**
     * Find all messages for summary generation
     * @param {string} userId - User ID
     * @returns {Promise<Array>}
     */
    async findAllForSummary(userId) {
        const { data, error } = await supabase
            .from("messages")
            .select("*")
            .eq("user_id", userId)
            .order("created_at", { ascending: true });

        if (error) throw error;

        return data || [];
    },

    /**
     * Count messages for a user
     * @param {string} userId - User ID
     * @returns {Promise<number>}
     */
    async countByUserId(userId) {
        const { count, error } = await supabase
            .from("messages")
            .select("*", { count: "exact", head: true })
            .eq("user_id", userId);

        if (error) throw error;

        return count || 0;
    },
};
