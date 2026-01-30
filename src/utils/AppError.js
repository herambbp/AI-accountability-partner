/**
 * Custom application error class
 * Provides structured errors with status codes and operational flags
 */
export class AppError extends Error {
    constructor(message, statusCode = 500) {
        super(message);
        this.statusCode = statusCode;
        this.isOperational = true;
        this.timestamp = new Date().toISOString();

        Error.captureStackTrace(this, this.constructor);
    }

    static badRequest(message = "Bad Request") {
        return new AppError(message, 400);
    }

    static notFound(message = "Not Found") {
        return new AppError(message, 404);
    }

    static internal(message = "Internal Server Error") {
        return new AppError(message, 500);
    }
}
