import WhatsApp from "whatsapp";

let whatsappClient = null;

function getWhatsAppClient() {
    if (whatsappClient) return whatsappClient;

    const phoneNumberId = process.env.WHATSAPP_PHONE_NUMBER_ID;
    const accessToken = process.env.WHATSAPP_ACCESS_TOKEN;
    const businessAccountId = process.env.WHATSAPP_BUSINESS_ACCOUNT_ID;

    if (!phoneNumberId || !accessToken) {
        console.warn("WhatsApp credentials not configured — WhatsApp notifications disabled");
        return null;
    }

    whatsappClient = new WhatsApp(phoneNumberId);
    return whatsappClient;
}

export function getWhatsAppConfig() {
    return {
        phoneNumberId: process.env.WHATSAPP_PHONE_NUMBER_ID,
        accessToken: process.env.WHATSAPP_ACCESS_TOKEN,
        businessAccountId: process.env.WHATSAPP_BUSINESS_ACCOUNT_ID,
    };
}

export { getWhatsAppClient };
