// Brain Loop Module
// AI decision fetching and processing

import { API } from '../config.js';
import { serializeAgent } from '../entities/Agent.js';
import { executeAction, moveAgent, pickUp } from './actions.js';

export async function brainLoop(agent, allAgents, seeds, scene, currentWhisper, addLog) {
    if (agent.state === 'THINKING' || agent.isThinking) return;

    agent.state = 'THINKING';
    agent.isThinking = true;

    try {
        const state = serializeAgent(agent, allAgents, seeds, scene, currentWhisper);

        const res = await fetch(API.LLM_ENDPOINT, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ state, agentName: agent.name })
        });

        const decision = await res.json();

        // Create bound versions for the action executor
        const boundBrainLoop = (a) => brainLoop(a, allAgents, seeds, scene, currentWhisper, addLog);
        const boundMoveAgent = (a, pos) => moveAgent(a, pos);
        const boundPickUp = (a, id) => pickUp(a, id, scene, addLog, boundBrainLoop, boundMoveAgent);

        executeAction(agent, decision, scene, addLog, boundBrainLoop, boundMoveAgent, boundPickUp);
    } catch (e) {
        console.error(e);
        agent.state = 'IDLE';
    } finally {
        agent.isThinking = false;
    }
}

export function createBrainLoopForAgent(allAgents, seeds, scene, getCurrentWhisper, addLog) {
    return (agent) => brainLoop(agent, allAgents, seeds, scene, getCurrentWhisper(), addLog);
}
