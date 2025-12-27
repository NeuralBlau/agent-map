// Agent Entity Module
// Encapsulates agent state, rendering, and behavior

import * as THREE from 'three';
import { AGENT, COLORS } from '../config.js';

export function createAgent(name, color, startPos, scene) {
    const group = new THREE.Group();

    // Body
    const body = new THREE.Mesh(
        new THREE.BoxGeometry(1, 1, 1),
        new THREE.MeshStandardMaterial({ color, emissive: color, emissiveIntensity: 0.2 })
    );
    body.position.y = 0.5;
    body.castShadow = true;
    group.add(body);

    // Eyes
    const eyeGeo = new THREE.BoxGeometry(0.2, 0.2, 0.1);
    const eyeMat = new THREE.MeshBasicMaterial({ color: COLORS.EYE });
    const e1 = new THREE.Mesh(eyeGeo, eyeMat);
    e1.position.set(0.25, 0.7, 0.5);
    const e2 = new THREE.Mesh(eyeGeo, eyeMat);
    e2.position.set(-0.25, 0.7, 0.5);
    group.add(e1, e2);

    // Hunger Bar
    const barGeo = new THREE.PlaneGeometry(1, 0.1);
    const barMat = new THREE.MeshBasicMaterial({ color: COLORS.HUNGER_FULL, side: THREE.DoubleSide });
    const hungerBar = new THREE.Mesh(barGeo, barMat);
    hungerBar.position.y = 1.5;
    group.add(hungerBar);

    group.position.copy(startPos);
    scene.add(group);

    return {
        name,
        group,
        hungerBar,
        isThinking: false,
        targetPos: startPos.clone(),
        moveSpeed: AGENT.BASE_SPEED,
        state: 'IDLE', // IDLE, MOVING, THINKING, EATING
        hunger: 100,
        eatingSeed: null,
        lastActionTime: Date.now(),
        stuckTimer: 0
    };
}

export function updateAgentMovement(agent, delta = 0.016) {
    const pos = agent.group.position;
    const target = agent.targetPos;
    const dist = pos.distanceTo(target);

    // Stuck Watchdog
    if (agent.state === 'MOVING') {
        agent.stuckTimer += delta;
        if (agent.stuckTimer > AGENT.STUCK_TIMEOUT) {
            console.warn(`[Watchdog] ${agent.name} was stuck. Forcing IDLE.`);
            agent.state = 'IDLE';
            agent.stuckTimer = 0;
            return true; // Signal to trigger brainLoop
        }
    } else {
        agent.stuckTimer = 0;
    }

    // Movement Logic
    if (dist > 0.1) {
        agent.state = 'MOVING';

        // Smooth rotation
        const lookTarget = new THREE.Vector3(target.x, pos.y, target.z);
        const currentRotation = agent.group.quaternion.clone();
        agent.group.lookAt(lookTarget);
        const targetRotation = agent.group.quaternion.clone();
        agent.group.quaternion.copy(currentRotation);
        agent.group.quaternion.slerp(targetRotation, 0.1);

        // Move toward target
        const direction = new THREE.Vector3().subVectors(target, pos).normalize();
        pos.add(direction.multiplyScalar(agent.moveSpeed));
        return false;
    } else if (agent.state === 'MOVING') {
        pos.copy(target);
        agent.state = 'IDLE';
        console.log(`[Movement] ${agent.name} reached target.`);
        return true; // Signal to trigger brainLoop
    }
    return false;
}

export function updateAgentIdle(agent, now) {
    if (agent.state === 'IDLE' || agent.state === 'THINKING') {
        const bob = Math.sin(now * 0.003) * 0.05;
        agent.group.children[0].position.y = 0.5 + bob;

        if (agent.state === 'THINKING') {
            const pulse = 1 + Math.sin(now * 0.01) * 0.05;
            agent.group.scale.set(pulse, pulse, pulse);
        } else {
            agent.group.scale.set(1, 1, 1);
        }
    }
}

export function updateAgentHunger(agent) {
    agent.hunger = Math.max(0, agent.hunger - AGENT.HUNGER_DECAY_RATE);
    const ratio = agent.hunger / 100;
    agent.hungerBar.scale.x = ratio;
    agent.hungerBar.material.color.setHSL(ratio * 0.3, 1, 0.5);

    agent.moveSpeed = agent.hunger < AGENT.STARVING_THRESHOLD
        ? AGENT.STARVING_SPEED
        : AGENT.BASE_SPEED;
}

export function updateAgentEating(agent) {
    if (!agent.eatingSeed) return false;

    const seed = agent.eatingSeed;
    seed.scale.multiplyScalar(SEED_EAT_SHRINK);
    seed.position.lerp(new THREE.Vector3(0, 0.5, 0), 0.1);

    if (seed.scale.x < SEED_EAT_THRESHOLD) {
        agent.group.remove(seed);
        agent.eatingSeed = null;
        agent.hunger = Math.min(100, agent.hunger + AGENT.HUNGER_REPLENISH);
        console.log(`[Metabolism] ${agent.name} fully absorbed seed.`);
        return true;
    }
    return false;
}

// Import seed constants for eating
import { SEED as SEED_CONFIG } from '../config.js';
const SEED_EAT_SHRINK = SEED_CONFIG.EAT_SHRINK_RATE;
const SEED_EAT_THRESHOLD = SEED_CONFIG.EAT_THRESHOLD;

export function serializeAgent(agent, allAgents, seeds, scene, currentWhisper) {
    const state = {
        agent: {
            name: agent.name,
            position: [agent.group.position.x, 0, agent.group.position.z],
            hunger: agent.hunger.toFixed(0)
        },
        others: allAgents
            .filter(a => a !== agent)
            .map(a => ({ name: a.name, position: [a.group.position.x, 0, a.group.position.z] })),
        objects: seeds
            .filter(s => s.parent === scene)
            .map(s => ({
                id: s.userData.id,
                type: 'seed',
                position: [s.position.x, 0, s.position.z],
                dist: agent.group.position.distanceTo(s.position).toFixed(2)
            }))
    };

    if (currentWhisper) {
        state.god_whisper = currentWhisper;
    }

    return state;
}
