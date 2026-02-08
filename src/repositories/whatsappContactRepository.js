import { supabase } from "../config/index.js";

/**
 * Repository for WhatsApp contact operations
 */
export const whatsappContactRepository = {
    /**
     * Create a new WhatsApp contact
     * @param {string} userId - User ID
     * @param {Object} contactData - Contact data
     * @returns {Promise<Object>} Created contact
     */
    async create(userId, contactData) {
        const { data, error } = await supabase
            .from("whatsapp_contacts")
            .insert({
                user_id: userId,
                phone_number: contactData.phoneNumber,
                name: contactData.name,
                is_active: true,
            })
            .select()
            .single();

        if (error) throw error;
        return data;
    },

    /**
     * Find all contacts for a user
     * @param {string} userId - User ID
     * @returns {Promise<Array>}
     */
    async findByUserId(userId) {
        const { data, error } = await supabase
            .from("whatsapp_contacts")
            .select("*")
            .eq("user_id", userId)
            .order("created_at", { ascending: true });

        if (error) throw error;
        return data || [];
    },

    /**
     * Find active contacts for a user
     * @param {string} userId - User ID
     * @returns {Promise<Array>}
     */
    async findActiveByUserId(userId) {
        const { data, error } = await supabase
            .from("whatsapp_contacts")
            .select("*")
            .eq("user_id", userId)
            .eq("is_active", true);

        if (error) throw error;
        return data || [];
    },

    /**
     * Delete a contact by ID
     * @param {string} contactId - Contact ID
     */
    async deleteById(contactId) {
        const { error } = await supabase
            .from("whatsapp_contacts")
            .delete()
            .eq("id", contactId);

        if (error) throw error;
    },

    /**
     * Toggle active status of a contact
     * @param {string} contactId - Contact ID
     * @returns {Promise<Object>} Updated contact
     */
    async toggleActive(contactId) {
        const { data: current } = await supabase
            .from("whatsapp_contacts")
            .select("is_active")
            .eq("id", contactId)
            .single();

        const { data, error } = await supabase
            .from("whatsapp_contacts")
            .update({ is_active: !current.is_active })
            .eq("id", contactId)
            .select()
            .single();

        if (error) throw error;
        return data;
    },

    /**
     * Find all unique user IDs with active contacts
     * @returns {Promise<string[]>}
     */
    async findAllUsersWithActiveContacts() {
        const { data, error } = await supabase
            .from("whatsapp_contacts")
            .select("user_id")
            .eq("is_active", true);

        if (error) throw error;
        return [...new Set((data || []).map((c) => c.user_id))];
    },
};
