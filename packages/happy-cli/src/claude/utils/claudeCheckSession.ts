import { logger } from "@/ui/logger";
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { getProjectPath } from "./path";

export function claudeCheckSession(sessionId: string, path: string) {
    const projectDir = getProjectPath(path);

    // Check if session id is in the project dir
    const sessionFile = join(projectDir, `${sessionId}.jsonl`);
    const sessionExists = existsSync(sessionFile);
    if (!sessionExists) {
        logger.debug(`[claudeCheckSession] Path ${sessionFile} does not exist`);
        return false;
    }

    // Check if session contains any messages with valid ID fields
    const sessionData = readFileSync(sessionFile, 'utf-8').split('\n');

    const hasGoodMessage = !!sessionData.find((v, index) => {
        if (!v.trim()) return false;  // Skip empty lines silently (not errors)

        try {
            const parsed = JSON.parse(v);

            // Check for actual conversation messages (user or assistant)
            // This excludes metadata-only entries like file-history-snapshot
            const hasConversationMessage = parsed.message &&
                (parsed.message.role === 'user' || parsed.message.role === 'assistant');

            if (hasConversationMessage) {
                return true;
            }

            // Summary entries with leafUuid are also valid (can be resumed by Claude Code)
            if (parsed.type === 'summary' && typeof parsed.leafUuid === 'string' && parsed.leafUuid.length > 0) {
                return true;
            }

            return false;
        } catch (e) {
            // Log parse errors for debugging (following project convention)
            logger.debug(`[claudeCheckSession] Malformed JSON at line ${index + 1}:`, e);
            return false;
        }
    });

    // Log final validation result for observability
    logger.debug(`[claudeCheckSession] Session ${sessionId}: ${hasGoodMessage ? 'valid' : 'invalid'}`);

    return hasGoodMessage;
}