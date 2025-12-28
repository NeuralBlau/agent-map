import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

class Logger {
    constructor() {
        this.projectRoot = path.join(__dirname, '..');
        this.logsDir = path.join(this.projectRoot, 'logs');
        this.activeLogPath = null;
        this.model = 'gemma3:4b'; // Current active model

        // Ensure logs directory exists
        if (!fs.existsSync(this.logsDir)) {
            fs.mkdirSync(this.logsDir, { recursive: true });
        }

        this.startNewSession();
    }

    /**
     * Starts a new logging session by creating a timestamped file.
     */
    startNewSession() {
        const now = new Date();
        const timestamp = now.toISOString().replace(/[:.]/g, '-').replace('T', '_').slice(0, 19);
        const filename = `session_${timestamp}.log`;
        this.activeLogPath = path.join(this.logsDir, filename);

        const header = `=== AI DEBUG LOG ===\n` +
            `Session Start: ${now.toLocaleString()}\n` +
            `Model: ${this.model}\n` +
            `Log File: ${filename}\n` +
            `====================\n\n`;

        try {
            fs.writeFileSync(this.activeLogPath, header, 'utf-8');
            console.log(`[Logger] New session started: ${this.activeLogPath}`);
        } catch (e) {
            console.error('[Logger] Error starting new session:', e.message);
        }
    }

    /**
     * Logs a message to the active debug file.
     * @param {string} layer - The AI layer (STRATEGIC, TACTICAL, IMMEDIATE, etc.)
     * @param {string} agentName - The name of the agent.
     * @param {Object|string} data - The data to log.
     */
    log(layer, agentName, data) {
        if (!this.activeLogPath) {
            this.startNewSession();
        }

        const timestamp = new Date().toLocaleTimeString();
        const formattedData = typeof data === 'object' ? JSON.stringify(data, null, 2) : data;
        const entry = `[${timestamp}] [${agentName}] [${layer.toUpperCase()}]\n${formattedData}\n\n`;

        try {
            fs.appendFileSync(this.activeLogPath, entry, 'utf-8');
        } catch (e) {
            console.error('[Logger] Error writing to debug log:', e.message);
        }
    }
}

// Export a singleton instance
export const logger = new Logger();
