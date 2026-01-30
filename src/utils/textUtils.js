/**
 * Parse schedule JSON from AI response
 * @param {string} text - AI response text
 * @returns {Object|null} Parsed schedule object or null if not found
 */
export function parseScheduleFromResponse(text) {
    const match = text.match(/```schedule\n([\s\S]*?)\n```/);
    if (!match) return null;

    try {
        return JSON.parse(match[1]);
    } catch (error) {
        console.error("Failed to parse schedule:", error);
        return null;
    }
}

/**
 * Remove schedule block from message for storage
 * @param {string} text - Message containing schedule block
 * @returns {string} Message with schedule block removed
 */
export function cleanScheduleFromMessage(text) {
    return text.replace(/```schedule\n[\s\S]*?\n```/, "").trim();
}

/**
 * Clamp a number to a valid range
 * @param {number} value - Value to clamp
 * @param {number} min - Minimum value
 * @param {number} max - Maximum value
 * @returns {number} Clamped value
 */
export function clampNumber(value, min, max) {
    return Math.min(Math.max(value, min), max);
}

/**
 * Validate required fields in request body
 * @param {Object} body - Request body
 * @param {string[]} required - Array of required field names
 * @returns {Object} Object with isValid flag and missing fields
 */
export function validateRequired(body, required) {
    const missing = required.filter((field) => !body[field]);
    return {
        isValid: missing.length === 0,
        missing,
        message: missing.length > 0 ? `Missing required fields: ${missing.join(", ")}` : null,
    };
}
