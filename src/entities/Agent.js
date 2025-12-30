// Agent Entity Module
// Encapsulates agent state, rendering, and behavior

import * as THREE from 'three';
import { AGENT, COLORS } from '../config.js';
import { createInventory, serializeInventory } from '../systems/Inventory.js';
import { RECIPES } from '../systems/Crafting.js';

// 
// 

export function createAgent(name, colorIndex, startPos, visualDirector) {
    const scene = visualDirector.scene;
    
    // Get high-quality mesh from visual system via index
    const group = visualDirector.getAsset('agent', { colorIndex });
    const { body, eyes, mouth } = group.userData;

    // Stat Bars (stacked vertically above agent)
    const bars = createStatBars(group);

    group.position.copy(startPos);
    scene.add(group);

    return {
        name,
        group,
        statBars: bars,
        isThinking: false,
        targetPos: startPos.clone(),
        moveSpeed: AGENT.BASE_SPEED,
        state: 'IDLE', // IDLE, MOVING, THINKING, EATING, HARVESTING, CRAFTING

        // Visual References
        body,
        eyes,
        mouth,
        
        // Animation State
        blinkTimer: 0,
        walkCycle: 0,

        // Extended stats system
        stats: {
            hunger: AGENT.INITIAL_STATS.hunger,
            warmth: AGENT.INITIAL_STATS.warmth,
            health: AGENT.INITIAL_STATS.health,
            energy: AGENT.INITIAL_STATS.energy
        },

        // Inventory system
        inventory: createInventory(),
        inventoryCapacity: AGENT.INVENTORY_CAPACITY,

        // Equipment slots
        equipment: {},

        // Legacy compatibility
        hunger: AGENT.INITIAL_STATS.hunger,

        // Timing
        lastActionTime: Date.now(),
        lastStatUpdate: Date.now(),
        stuckTimer: 0,

        // Death flag
        isDead: false,

        // Multi-LLM Layer System
        layers: {
            strategic: {
                goal: null,
                priority: 'SURVIVAL',
                reasoning: '',
                updatedAt: null
            },
            tactical: {
                plan: [],
                currentStep: 0,
                thought: '',
                updatedAt: null
            },
            immediate: {
                action: 'IDLE',
                target: null,
                state: 'IDLE'
            }
        },

        // Per-agent log history
        logHistory: [],

        // Selection state for UI
        isSelected: false,

        // Behavior Tree for executing tactical plans
        behaviorTree: null,
        lastTacticalRequestTime: 0
    };
}



function createStatBars(group) {
    const barWidth = 0.8;
    const barHeight = 0.08;
    const barSpacing = 0.12;
    const startY = 1.4;

    const bars = {};
    const statConfigs = [
        { name: 'hunger', color: COLORS.HUNGER_BAR },
        { name: 'warmth', color: COLORS.WARMTH_BAR },
        { name: 'health', color: COLORS.HEALTH_BAR },
        { name: 'energy', color: COLORS.ENERGY_BAR }
    ];

    statConfigs.forEach((config, index) => {
        // Background bar (dark)
        const bgGeo = new THREE.PlaneGeometry(barWidth, barHeight);
        const bgMat = new THREE.MeshBasicMaterial({
            color: 0x222222,
            side: THREE.DoubleSide
        });
        const bgBar = new THREE.Mesh(bgGeo, bgMat);
        bgBar.position.y = startY + index * barSpacing;
        group.add(bgBar);

        // Foreground bar (colored)
        const fgGeo = new THREE.PlaneGeometry(barWidth, barHeight);
        const fgMat = new THREE.MeshBasicMaterial({
            color: config.color,
            side: THREE.DoubleSide
        });
        const fgBar = new THREE.Mesh(fgGeo, fgMat);
        fgBar.position.y = startY + index * barSpacing;
        fgBar.position.z = 0.01; // Slightly in front
        group.add(fgBar);

        bars[config.name] = { bg: bgBar, fg: fgBar };
    });

    return bars;
}

export function updateAgentMovement(agent, delta = 0.016) {
    if (agent.isDead) return false;

    const pos = agent.group.position;
    const target = agent.targetPos;
    
    // Horizontal distance (ignore Y)
    const horizontalPos = new THREE.Vector2(pos.x, pos.z);
    const horizontalTarget = new THREE.Vector2(target.x, target.z);
    const dist = horizontalPos.distanceTo(horizontalTarget);

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

        // Move toward target (speed affected by stats)
        const currentSpeed = calculateMoveSpeed(agent);
        const direction = new THREE.Vector3().subVectors(target, pos).normalize();
        pos.add(direction.multiplyScalar(currentSpeed));

        // Squash and stretch animation
        agent.walkCycle += delta * 15;
        const bounce = Math.abs(Math.sin(agent.walkCycle));
        const stretch = 1 + bounce * 0.2;
        const squash = 1 - bounce * 0.1;
        agent.group.scale.set(squash, stretch, squash);
        agent.group.position.y = 0.5 + bounce * 0.2;

        // Moving consumes energy
        agent.stats.energy = Math.max(0, agent.stats.energy - AGENT.STAT_DECAY.energy * delta);

        return false;
    } else if (agent.state === 'MOVING') {
        pos.x = target.x;
        pos.z = target.z;
        pos.y = 0.5;
        agent.state = 'IDLE';
        agent.walkCycle = 0;
        agent.group.scale.set(1, 1, 1);
        console.log(`[Movement] ${agent.name} reached target.`);
        return true; // Signal to trigger brainLoop
    }
    return false;
}

function calculateMoveSpeed(agent) {
    let speed = AGENT.BASE_SPEED;

    // Hunger affects speed
    if (agent.stats.hunger < AGENT.CRITICAL_THRESHOLD) {
        speed = Math.min(speed, AGENT.STARVING_SPEED);
    }

    // Warmth affects speed
    if (agent.stats.warmth < AGENT.CRITICAL_THRESHOLD) {
        speed = Math.min(speed, AGENT.FREEZING_SPEED);
    }

    // Low energy affects speed
    if (agent.stats.energy < AGENT.CRITICAL_THRESHOLD) {
        speed *= 0.7;
    }

    return speed;
}

export function updateAgentStats(agent, delta = 0.016) {
    if (agent.isDead) return;

    // v3.2 Delta Clamping: Skip decay if delta is too large (likely tab pause/resume)
    if (delta > 1.0) {
        // console.log(`[Stats] Large delta detected (${delta.toFixed(2)}s). Skipping decay to prevent false panic.`);
        return;
    }

    // Decay stats over time
    agent.stats.hunger = Math.max(0, agent.stats.hunger - AGENT.STAT_DECAY.hunger * delta);
    agent.stats.warmth = Math.max(0, agent.stats.warmth - AGENT.STAT_DECAY.warmth * delta);

    // Health damage when critical stats are low
    if (agent.stats.hunger <= 0 || agent.stats.warmth <= 0) {
        agent.stats.health = Math.max(0, agent.stats.health - 0.5 * delta);
    } else if (agent.stats.hunger > 50 && agent.stats.warmth > 50 && agent.stats.energy > 30) {
        // Regenerate health when well-fed and warm
        agent.stats.health = Math.min(100, agent.stats.health + AGENT.HEALTH_REGEN_RATE * delta);
    }

    // Energy regenerates slowly when not moving
    if (agent.state !== 'MOVING' && agent.state !== 'HARVESTING') {
        agent.stats.energy = Math.min(100, agent.stats.energy + 0.05 * delta);
    }

    // Legacy compatibility
    agent.hunger = agent.stats.hunger;

    // Check for death
    if (agent.stats.health <= 0) {
        agentDeath(agent);
    }

    // Update visual bars
    updateStatBars(agent);
}

function updateStatBars(agent) {
    Object.entries(agent.statBars).forEach(([stat, bar]) => {
        const value = agent.stats[stat] / 100;
        bar.fg.scale.x = Math.max(0.01, value);
        bar.fg.position.x = -(1 - value) * 0.4; // Shrink from right

        // Color change when critical
        if (agent.stats[stat] < AGENT.CRITICAL_THRESHOLD) {
            // Flash red when critical
            const flash = Math.sin(Date.now() * 0.01) > 0;
            bar.fg.material.color.setHex(flash ? 0xff0000 : bar.fg.material.color.getHex());
        }
    });
}

function agentDeath(agent) {
    if (agent.isDead) return;

    agent.isDead = true;
    agent.state = 'DEAD';
    console.log(`[DEATH] ${agent.name} has died!`);

    // Visual feedback - turn gray and fall over
    agent.group.children[0].material.color.setHex(0x444444);
    agent.group.children[0].material.emissive.setHex(0x000000);
    agent.group.rotation.z = Math.PI / 2;
}

export function updateAgentIdle(agent, now) {
    if (agent.isDead) return;

    if (agent.state === 'IDLE' || agent.state === 'THINKING' || agent.state === 'MOVING') {
        const bob = Math.sin(now * 0.003) * 0.05;
        
        if (agent.state !== 'MOVING') {
            agent.group.position.y = 0.5 + bob;
            agent.group.scale.set(1, 1, 1); // Reset walk cycle scale
        }

        // Blinking logic
        agent.blinkTimer -= 0.016; // Approx delta
        if (agent.blinkTimer <= 0) {
            // Start blink or finish blink
            const isBlinkClosed = agent.eyes[0].scale.y < 0.5;
            if (isBlinkClosed) {
                agent.eyes.forEach(e => e.scale.y = 1);
                agent.blinkTimer = 2 + Math.random() * 4; // Next blink in 2-6s
            } else {
                agent.eyes.forEach(e => e.scale.y = 0.1);
                agent.blinkTimer = 0.15; // Duration of blink
            }
        }

        if (agent.state === 'THINKING') {
            const pulse = 1 + Math.sin(now * 0.01) * 0.05;
            agent.group.scale.set(pulse, pulse, pulse);
        }
    }
}

/**
 * updateAgentEating - NO OP (Seeds removed)
 */
export function updateAgentEating(agent) {
    return false;
}


// Utility function to restore stats from items
export function consumeItem(agent, itemType) {
    if (!agent.inventory[itemType] || agent.inventory[itemType] <= 0) {
        return false;
    }

    agent.inventory[itemType]--;

    switch (itemType) {
        case 'berries':
            agent.stats.hunger = Math.min(100, agent.stats.hunger + AGENT.HUNGER_REPLENISH.berry);
            break;
        case 'rawMeat':
            agent.stats.hunger = Math.min(100, agent.stats.hunger + AGENT.HUNGER_REPLENISH.rawMeat);
            agent.stats.health = Math.max(0, agent.stats.health - 5); // Raw meat hurts health
            break;
        case 'cookedMeat':
            agent.stats.hunger = Math.min(100, agent.stats.hunger + AGENT.HUNGER_REPLENISH.cookedMeat);
            break;
    }

    agent.hunger = agent.stats.hunger;
    return true;
}
