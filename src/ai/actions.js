// AI Actions Module
// Pure functions for executing agent actions

import * as THREE from 'three';
import { AGENT } from '../config.js';
import { findSeedById } from '../entities/Seed.js';

export function executeAction(agent, decision, scene, addLog, brainLoop, moveAgent, pickUp) {
    const { action, target, targetId, thought } = decision;
    addLog(`${agent.name}: ${thought}`, 'llm');

    switch (action) {
        case 'MOVE_TO':
            if (target) {
                const targetVec = Array.isArray(target)
                    ? new THREE.Vector3(target[0], 0, target[2])
                    : new THREE.Vector3(target.x || 0, 0, target.z || 0);
                moveAgent(agent, targetVec);
            }
            break;

        case 'PICK_UP':
            pickUp(agent, targetId || target, scene, addLog, brainLoop, moveAgent);
            break;

        case 'WAIT':
            const duration = decision.duration || 3000;
            setTimeout(() => brainLoop(agent), duration);
            break;

        default:
            // Unknown action, fallback
            setTimeout(() => brainLoop(agent), 1000);
    }
}

export function moveAgent(agent, targetPos) {
    agent.targetPos.copy(targetPos);
    console.log(`[Movement] ${agent.name} target set:`, targetPos);
}

export function pickUp(agent, targetId, scene, addLog, brainLoop, moveAgentFn) {
    const seed = findSeedById(targetId, scene);

    if (!seed) {
        addLog(`${agent.name}: Target seed ${targetId} is gone.`, 'system');
        setTimeout(() => brainLoop(agent), 500);
        return;
    }

    const dist = agent.group.position.distanceTo(seed.position);

    if (dist < AGENT.INTERACTION_DISTANCE) {
        scene.remove(seed);
        agent.group.add(seed);
        seed.position.set(0, 1.2, 0);
        seed.rotation.set(0, 0, 0);
        agent.eatingSeed = seed;
        agent.state = 'EATING';
        addLog(`${agent.name} is consuming ${targetId}...`, 'system');

        setTimeout(() => {
            agent.state = 'IDLE';
            brainLoop(agent);
        }, 500);
    } else {
        addLog(`${agent.name} is too far from ${targetId}. Moving closer.`, 'system');
        moveAgentFn(agent, new THREE.Vector3(seed.position.x, 0, seed.position.z));
    }
}
