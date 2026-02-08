/**
 * WhatsApp configuration for Meta Cloud API (direct REST)
 */
export function getWhatsAppConfig() {
    return {
        phoneNumberId: process.env.WHATSAPP_PHONE_NUMBER_ID,
        accessToken: process.env.WHATSAPP_ACCESS_TOKEN,
        businessAccountId: process.env.WHATSAPP_BUSINESS_ACCOUNT_ID,
    };
}
