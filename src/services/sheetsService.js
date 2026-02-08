import { getSheetsClient } from "../config/sheets.js";
import { supabase } from "../config/index.js";
import { goalRepository } from "../repositories/goalRepository.js";
import { dailyLogRepository } from "../repositories/dailyLogRepository.js";

export const sheetsService = {
    async createSheetForUser(userId) {
        const sheets = getSheetsClient();
        if (!sheets) throw new Error("Google Sheets not configured");

        const response = await sheets.spreadsheets.create({
            requestBody: {
                properties: {
                    title: `Accountability Dashboard — ${userId.substring(0, 8)}`,
                },
                sheets: [
                    { properties: { title: "Goals Overview" } },
                    { properties: { title: "Daily Log" } },
                    { properties: { title: "Key Results" } },
                ],
            },
        });

        const spreadsheetId = response.data.spreadsheetId;

        // Save to user profile
        await supabase
            .from("user_profiles")
            .update({ google_sheet_id: spreadsheetId })
            .eq("id", userId);

        // Initialize headers
        await this.initializeHeaders(spreadsheetId);

        return spreadsheetId;
    },

    async initializeHeaders(spreadsheetId) {
        const sheets = getSheetsClient();
        if (!sheets) return;

        await sheets.spreadsheets.values.batchUpdate({
            spreadsheetId,
            requestBody: {
                valueInputOption: "RAW",
                data: [
                    {
                        range: "'Goals Overview'!A1:F1",
                        values: [["Objective", "Status", "Progress %", "Days Remaining", "Pace", "End Date"]],
                    },
                    {
                        range: "'Daily Log'!A1:D1",
                        values: [["Date", "Goal", "KPI Values", "Notes"]],
                    },
                    {
                        range: "'Key Results'!A1:E1",
                        values: [["Goal", "Description", "Target", "Current", "% Complete"]],
                    },
                ],
            },
        });
    },

    async syncDailyData(userId) {
        const sheets = getSheetsClient();
        if (!sheets) return;

        const { data: profile } = await supabase
            .from("user_profiles")
            .select("google_sheet_id")
            .eq("id", userId)
            .single();

        if (!profile?.google_sheet_id) return;

        const spreadsheetId = profile.google_sheet_id;
        const goals = await goalRepository.findByUserId(userId);

        // Build goals overview rows
        const goalsRows = goals.map((g) => {
            const now = new Date();
            const end = new Date(g.end_date);
            const start = new Date(g.start_date);
            const totalDays = Math.ceil((end - start) / 86400000);
            const daysElapsed = Math.ceil((now - start) / 86400000);
            const daysRemaining = Math.max(0, Math.ceil((end - now) / 86400000));

            let progressPercent = 0;
            if (g.key_results?.length) {
                const total = g.key_results.reduce((sum, kr) => {
                    return sum + Math.min((kr.current_value / kr.target_value) * 100, 100);
                }, 0);
                progressPercent = Math.round(total / g.key_results.length);
            }

            const expectedProgress = totalDays > 0 ? (daysElapsed / totalDays) * 100 : 0;
            let pace = "On Track";
            if (progressPercent < expectedProgress - 10) pace = "Behind";
            else if (progressPercent > expectedProgress + 10) pace = "Ahead";

            return [g.objective, g.status, `${progressPercent}%`, daysRemaining, pace, g.end_date];
        });

        // Build key results rows
        const krRows = [];
        for (const g of goals) {
            for (const kr of g.key_results || []) {
                const pct = kr.target_value > 0 ? Math.round((kr.current_value / kr.target_value) * 100) : 0;
                krRows.push([g.objective, kr.description, kr.target_value, kr.current_value, `${pct}%`]);
            }
        }

        // Build daily log rows (last 30 days)
        const thirtyDaysAgo = new Date();
        thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
        const logs = await dailyLogRepository.findRecentByUserId(userId, 30);
        const logRows = logs.map((l) => [
            l.log_date,
            l.goals?.objective || "",
            JSON.stringify(l.kpi_values),
            l.notes || "",
        ]);

        // Clear and write data
        await sheets.spreadsheets.values.batchClear({
            spreadsheetId,
            requestBody: {
                ranges: [
                    "'Goals Overview'!A2:F100",
                    "'Daily Log'!A2:D1000",
                    "'Key Results'!A2:E100",
                ],
            },
        });

        const batchData = [];
        if (goalsRows.length) {
            batchData.push({ range: "'Goals Overview'!A2", values: goalsRows });
        }
        if (logRows.length) {
            batchData.push({ range: "'Daily Log'!A2", values: logRows });
        }
        if (krRows.length) {
            batchData.push({ range: "'Key Results'!A2", values: krRows });
        }

        if (batchData.length) {
            await sheets.spreadsheets.values.batchUpdate({
                spreadsheetId,
                requestBody: {
                    valueInputOption: "RAW",
                    data: batchData,
                },
            });
        }

        console.log(`Synced Google Sheet for user ${userId}`);
    },

    async syncAllUsers() {
        const { data: users } = await supabase
            .from("user_profiles")
            .select("id")
            .not("google_sheet_id", "is", null);

        if (!users?.length) {
            console.log("No users with Google Sheets configured");
            return { synced: 0 };
        }

        let synced = 0;
        for (const user of users) {
            try {
                await this.syncDailyData(user.id);
                synced++;
            } catch (err) {
                console.error(`Sheets sync failed for user ${user.id}:`, err.message);
            }
        }

        return { synced, total: users.length };
    },
};
