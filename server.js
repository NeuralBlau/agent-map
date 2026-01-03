import express from 'express';
import cors from 'cors';
import axios from 'axios';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

import { getStrategicPrompt, getTacticalPrompt, getDecidePrompt } from './server/PromptTemplates.js';
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

app.post('/decide', async (req, res) => {
    try {
        const { state, agentName } = req.body;

        // Validate request
        if (!state || !state.agent) {
            console.error(`[Server] Invalid request for ${agentName}: missing state.agent`);
            return res.json({ action: 'WAIT', duration: 3000, thought: 'Thinking...' });
        }

        // Format state information with safe defaults
        const agent = state.agent;
        const stats = {
            food: parseFloat(agent.stats?.food) || 100,
            warmth: parseFloat(agent.stats?.warmth) || 100,
            health: parseFloat(agent.stats?.health) || 100,
            energy: parseFloat(agent.stats?.energy) || 100
        };
        const inventory = agent.inventory || {};
        const resources = state.resources || [];
        const buildings = state.buildings || [];
        const others = state.others || [];
        const position = agent.position || [0, 0, 0];

        const prompt = getDecidePrompt(agentName, state);
        const result = await callLLM(prompt, agentName, 'json', 'DECIDE');

        if (result) {
            // Log decision to console and debug file
            const targetDesc = result.targetId || result.recipeId || JSON.stringify(result.target) || "N/A";
            console.log(`[${agentName}] ${result.action} -> ${targetDesc} | H:${stats.hunger} W:${stats.warmth} | "${result.thought?.substring(0, 50)}..."`);

            logger.log('IMMEDIATE', agentName, {
                decision: result,
                context: {
                    stats,
                    inventory,
                    position
                }
            });

            return res.json(result);
        }

        // Fallback
        res.json({ thought: "Need to survive...", action: "WAIT", duration: 3000 });
    } catch (outerError) {
        console.error(`[Server] Outer error for ${req.body?.agentName}:`, outerError.message);
        logger.log('ERROR', req.body?.agentName || 'Server', { error: outerError.message, path: '/decide' });
        res.json({ action: 'WAIT', duration: 3000, thought: 'System error, waiting...' });
    }
});

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
app.post('/tactical', async (req, res) => {
    try {
        const { agentName, state, strategicGoal } = req.body;

        if (!state || !state.agent) {
            return res.json({ plan: ['WAIT'], currentStep: 0, thought: 'No state available' });
        }
        
        // Debug Log for issue investigation
        if (!strategicGoal) {
             console.error(`[Tactical] MISSING strategicGoal for ${agentName}. Body:`, JSON.stringify(req.body));
             return res.json({ plan: ['WAIT'], currentStep: 0, thought: 'Missing strategic goal' });
        }

        const prompt = getTacticalPrompt(agentName, state, strategicGoal);

        const result = await callLLM(prompt, agentName, 'json', 'TACTICAL');

        if (result) {
            console.log(`[${agentName}][TACT] Plan: ${result.plan?.length || 0} steps`);
            logger.log('TACTICAL', agentName, {
                decision: result,
                context: {
                    stats: state?.agent?.stats,
                    inventory: state?.agent?.inventory,
                    goal: strategicGoal
                }
            });
            return res.json(result);
        }

        res.json({ plan: ['WAIT'], currentStep: 0, thought: 'Fallback plan' });
    } catch (error) {
        // Provide a fallback plan with actual resource IDs if available
        const resources = req.body?.state?.resources || [];
        const nearestTree = resources.find(r => r.type === 'tree');
        const nearestRock = resources.find(r => r.type === 'rock');

        const fallbackPlan = [];
        if (nearestTree) {
            fallbackPlan.push(`Move to ${nearestTree.id}`, `Gather from ${nearestTree.id}`);
        }
        if (nearestRock) {
            fallbackPlan.push(`Move to ${nearestRock.id}`, `Gather from ${nearestRock.id}`);
        }
        if (fallbackPlan.length === 0) {
            fallbackPlan.push('WAIT');
        }

        console.error(`[Tactical] Error for ${req.body?.agentName}:`, error.message);
        logger.log('ERROR', req.body?.agentName || 'Server', { error: error.message, path: '/tactical' });
        res.json({ plan: fallbackPlan, currentStep: 0, thought: 'Default plan with nearest resources' });
    }
});

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
