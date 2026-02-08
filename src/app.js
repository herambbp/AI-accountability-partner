import express from "express";
import cors from "cors";

// Controllers
import { postChat } from "./controllers/chatController.js";
import {
    getMessages,
    getMessageCount,
    getSummary,
    updateSummary,
} from "./controllers/messageController.js";
import {
    createSchedule,
    getSchedules,
    deleteSchedule,
    toggleSchedule,
} from "./controllers/scheduleController.js";
import {
    savePushToken,
    debugUser,
    testCheckin,
    runNotifications,
    runReviews,
    runSheetsSync,
    runWhatsAppDaily,
} from "./controllers/cronController.js";
import {
    getGoals,
    getActiveGoals,
    getGoalDetail,
    updateGoalStatus,
    updateKeyResult,
    submitDailyLog,
    getGoalLogs,
    getGoalStreak,
    getWeeklyReview,
    getMonthlyReview,
    addWhatsAppContact,
    getWhatsAppContacts,
    deleteWhatsAppContact,
    toggleWhatsAppContact,
    setUserSheet,
} from "./controllers/goalController.js";
import { getDashboard } from "./controllers/dashboardController.js";

// Middleware
import { errorHandler, notFoundHandler } from "./middleware/errorHandler.js";

const app = express();

// Global middleware
app.use(cors());
app.use(express.json());

// Health check
app.get("/health", (req, res) => res.json({ status: "ok" }));

// Chat routes
app.post("/api/chat", postChat);

// Message routes
app.get("/api/messages/:userId", getMessages);
app.get("/api/messages/:userId/count", getMessageCount);

// Summary routes
app.get("/api/summary/:userId", getSummary);
app.post("/api/summary/:userId/update", updateSummary);

// Schedule routes
app.post("/api/schedules", createSchedule);
app.get("/api/schedules/:userId", getSchedules);
app.delete("/api/schedules/:id", deleteSchedule);
app.patch("/api/schedules/:id/toggle", toggleSchedule);

// Goal management routes
app.get("/api/goals/:userId", getGoals);
app.get("/api/goals/:userId/active", getActiveGoals);
app.get("/api/goals/detail/:goalId", getGoalDetail);
app.patch("/api/goals/:goalId/status", updateGoalStatus);
app.patch("/api/goals/:goalId/key-results/:krId", updateKeyResult);

// Daily logging routes
app.post("/api/goals/:goalId/log", submitDailyLog);
app.get("/api/goals/:goalId/logs", getGoalLogs);
app.get("/api/goals/:goalId/streak", getGoalStreak);

// Dashboard & review routes
app.get("/api/dashboard/:userId", getDashboard);
app.get("/api/goals/:goalId/review/weekly", getWeeklyReview);
app.get("/api/goals/:goalId/review/monthly", getMonthlyReview);

// User settings & WhatsApp contacts
app.patch("/api/users/:userId/sheet", setUserSheet);
app.post("/api/users/:userId/whatsapp-contacts", addWhatsAppContact);
app.get("/api/users/:userId/whatsapp-contacts", getWhatsAppContacts);
app.delete("/api/whatsapp-contacts/:contactId", deleteWhatsAppContact);
app.patch("/api/whatsapp-contacts/:contactId/toggle", toggleWhatsAppContact);

// Push notification routes
app.post("/api/push-token", savePushToken);

// Cron and debug routes
app.post("/api/cron/notifications", runNotifications);
app.post("/api/cron/reviews", runReviews);
app.post("/api/cron/sheets-sync", runSheetsSync);
app.post("/api/cron/whatsapp-daily", runWhatsAppDaily);
app.post("/api/test-checkin/:userId", testCheckin);
app.get("/api/debug/user/:userId", debugUser);

// Error handling
app.use(notFoundHandler);
app.use(errorHandler);

export default app;
