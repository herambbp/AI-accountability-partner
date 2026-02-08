import { google } from "googleapis";

let sheetsClient = null;

function getSheetsClient() {
    if (sheetsClient) return sheetsClient;

    const email = process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL;
    const key = process.env.GOOGLE_PRIVATE_KEY;

    if (!email || !key) {
        console.warn("Google Sheets credentials not configured — sheets sync disabled");
        return null;
    }

    const auth = new google.auth.JWT(
        email,
        null,
        key.replace(/\\n/g, "\n"),
        ["https://www.googleapis.com/auth/spreadsheets"]
    );

    sheetsClient = google.sheets({ version: "v4", auth });
    return sheetsClient;
}

export { getSheetsClient };
