import { messageRepository } from "../repositories/messageRepository.js";
import { userRepository } from "../repositories/userRepository.js";
import { summaryService } from "../services/summaryService.js";
import { asyncHandler } from "../middleware/errorHandler.js";
import { PAGINATION } from "../config/constants.js";

/**
 * GET /api/messages/:userId
 * Get paginated messages for infinite scroll
 */
export const getMessages = asyncHandler(async (req, res) => {
    const { userId } = req.params;
    const { limit = PAGINATION.DEFAULT_LIMIT, before } = req.query;
    const pageLimit = Math.min(parseInt(limit) || PAGINATION.DEFAULT_LIMIT, PAGINATION.MAX_LIMIT);

    const { messages, hasMore } = await messageRepository.findByUserId(userId, {
        limit: pageLimit,
        before,
    });

    res.json({
        messages,
        hasMore,
        oldestTimestamp: messages.length > 0 ? messages[0].created_at : null,
    });
});

/**
 * GET /api/messages/:userId/count
 * Get total message count for a user
 */
export const getMessageCount = asyncHandler(async (req, res) => {
    const count = await messageRepository.countByUserId(req.params.userId);
    res.json({ count });
});

/**
 * GET /api/summary/:userId
 * Get user's conversation summary
 */
export const getSummary = asyncHandler(async (req, res) => {
    const summaryData = await userRepository.getSummaryData(req.params.userId);
    res.json(summaryData);
});

/**
 * POST /api/summary/:userId/update
 * Force update summary (manual trigger)
 */
export const updateSummary = asyncHandler(async (req, res) => {
    const summary = await summaryService.updateUserSummary(req.params.userId);
    res.json({ success: true, summary });
});
