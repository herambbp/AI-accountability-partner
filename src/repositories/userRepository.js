import { supabase } from "../config/index.js";

/**
 * Repository for user profile and activity operations
 */
export const userRepository = {
    /**
     * Find user profile by ID
     * @param {string} userId - User ID
     * @returns {Promise<Object|null>}
     */
    async findProfileById(userId) {
        const { data, error } = await supabase
            .from("user_profiles")
            .select("*")
            .eq("id", userId)
            .single();

        if (error && error.code !== "PGRST116") throw error;

        return data;
    },

    /**
     * Get conversation summary for a user
     * @param {string} userId - User ID
     * @returns {Promise<Object>}
     */
    async getSummaryData(userId) {
        const { data } = await supabase
            .from("user_profiles")
            .select("conversation_summary, messages_summarized, summary_updated_at")
            .eq("id", userId)
            .single();

        return {
            summary: data?.conversation_summary || null,
            messagesSummarized: data?.messages_summarized || 0,
            updatedAt: data?.summary_updated_at || null,
        };
    },

    /**
     * Update conversation summary
     * @param {string} userId - User ID
     * @param {string} summary - New summary text
     * @param {number} messagesSummarized - Number of messages summarized
     */
    async updateSummary(userId, summary, messagesSummarized) {
        const { error } = await supabase
            .from("user_profiles")
            .update({
                conversation_summary: summary,
                messages_summarized: messagesSummarized,
                summary_updated_at: new Date().toISOString(),
            })
            .eq("id", userId);

        if (error) throw error;
    },

    /**
     * Upsert push token for a user
     * @param {string} userId - User ID
     * @param {string} token - Expo push token
     */
    async upsertPushToken(userId, token) {
        const { error } = await supabase.from("user_profiles").upsert({
            id: userId,
            expo_push_token: token,
            updated_at: new Date().toISOString(),
        });

        if (error) throw error;
    },

    /**
     * Get push token for a user
     * @param {string} userId - User ID
     * @returns {Promise<string|null>}
     */
    async getPushToken(userId) {
        const { data } = await supabase
            .from("user_profiles")
            .select("expo_push_token")
            .eq("id", userId)
            .single();

        return data?.expo_push_token || null;
    },

    /**
     * Update user activity timestamp
     * @param {string} userId - User ID
     */
    async updateActivity(userId) {
        const { error } = await supabase.from("user_activity").upsert({
            user_id: userId,
            last_active_at: new Date().toISOString(),
        });

        if (error) throw error;
    },

    /**
     * Find inactive users for proactive check-ins
     * @param {string} sinceTime - ISO timestamp
     * @returns {Promise<Array>}
     */
    async findInactiveUsers(sinceTime) {
        const { data, error } = await supabase
            .from("user_activity")
            .select("user_id, last_active_at, last_checkin_at")
            .lt("last_active_at", sinceTime);

        if (error) {
            console.log("Error fetching inactive users:", error);
            return [];
        }

        return data || [];
    },

    /**
     * Update last check-in time
     * @param {string} userId - User ID
     */
    async updateLastCheckin(userId) {
        const { error } = await supabase
            .from("user_activity")
            .update({ last_checkin_at: new Date().toISOString() })
            .eq("user_id", userId);

        if (error) throw error;
    },

    /**
     * Get debug info for a user
     * @param {string} userId - User ID
     * @returns {Promise<Object>}
     */
    async getDebugInfo(userId) {
        const [{ data: profile }, { data: activity }, { count: messageCount }] =
            await Promise.all([
                supabase.from("user_profiles").select("*").eq("id", userId).single(),
                supabase.from("user_activity").select("*").eq("user_id", userId).single(),
                supabase
                    .from("messages")
                    .select("*", { count: "exact", head: true })
                    .eq("user_id", userId),
            ]);

        return {
            profile: {
                id: profile?.id,
                hasPushToken: !!profile?.expo_push_token,
                pushTokenPreview: profile?.expo_push_token?.substring(0, 30) + "...",
                hasSummary: !!profile?.conversation_summary,
                messagesSummarized: profile?.messages_summarized || 0,
                summaryUpdatedAt: profile?.summary_updated_at,
            },
            activity,
            messageCount,
        };
    },
};
