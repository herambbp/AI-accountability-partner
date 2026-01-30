import { AppError } from "../utils/AppError.js";

/**
 * Centralized error handling middleware
 * Provides consistent error response format
 */
export function errorHandler(err, req, res, next) {
    // Log error details
    console.error(`[${new Date().toISOString()}] Error:`, {
        message: err.message,
        statusCode: err.statusCode || 500,
        path: req.path,
        method: req.method,
        stack: process.env.NODE_ENV === "development" ? err.stack : undefined,
    });

    // Handle known operational errors
    if (err instanceof AppError) {
        return res.status(err.statusCode).json({
            error: err.message,
            code: err.statusCode,
        });
    }

    // Handle unexpected errors
    const statusCode = err.statusCode || 500;
    const message =
        process.env.NODE_ENV === "production"
            ? "Internal Server Error"
            : err.message;

    res.status(statusCode).json({
        error: message,
        code: statusCode,
    });
}

/**
 * Async handler wrapper to catch async errors
 * Wraps async route handlers to forward errors to error middleware
 */
export function asyncHandler(fn) {
    return (req, res, next) => {
        Promise.resolve(fn(req, res, next)).catch(next);
    };
}

/**
 * Not found handler for undefined routes
 */
export function notFoundHandler(req, res) {
    res.status(404).json({
        error: "Not Found",
        code: 404,
        path: req.path,
    });
}
