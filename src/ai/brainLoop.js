// Brain Loop Module
// Manages the 3rd-layer cognitive architecture (Strategic -> Tactical -> BT Execution)

import { API } from '../config.js';
import { serializeAgent } from '../entities/Agent.js';
import { buildTreeFromPlan } from './PlanExecutor.js';

/**
 * Main AI decision loop for an agent
 * Manages thinking layers and triggering execution
 */
export async function brainLoop(agent, context) {
    if (agent.isDead || agent.isThinking) return;

    // Check if we need to think
    // 1. If we have no strategic goal
    // 2. If we have no tactical plan (or finished)
    // 3. If explicit re-think is triggered

    const needsStrategy = !agent.layers.strategic.goal || (Date.now() - agent.layers.strategic.updatedAt > 60000);
    const planFinished = !agent.layers.tactical.plan || agent.layers.tactical.currentStep >= agent.layers.tactical.plan.length;
    const btFailed = agent.behaviorTree && agent.behaviorTree.status === 'FAILURE';

    if (!needsStrategy && !planFinished && !btFailed) {
        return; // Currently executing a plan
    }

    agent.isThinking = true;
    agent.state = 'THINKING';

    try {
        const state = serializeAgent(
            agent,
            context.allAgents,
            context.seeds,
            context.scene,
            context.currentWhisper,
            context.resourceNodes,
            context.buildingsSerialized
        );

        // --- LAYER 3: STRATEGIC THINKING ---
        if (needsStrategy) {
            context.addLog(`${agent.name} is considering long-term strategy...`, 'system');
            const stratRes = await fetch(`${API.BASE_URL}/strategic`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ agentName: agent.name, state })
            });
            const stratResult = await stratRes.json();

            agent.layers.strategic = {
                goal: stratResult.goal,
                priority: stratResult.priority,
                reasoning: stratResult.reasoning,
                updatedAt: Date.now()
            };
            context.addLog(`${agent.name} Goal: ${stratResult.goal} (${stratResult.priority})`, 'llm');
        }

        // --- LAYER 2: TACTICAL PLANNING ---
        context.addLog(`${agent.name} is planning steps for ${agent.layers.strategic.goal}...`, 'system');
        const tacRes = await fetch(`${API.BASE_URL}/tactical`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                agentName: agent.name,
                state,
                strategicGoal: agent.layers.strategic
            })
        });
        const tacResult = await tacRes.json();

        agent.layers.tactical = {
            plan: tacResult.plan,
            currentStep: 0,
            thought: tacResult.thought,
            updatedAt: Date.now()
        };

        // --- LAYER 1: BEHAVIOR TREE GENERATION ---
        agent.behaviorTree = buildTreeFromPlan(tacResult.plan);
        context.addLog(`${agent.name} prepared plan: ${tacResult.plan.join(' -> ')}`, 'llm');

    } catch (e) {
        console.error(`[BrainLoop] Error for ${agent.name}:`, e);
        agent.state = 'IDLE';
    } finally {
        agent.isThinking = false;
        // If we failed to build a tree, try again soon
        if (!agent.behaviorTree) {
            setTimeout(() => brainLoop(agent, context), 3000);
        }
    }
}
