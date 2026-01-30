import { scheduleRepository } from "../repositories/scheduleRepository.js";
import { asyncHandler } from "../middleware/errorHandler.js";
import { validateRequired } from "../utils/textUtils.js";
import { AppError } from "../utils/AppError.js";

/**
 * POST /api/schedules
 * Create a new schedule
 */
export const createSchedule = asyncHandler(async (req, res) => {
    const { userId, title, description, hour, minute, days } = req.body;

    const validation = validateRequired(req.body, ["userId", "title", "hour", "minute", "days"]);
    if (!validation.isValid) {
        throw AppError.badRequest(validation.message);
    }

    const schedule = await scheduleRepository.create({
        userId,
        title,
        description,
        hour,
        minute,
        days,
    });

    res.json({ schedule });
});

/**
 * GET /api/schedules/:userId
 * Get all schedules for a user
 */
export const getSchedules = asyncHandler(async (req, res) => {
    const schedules = await scheduleRepository.findByUserId(req.params.userId);
    res.json({ schedules });
});

/**
 * DELETE /api/schedules/:id
 * Delete a schedule
 */
export const deleteSchedule = asyncHandler(async (req, res) => {
    await scheduleRepository.deleteById(req.params.id);
    res.json({ success: true });
});

/**
 * PATCH /api/schedules/:id/toggle
 * Toggle schedule active status
 */
export const toggleSchedule = asyncHandler(async (req, res) => {
    const schedule = await scheduleRepository.toggleActive(req.params.id);
    res.json({ schedule });
});
