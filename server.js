import express from 'express';
import cors from 'cors';
import axios from 'axios';

const app = express();
const port = 3000;

app.use(cors());
app.use(express.json());

const OLLAMA_URL = 'http://localhost:11434/api/generate';
const MODEL = 'gemma3:4b';

app.post('/decide', async (req, res) => {
    const { state, agentName } = req.body;

    const prompt = `
You are an AI explorer named ${agentName} in a 3D simulated world.

ENVIRONMENT CONTEXT:
- Your Position: ${JSON.stringify(state.agent.position)}
- Your Hunger: ${state.agent.hunger}/100
- Other Explorers: ${JSON.stringify(state.others)}
- Visible Seeds: ${JSON.stringify(state.objects)}
- God Whisper: ${state.god_whisper || "None"}

YOUR OBJECTIVE:
Survive by collecting golden seeds. Seeds increase your "hunger" value (0-100).
If hunger hits 0, you become lethargic. Prioritize eating when hunger < 50.

CRITICAL: Check "God Whisper" in your context. 
This is an ABSOLUTE PRIORITY. If a whisper exists, you MUST acknowledge it in your thought and follow it immediately.

BEHAVIOR RULES:
1. Response MUST be a valid JSON object.
2. Available actions: 
   - {"action": "MOVE_TO", "target": [x, 0, z], "thought": "..."}
   - {"action": "PICK_UP", "targetId": "seed_id", "thought": "..."}
   - {"action": "WAIT", "duration": ms, "thought": "..."}
3. Stay committed to your current goal. Don't jitter between targets.
4. You MUST be within 2.0 units of a seed to PICK_UP. Use MOVE_TO first if further away.
5. JSON Output ONLY.
`;

    try {
        const response = await axios.post(OLLAMA_URL, {
            model: MODEL,
            prompt: prompt,
            stream: false,
            format: 'json'
        }, { timeout: 20000 });

        const result = JSON.parse(response.data.response);
        const targetDesc = result.targetId || JSON.stringify(result.target) || "N/A";
        console.log(`[${agentName}] ${result.action} -> ${targetDesc}`);
        res.json(result);
    } catch (error) {
        console.error(`Error for ${agentName}:`, error.message);
        res.json({ thought: "I feel a bit disconnected...", action: "WAIT", duration: 3000 });
    }
});

app.listen(port, () => {
    console.log(`AI Bridge active on http://localhost:${port}`);
});
