const BLOCK_TYPES = ["schedule", "goal", "kpi_log"];

/**
 * Parse a fenced code block of the given type from AI response text
 * @param {string} text - AI response text
 * @param {string} blockType - Block type to parse (schedule, goal, kpi_log)
 * @returns {Object|null} Parsed JSON object or null if not found
 */
function parseBlock(text, blockType) {
    const match = text.match(new RegExp(`\`\`\`${blockType}\\n([\\s\\S]*?)\\n\`\`\``));
    if (!match) return null;

    try {
        return JSON.parse(match[1]);
    } catch (error) {
        console.error(`Failed to parse ${blockType}:`, error);
        return null;
    }
}

/**
 * Parse schedule JSON from AI response
 * @param {string} text - AI response text
 * @returns {Object|null} Parsed schedule object or null
 */
export function parseScheduleFromResponse(text) {
    return parseBlock(text, "schedule");
}

/**
 * Parse goal JSON from AI response
 * @param {string} text - AI response text
 * @returns {Object|null} Parsed goal object or null
 */
export function parseGoalFromResponse(text) {
    return parseBlock(text, "goal");
}

/**
 * Parse KPI log JSON from AI response
 * @param {string} text - AI response text
 * @returns {Object|null} Parsed KPI log object or null
 */
export function parseKpiLogFromResponse(text) {
    return parseBlock(text, "kpi_log");
}

/**
 * Clean all structured blocks (schedule, goal, kpi_log) from message
 * @param {string} text - Message containing structured blocks
 * @returns {string} Message with all blocks removed
 */
export function cleanAllBlocksFromMessage(text) {
    let cleaned = text;
    for (const type of BLOCK_TYPES) {
        cleaned = cleaned.replace(new RegExp(`\`\`\`${type}\\n[\\s\\S]*?\\n\`\`\``, "g"), "");
    }
    return cleaned.trim();
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
