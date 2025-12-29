// Resource Node Entity Module
// Harvestable trees, rocks, and berry bushes

import * as THREE from 'three';
import { COLORS, RESOURCES, WORLD } from '../config.js';
import { addToInventory } from '../systems/Inventory.js';

// Global resource node registry
export const resourceNodes = [];

let nodeIdCounter = 0;

/**
 * Create a harvestable tree
 */
export function createTree(x, z, visualDirector) {
    const scene = visualDirector.scene;
    const group = visualDirector.getAsset('tree');
    const id = `tree_${++nodeIdCounter}`;

    group.position.set(x, 0, z);
    scene.add(group);

    const yieldAmount = RESOURCES.TREE.yieldMin +
        Math.floor(Math.random() * (RESOURCES.TREE.yieldMax - RESOURCES.TREE.yieldMin));

    const node = {
        id,
        type: 'tree',
        group,
        resource: 'wood',
        remaining: yieldAmount,
        maxYield: yieldAmount,
        harvestTime: RESOURCES.TREE.harvestTime,
        respawnTime: RESOURCES.TREE.respawnTime,
        isDepleted: false,
        position: new THREE.Vector3(x, 0, z)
    };

    resourceNodes.push(node);
    return node;
}

/**
 * Create a harvestable rock/stone node
 */
export function createRock(x, z, visualDirector) {
    const scene = visualDirector.scene;
    const group = visualDirector.getAsset('rock');
    const id = `rock_${++nodeIdCounter}`;

    group.position.set(x, 0, z);
    scene.add(group);

    const yieldAmount = RESOURCES.ROCK.yieldMin +
        Math.floor(Math.random() * (RESOURCES.ROCK.yieldMax - RESOURCES.ROCK.yieldMin));

    const node = {
        id,
        type: 'rock',
        group,
        resource: 'stone',
        remaining: yieldAmount,
        maxYield: yieldAmount,
        harvestTime: RESOURCES.ROCK.harvestTime,
        respawnTime: RESOURCES.ROCK.respawnTime,
        isDepleted: false,
        position: new THREE.Vector3(x, 0, z)
    };

    resourceNodes.push(node);
    return node;
}

/**
 * Create a harvestable berry bush
 */
export function createBerryBush(x, z, visualDirector) {
    const scene = visualDirector.scene;
    const group = visualDirector.getAsset('berry_bush');
    const id = `berry_${++nodeIdCounter}`;

    group.position.set(x, 0, z);
    scene.add(group);

    const yieldAmount = RESOURCES.BERRY_BUSH.yieldMin +
        Math.floor(Math.random() * (RESOURCES.BERRY_BUSH.yieldMax - RESOURCES.BERRY_BUSH.yieldMin));

    const node = {
        id,
        type: 'berry',
        group,
        resource: 'berries',
        remaining: yieldAmount,
        maxYield: yieldAmount,
        harvestTime: RESOURCES.BERRY_BUSH.harvestTime,
        respawnTime: RESOURCES.BERRY_BUSH.respawnTime,
        isDepleted: false,
        position: new THREE.Vector3(x, 0, z)
    };

    resourceNodes.push(node);
    return node;
}

/**
 * Harvest from a resource node
 * @returns {boolean} True if harvest started successfully
 */
export function startHarvest(node, agent, onComplete) {
    if (!node || node.remaining <= 0 || node.isDepleted) {
        console.log(`[Harvest] Cannot harvest ${node?.id || 'unknown'} - depleted or invalid`);
        return false;
    }

    const dist = agent.group.position.distanceTo(node.group.position);
    if (dist > 2.5) {
        console.log(`[Harvest] ${agent.name} too far from ${node.id} (${dist.toFixed(1)} units)`);
        return false;
    }

    agent.state = 'HARVESTING';
    agent.harvestingNode = node;

    console.log(`[Harvest] ${agent.name} started harvesting ${node.id}`);

    setTimeout(() => {
        if (node.remaining > 0 && !node.isDepleted) {
            node.remaining--;
            const added = addToInventory(agent, node.resource, 1);

            console.log(`[Harvest] ${agent.name} got 1 ${node.resource} from ${node.id}. Remaining: ${node.remaining}`);

            // Visual feedback - shrink slightly
            const scale = 0.7 + (node.remaining / node.maxYield) * 0.3;
            node.group.scale.setScalar(scale);

            if (node.remaining <= 0) {
                depleteNode(node);
            }
        }

        agent.state = 'IDLE';
        agent.harvestingNode = null;

        if (onComplete) onComplete(node.remaining > 0);
    }, node.harvestTime);

    return true;
}

/**
 * Mark node as depleted and schedule respawn
 */
function depleteNode(node) {
    node.isDepleted = true;
    node.group.visible = false;

    console.log(`[Harvest] ${node.id} is now depleted. Respawning in ${node.respawnTime / 1000}s`);

    setTimeout(() => {
        respawnNode(node);
    }, node.respawnTime);
}

/**
 * Respawn a depleted node
 */
function respawnNode(node) {
    node.isDepleted = false;
    node.remaining = node.maxYield;
    node.group.visible = true;
    node.group.scale.setScalar(1);

    console.log(`[Harvest] ${node.id} has respawned with ${node.remaining} ${node.resource}`);
}

/**
 * Find the nearest resource node of a specific type
 */
/**
 * Find the nearest resource node of a specific type
 * Matches signature expected by main.js: (type, position, nodes)
 */
export function findNearestResource(resourceType, position, nodes = resourceNodes) {
    if (!position) {
        console.error('[ResourceNode] findNearestResource called without position');
        return null;
    }

    let nearest = null;
    let nearestDist = Infinity;

    nodes.forEach(node => {
        if (node.isDepleted || node.remaining <= 0) return;
        if (resourceType && node.resource !== resourceType) return; // 'tree' vs 'tree'

        // Check distance
        const dist = position.distanceTo(node.group.position);
        if (dist < nearestDist) {
            nearestDist = dist;
            nearest = node;
        }
    });

    return nearest;
}

/**
 * Find resource node by ID
 */
export function findResourceById(id) {
    return resourceNodes.find(n => n.id === id);
}

/**
 * Spawn initial resources in the world
 */
export function spawnWorldResources(visualDirector) {
    const scene = visualDirector.scene;
    const spawnRange = WORLD.SPAWN_RANGE;

    // Spawn trees
    for (let i = 0; i < WORLD.TREE_COUNT; i++) {
        const x = (Math.random() - 0.5) * spawnRange * 2;
        const z = (Math.random() - 0.5) * spawnRange * 2;
        createTree(x, z, visualDirector);
    }

    // Spawn rocks
    for (let i = 0; i < WORLD.ROCK_COUNT; i++) {
        const x = (Math.random() - 0.5) * spawnRange * 2;
        const z = (Math.random() - 0.5) * spawnRange * 2;
        createRock(x, z, visualDirector);
    }

    // Spawn berry bushes
    for (let i = 0; i < WORLD.BERRY_BUSH_COUNT; i++) {
        const x = (Math.random() - 0.5) * spawnRange * 2;
        const z = (Math.random() - 0.5) * spawnRange * 2;
        createBerryBush(x, z, visualDirector);
    }

    console.log(`[World] Spawned ${WORLD.TREE_COUNT} trees, ${WORLD.ROCK_COUNT} rocks, ${WORLD.BERRY_BUSH_COUNT} berry bushes`);
}

/**
 * Get all resource nodes for serialization
 */
export function getResourceNodes() {
    return resourceNodes;
}
