import { supabase } from "../config/index.js";

export const whatsappContactRepository = {
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

    async findByUserId(userId) {
        const { data, error } = await supabase
            .from("whatsapp_contacts")
            .select("*")
            .eq("user_id", userId)
            .order("created_at", { ascending: true });

        if (error) throw error;
        return data || [];
    },

    async findActiveByUserId(userId) {
        const { data, error } = await supabase
            .from("whatsapp_contacts")
            .select("*")
            .eq("user_id", userId)
            .eq("is_active", true);

        if (error) throw error;
        return data || [];
    },

    async deleteById(contactId) {
        const { error } = await supabase
            .from("whatsapp_contacts")
            .delete()
            .eq("id", contactId);

        if (error) throw error;
    },

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

    async findAllUsersWithActiveContacts() {
        const { data, error } = await supabase
            .from("whatsapp_contacts")
            .select("user_id")
            .eq("is_active", true);

        if (error) throw error;
        const unique = [...new Set((data || []).map((c) => c.user_id))];
        return unique;
    },
};
