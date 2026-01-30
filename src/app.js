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
} from "./controllers/cronController.js";

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

// Push notification routes
app.post("/api/push-token", savePushToken);

// Cron and debug routes
app.post("/api/cron/notifications", runNotifications);
app.post("/api/test-checkin/:userId", testCheckin);
app.get("/api/debug/user/:userId", debugUser);

// Error handling
app.use(notFoundHandler);
app.use(errorHandler);

export default app;
