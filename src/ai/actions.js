// AI Actions Module
// Pure functions for executing agent actions

import * as THREE from 'three';
import { AGENT } from '../config.js';
import { findSeedById } from '../entities/Seed.js';
import { findResourceById, startHarvest } from '../entities/ResourceNode.js';
import { createBuilding } from '../entities/Building.js';
import { startCraft, canCraft, RECIPES } from '../systems/Crafting.js';
import { consumeItem } from '../entities/Agent.js';

/**
 * Execute an action decided by the LLM
 */
export function executeAction(agent, decision, context) {
    const { scene, addLog, brainLoop, resourceNodes } = context;
    const { action, target, targetId, thought, recipeId, itemType } = decision;

    if (thought) {
        addLog(`${agent.name}: ${thought}`, 'llm');
    }

    // Reset consecutive wait counter for non-WAIT actions
    if (action !== 'WAIT') {
        agent.consecutiveWaits = 0;
    }

    switch (action) {

        case 'MOVE_TO':
            handleMoveTo(agent, target, targetId, context);
            break;

        case 'PICK_UP':
            handlePickUp(agent, targetId || target, context);
            break;

        case 'HARVEST':
            handleHarvest(agent, targetId, context);
            break;

        case 'BUILD':
        case 'CRAFT':
            handleBuild(agent, recipeId, context);
            break;

        case 'EAT':
        case 'EAT_ITEM':
            handleEat(agent, itemType, context);
            break;

        case 'WAIT':
            // Cap WAIT duration at 2 seconds max to prevent getting stuck
            const duration = Math.min(decision.duration || 2000, 2000);

            // Track consecutive waits
            agent.consecutiveWaits = (agent.consecutiveWaits || 0) + 1;

            // If waiting too much, force action toward nearest resource
            if (agent.consecutiveWaits >= 2 && context.resourceNodes?.length > 0) {
                const nearestResource = context.resourceNodes
                    .filter(r => r.remaining > 0)
                    .sort((a, b) =>
                        agent.group.position.distanceTo(a.group.position) -
                        agent.group.position.distanceTo(b.group.position)
                    )[0];

                if (nearestResource) {
                    addLog(`${agent.name}: Nudged toward ${nearestResource.id}`, 'system');
                    agent.consecutiveWaits = 0;
                    handleMoveTo(agent, null, nearestResource.id, context);
                    break;
                }
            }

            addLog(`${agent.name}: Waiting ${duration}ms...`, 'system');
            setTimeout(() => brainLoop(agent), duration);
            break;


        default:
            addLog(`${agent.name}: Unknown action ${action}`, 'system');
            setTimeout(() => brainLoop(agent), 1000);
    }
}

/**
 * Handle MOVE_TO action
 */
function handleMoveTo(agent, target, targetId, context) {
    const { brainLoop, resourceNodes } = context;

    // If targetId provided, find the entity position
    if (targetId) {
        // Check resources
        const resource = findResourceById(targetId);
        if (resource) {
            moveAgent(agent, resource.group.position.clone());
            return;
        }

        // Check seeds
        const seed = findSeedById(targetId, context.scene);
        if (seed) {
            moveAgent(agent, new THREE.Vector3(seed.position.x, 0, seed.position.z));
            return;
        }

        console.log(`[Action] Target ${targetId} not found`);
        setTimeout(() => brainLoop(agent), 500);
        return;
    }

    // Direct position provided
    if (target) {
        const targetVec = Array.isArray(target)
            ? new THREE.Vector3(target[0], 0, target[2] || target[1])
            : new THREE.Vector3(target.x || 0, 0, target.z || 0);
        moveAgent(agent, targetVec);
    }
}

/**
 * Handle HARVEST action
 */
function handleHarvest(agent, targetId, context) {
    const { addLog, brainLoop } = context;

    const resource = findResourceById(targetId);

    if (!resource) {
        addLog(`${agent.name}: Resource ${targetId} not found.`, 'system');
        setTimeout(() => brainLoop(agent), 500);
        return;
    }

    const dist = agent.group.position.distanceTo(resource.group.position);

    if (dist > AGENT.INTERACTION_DISTANCE + 0.5) {
        addLog(`${agent.name} moving to ${targetId}...`, 'system');
        moveAgent(agent, resource.group.position.clone());
        return;
    }

    // Start harvesting
    const success = startHarvest(resource, agent, (hasMore) => {
        addLog(`${agent.name} harvested from ${targetId}`, 'system');
        // Continue harvesting if more resources available, otherwise think again
        if (hasMore && resource.remaining > 0) {
            // Auto-continue harvesting same resource
            setTimeout(() => handleHarvest(agent, targetId, context), 500);
        } else {
            brainLoop(agent);
        }
    });

    if (!success) {
        addLog(`${agent.name}: Can't harvest ${targetId}`, 'system');
        setTimeout(() => brainLoop(agent), 500);
    }
}

/**
 * Handle BUILD/CRAFT action
 */
function handleBuild(agent, recipeId, context) {
    const { scene, addLog, brainLoop } = context;

    if (!recipeId) {
        addLog(`${agent.name}: No recipe specified`, 'system');
        setTimeout(() => brainLoop(agent), 500);
        return;
    }

    const recipe = RECIPES[recipeId.toUpperCase()];

    if (!recipe) {
        addLog(`${agent.name}: Unknown recipe ${recipeId}`, 'system');
        setTimeout(() => brainLoop(agent), 500);
        return;
    }

    if (!canCraft(agent, recipeId.toUpperCase())) {
        addLog(`${agent.name}: Missing materials for ${recipe.name}`, 'system');
        setTimeout(() => brainLoop(agent), 500);
        return;
    }

    addLog(`${agent.name} started building ${recipe.name}...`, 'system');

    // Place building at agent's current position
    const buildPos = agent.group.position.clone();
    buildPos.x += 2; // Offset slightly so agent doesn't stand in it

    startCraft(agent, recipeId.toUpperCase(), buildPos, (completedRecipe, pos) => {
        if (completedRecipe.category === 'building') {
            createBuilding(completedRecipe.id, pos.x, pos.z, scene, agent.name);
            addLog(`${agent.name} built a ${completedRecipe.name}!`, 'system');
        } else {
            // Tool/equipment - add to agent
            agent.equipment = agent.equipment || {};
            agent.equipment[completedRecipe.id] = completedRecipe.effect;
            addLog(`${agent.name} crafted a ${completedRecipe.name}!`, 'system');
        }
        brainLoop(agent);
    });
}

/**
 * Handle EAT/EAT_ITEM action
 */
function handleEat(agent, itemType, context) {
    const { addLog, brainLoop } = context;

    // If no item specified, try to eat best available
    if (!itemType) {
        const edibles = ['cookedMeat', 'rawMeat', 'berries'];
        itemType = edibles.find(item => agent.inventory?.[item] > 0);
    }

    if (!itemType || !agent.inventory?.[itemType]) {
        addLog(`${agent.name}: Nothing to eat!`, 'system');
        setTimeout(() => brainLoop(agent), 500);
        return;
    }

    const success = consumeItem(agent, itemType);

    if (success) {
        addLog(`${agent.name} ate ${itemType}. Hunger: ${agent.stats.hunger.toFixed(0)}`, 'system');
    }

    setTimeout(() => brainLoop(agent), 500);
}

/**
 * Handle PICK_UP action (for seeds - legacy)
 */
function handlePickUp(agent, targetId, context) {
    const { scene, addLog, brainLoop } = context;

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
        addLog(`${agent.name} moving to ${targetId}...`, 'system');
        moveAgent(agent, new THREE.Vector3(seed.position.x, 0, seed.position.z));
    }
}

/**
 * Set agent's movement target
 */
export function moveAgent(agent, targetPos) {
    agent.targetPos.copy(targetPos);
    agent.state = 'MOVING';
    console.log(`[Movement] ${agent.name} target set:`, targetPos);
}

/**
 * Get available actions for LLM prompt
 */
export function getAvailableActions() {
    return `
Available actions:
- MOVE_TO: Move to a position or entity. Params: target (coordinates) OR targetId (entity ID)
- HARVEST: Gather resources from a tree/rock. Params: targetId (resource ID like "tree_1")
- BUILD: Construct a building. Params: recipeId (CAMPFIRE, SHELTER)
- CRAFT: Create a tool. Params: recipeId (SPEAR)
- EAT: Consume food from inventory. Params: itemType (berries, rawMeat, cookedMeat)
- PICK_UP: Pick up a seed. Params: targetId (seed ID)
- WAIT: Wait before next action. Params: duration (ms)
`.trim();
}
