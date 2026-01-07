import express from 'express';
import cors from 'cors';
import axios from 'axios';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

import { getStrategicPrompt } from './server/PromptTemplates.js';
import { callLLM } from './server/LLMService.js';
import { logger } from './server/Logger.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const port = 3000;

app.use(cors());
app.use(express.json());
app.use((req, res, next) => {
    console.log(`[${new Date().toLocaleTimeString()}] Incoming ${req.method} to ${req.url}`);
    next();
});

const OLLAMA_URL = 'http://localhost:11434/api/generate';
const MODEL = 'gemma3:4b';



// =============================================================================
// STRATEGIC LAYER - Long-term goal planning (runs every 30-60 seconds)
// =============================================================================
app.post('/strategic', async (req, res) => {
    try {
        const { agentName, state } = req.body;

        if (!state || !state.agent) {
            return res.json({ goal: 'SURVIVE', priority: 'SURVIVAL', reasoning: 'No state available' });
        }

        const prompt = getStrategicPrompt(agentName, state);
        const result = await callLLM(prompt, agentName, 'json', 'STRATEGIC');

        if (result) {
            console.log(`[${agentName}][STRAT] Goal: ${result.goal} | Prio: ${result.priority}`);
            // ... logger ...
            logger.log('STRATEGIC', agentName, {
                decision: result,
                context: {
                    stats: state?.agent?.stats,
                    inventory: state?.agent?.inventory,
                    buildingReadiness: state?.perception?.buildingReadiness
                }
            });

            return res.json(result);
        }

        res.json({ goal: 'SURVIVE', priority: 'MEDIUM', reasoning: 'FATAL FALLBACK (LLM returned null/invalid)' });
    } catch (error) {
        console.error(`[Strategic] Error for ${req.body?.agentName}:`, error.message);
        logger.log('ERROR', req.body?.agentName || 'Server', { error: error.message, path: '/strategic' });
        res.json({ goal: 'GATHER_RESOURCES', priority: 'MEDIUM', reasoning: 'ERROR BLOCK FALLBACK (Server Error)' });
    }
});

// =============================================================================
// TACTICAL LAYER - Mid-term action planning (runs when goal changes)
// =============================================================================


app.post('/debug-log', (req, res) => {
    const { agentName, layer, message } = req.body;
    logger.log(layer || 'EXECUTION', agentName || 'System', message);
    res.json({ status: 'logged' });
});

app.post('/reset-log', (req, res) => {
    logger.startNewSession();
    res.json({ status: 'new_session_started' });
});


// Health check endpoint
app.get('/health', (req, res) => {
    res.json({ status: 'ok', model: MODEL });
});



console.log('[Server] Reached end of file, starting server...');
app.listen(port, () => {
    console.log(`AI Bridge active on http://localhost:${port}`);
    console.log(`Using model: ${MODEL}`);

});

// Keep process alive
setInterval(() => { }, 60000);
