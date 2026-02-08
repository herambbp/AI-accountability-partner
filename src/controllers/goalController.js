import { supabase } from "../config/index.js";
import { goalService } from "../services/goalService.js";
import { dailyLogRepository } from "../repositories/dailyLogRepository.js";
import { progressReviewService } from "../services/progressReviewService.js";
import { whatsappContactRepository } from "../repositories/whatsappContactRepository.js";
import { sheetsService } from "../services/sheetsService.js";
import { asyncHandler } from "../middleware/errorHandler.js";
import { AppError } from "../utils/AppError.js";

// --- Goal endpoints ---

export const getGoals = asyncHandler(async (req, res) => {
    const goals = await goalService.getGoalsWithProgress(req.params.userId);
    res.json({ goals });
});

export const getActiveGoals = asyncHandler(async (req, res) => {
    const goals = await goalService.getActiveGoalsWithProgress(req.params.userId);
    res.json({ goals });
});

export const getGoalDetail = asyncHandler(async (req, res) => {
    const goal = await goalService.getGoalDetail(req.params.goalId);
    if (!goal) throw AppError.notFound("Goal not found");
    res.json({ goal });
});

export const updateGoalStatus = asyncHandler(async (req, res) => {
    const { status } = req.body;
    if (!status) throw AppError.badRequest("Status is required");

    const valid = ["active", "paused", "completed", "abandoned"];
    if (!valid.includes(status)) throw AppError.badRequest(`Status must be one of: ${valid.join(", ")}`);

    const goal = await goalService.updateGoalStatus(req.params.goalId, status);
    res.json({ goal });
});

export const updateKeyResult = asyncHandler(async (req, res) => {
    const { currentValue } = req.body;
    if (currentValue === undefined) throw AppError.badRequest("currentValue is required");

    const kr = await goalService.updateKeyResult(req.params.krId, currentValue);
    res.json({ keyResult: kr });
});

// --- Daily log endpoints ---

export const submitDailyLog = asyncHandler(async (req, res) => {
    const { goalId } = req.params;
    const { userId, kpiValues, notes, logDate } = req.body;

    if (!userId || !kpiValues) {
        throw AppError.badRequest("userId and kpiValues are required");
    }

    const date = logDate || new Date().toISOString().split("T")[0];
    const log = await dailyLogRepository.upsert(goalId, userId, date, kpiValues, notes);
    res.json({ log });
});

export const getGoalLogs = asyncHandler(async (req, res) => {
    const { startDate, endDate } = req.query;
    const logs = await dailyLogRepository.findByGoalId(req.params.goalId, { startDate, endDate });
    res.json({ logs });
});

export const getGoalStreak = asyncHandler(async (req, res) => {
    const streak = await dailyLogRepository.getStreak(req.params.goalId);
    res.json({ streak });
});

// --- Review endpoints ---

export const getWeeklyReview = asyncHandler(async (req, res) => {
    const review = await progressReviewService.generateWeeklyReview(req.params.goalId);
    res.json({ review });
});

export const getMonthlyReview = asyncHandler(async (req, res) => {
    const review = await progressReviewService.generateMonthlyReview(req.params.goalId);
    res.json({ review });
});

// --- WhatsApp contact endpoints ---

export const addWhatsAppContact = asyncHandler(async (req, res) => {
    const { phoneNumber, name } = req.body;
    if (!phoneNumber || !name) throw AppError.badRequest("phoneNumber and name are required");

    const contact = await whatsappContactRepository.create(req.params.userId, { phoneNumber, name });
    res.json({ contact });
});

export const getWhatsAppContacts = asyncHandler(async (req, res) => {
    const contacts = await whatsappContactRepository.findByUserId(req.params.userId);
    res.json({ contacts });
});

export const deleteWhatsAppContact = asyncHandler(async (req, res) => {
    await whatsappContactRepository.deleteById(req.params.contactId);
    res.json({ success: true });
});

export const toggleWhatsAppContact = asyncHandler(async (req, res) => {
    const contact = await whatsappContactRepository.toggleActive(req.params.contactId);
    res.json({ contact });
});

// --- User settings ---

export const setUserSheet = asyncHandler(async (req, res) => {
    const { userId } = req.params;
    const { sheetId } = req.body;

    let spreadsheetId = sheetId;
    if (!spreadsheetId) {
        spreadsheetId = await sheetsService.createSheetForUser(userId);
    } else {
        await supabase
            .from("user_profiles")
            .update({ google_sheet_id: spreadsheetId })
            .eq("id", userId);
    }

    res.json({ googleSheetId: spreadsheetId });
});
