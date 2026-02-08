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
 * Parse goal JSON from AI response
 */
export function parseGoalFromResponse(text) {
    const match = text.match(/```goal\n([\s\S]*?)\n```/);
    if (!match) return null;

    try {
        return JSON.parse(match[1]);
    } catch (error) {
        console.error("Failed to parse goal:", error);
        return null;
    }
}

/**
 * Remove goal block from message for storage
 */
export function cleanGoalFromMessage(text) {
    return text.replace(/```goal\n[\s\S]*?\n```/, "").trim();
}

/**
 * Parse KPI log JSON from AI response
 */
export function parseKpiLogFromResponse(text) {
    const match = text.match(/```kpi_log\n([\s\S]*?)\n```/);
    if (!match) return null;

    try {
        return JSON.parse(match[1]);
    } catch (error) {
        console.error("Failed to parse kpi_log:", error);
        return null;
    }
}

/**
 * Remove KPI log block from message for storage
 */
export function cleanKpiLogFromMessage(text) {
    return text.replace(/```kpi_log\n[\s\S]*?\n```/, "").trim();
}

/**
 * Clean all structured blocks (schedule, goal, kpi_log) from message
 */
export function cleanAllBlocksFromMessage(text) {
    return text
        .replace(/```schedule\n[\s\S]*?\n```/g, "")
        .replace(/```goal\n[\s\S]*?\n```/g, "")
        .replace(/```kpi_log\n[\s\S]*?\n```/g, "")
        .trim();
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
