import express from 'express';
import cors from 'cors';
import axios from 'axios';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

import { getStrategicPrompt, getTacticalPrompt, getDecidePrompt } from './server/PromptTemplates.js';
import { callLLM } from './server/LLMService.js';

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

// Load world rules document
let worldRules = '';
try {
    const rulesPath = path.join(__dirname, 'context', 'world_rules.md');
    if (fs.existsSync(rulesPath)) {
        worldRules = fs.readFileSync(rulesPath, 'utf-8');
        console.log('[Server] Loaded world_rules.md');
    } else {
        console.log('[Server] world_rules.md not found, using basic prompts');
    }
} catch (e) {
    console.error('[Server] Error loading world rules:', e.message);
}

// Agent notepads storage
const agentNotepads = {};

function loadNotepad(agentName) {
    if (agentNotepads[agentName]) return agentNotepads[agentName];

    const notepadPath = path.join(__dirname, 'agents', `${agentName.toLowerCase()}_notepad.md`);

    if (fs.existsSync(notepadPath)) {
        agentNotepads[agentName] = fs.readFileSync(notepadPath, 'utf-8');
    } else {
        // Create from template
        const templatePath = path.join(__dirname, 'agents', 'notepad_template.md');
        if (fs.existsSync(templatePath)) {
            agentNotepads[agentName] = fs.readFileSync(templatePath, 'utf-8')
                .replace('{AGENT_NAME}', agentName);
        } else {
            agentNotepads[agentName] = `# ${agentName}'s Notepad\n\nNo memories yet.`;
        }
    }

    return agentNotepads[agentName];
}

function saveNotepad(agentName, content) {
    agentNotepads[agentName] = content;
    const notepadPath = path.join(__dirname, 'agents', `${agentName.toLowerCase()}_notepad.md`);

    try {
        fs.mkdirSync(path.dirname(notepadPath), { recursive: true });
        fs.writeFileSync(notepadPath, content, 'utf-8');
    } catch (e) {
        console.error(`[Server] Error saving notepad for ${agentName}:`, e.message);
    }
}

function appendToNotepad(agentName, text) {
    let notepad = loadNotepad(agentName);

    // Append to Important Memories section
    const memoriesSection = '## Important Memories';
    const insertIndex = notepad.indexOf(memoriesSection);

    if (insertIndex !== -1) {
        const afterHeader = notepad.indexOf('\n', insertIndex) + 1;
        const timestamp = new Date().toLocaleTimeString();
        notepad = notepad.slice(0, afterHeader) +
            `- [${timestamp}] ${text}\n` +
            notepad.slice(afterHeader);
    } else {
        notepad += `\n- ${text}`;
    }

    saveNotepad(agentName, notepad);
}

// World rules are loaded at startup into the 'worldRules' variable

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
            hunger: parseFloat(agent.stats?.hunger) || 100,
            warmth: parseFloat(agent.stats?.warmth) || 100,
            health: parseFloat(agent.stats?.health) || 100,
            energy: parseFloat(agent.stats?.energy) || 100
        };
        const inventory = agent.inventory || {};
        const resources = state.resources || [];
        const buildings = state.buildings || [];
        const seeds = state.seeds || state.objects || [];
        const others = state.others || [];
        const position = agent.position || [0, 0, 0];

        const prompt = getDecidePrompt(agentName, state, worldRules, loadNotepad(agentName));
        const result = await callLLM(prompt, agentName);

        if (result) {
            // Log decision
            const targetDesc = result.targetId || result.recipeId || JSON.stringify(result.target) || "N/A";
            console.log(`[${agentName}] ${result.action} -> ${targetDesc} | H:${stats.hunger} W:${stats.warmth} | "${result.thought?.substring(0, 50)}..."`);

            if (result.thought && (result.action === 'BUILD' || result.action === 'CRAFT')) {
                appendToNotepad(agentName, `${result.action}: ${result.thought}`);
            }
            return res.json(result);
        }

        // Fallback
        res.json({ thought: "Need to survive...", action: "WAIT", duration: 3000 });
    } catch (outerError) {
        console.error(`[Server] Outer error for ${req.body?.agentName}:`, outerError.message);
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

        const prompt = getStrategicPrompt(agentName, state, worldRules, loadNotepad(agentName));
        const result = await callLLM(prompt, agentName);

        if (result) {
            console.log(`[${agentName}][STRAT] Goal: ${result.goal} | Prio: ${result.priority}`);
            if (result.notepadUpdate || result.updateNotepad) {
                appendToNotepad(agentName, result.notepadUpdate || result.updateNotepad);
            }
            return res.json(result);
        }

        res.json({ goal: 'SURVIVE', priority: 'MEDIUM', reasoning: 'Default goal (LLM Fail)' });
    } catch (error) {
        console.error(`[Strategic] Error for ${req.body?.agentName}:`, error.message);
        res.json({ goal: 'GATHER_RESOURCES', priority: 'MEDIUM', reasoning: 'Default goal' });
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

        const prompt = getTacticalPrompt(agentName, state, worldRules, strategicGoal, loadNotepad(agentName));
        const result = await callLLM(prompt, agentName);

        if (result) {
            console.log(`[${agentName}][TACT] Plan: ${result.plan?.length || 0} steps`);
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
            fallbackPlan.push('Harvest wood', 'Harvest stone');
        }

        console.error(`[Tactical] Error for ${req.body?.agentName}:`, error.message);
        res.json({ plan: fallbackPlan, currentStep: 0, thought: 'Default plan with nearest resources' });
    }
});


// Health check endpoint
app.get('/health', (req, res) => {
    res.json({ status: 'ok', model: MODEL, worldRulesLoaded: !!worldRules });
});

// Notepad endpoints
app.get('/notepad/:agentName', (req, res) => {
    const { agentName } = req.params;
    const content = loadNotepad(agentName);
    res.json({ content });
});

app.post('/notepad/:agentName', (req, res) => {
    const { agentName } = req.params;
    const { content } = req.body;
    saveNotepad(agentName, content);
    res.json({ status: 'saved' });
});

console.log('[Server] Reached end of file, starting server...');
app.listen(port, () => {
    console.log(`AI Bridge active on http://localhost:${port}`);
    console.log(`Using model: ${MODEL}`);
    console.log(`World rules: ${worldRules ? 'loaded' : 'not loaded'}`);
});

// Keep process alive
setInterval(() => { }, 60000);
