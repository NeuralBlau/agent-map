// Building Entity Module
// Structures that agents can build and interact with

import * as THREE from 'three';
import { COLORS } from '../config.js';

// Global building registry
export const buildings = [];

let buildingIdCounter = 0;

/**
 * Create a campfire building
 */
export function createCampfire(x, z, visualDirector, builderId = null) {
    const scene = visualDirector.scene;
    const group = visualDirector.getAsset('campfire');
    const id = `campfire_${++buildingIdCounter}`;

    // Point light for warmth visual
    const light = new THREE.PointLight(0xff6600, 1, 8);
    light.position.y = 0.5;
    group.add(light);

    group.position.set(x, 0, z);
    scene.add(group);

    const building = {
        id,
        type: 'campfire',
        group,
        position: new THREE.Vector3(x, 0, z),
        effect: {
            type: 'warmth_nearby',
            radius: 5,
            warmthPerSecond: 0.5
        },
        builder: builderId,
        builtAt: Date.now()
    };

    buildings.push(building);
    console.log(`[Building] Campfire built at (${x.toFixed(1)}, ${z.toFixed(1)})`);
    return building;
}

/**
 * Create a shelter building
 */
export function createShelter(x, z, visualDirector, builderId = null) {
    const scene = visualDirector.scene;
    const group = visualDirector.getAsset('shelter');
    const id = `shelter_${++buildingIdCounter}`;

    group.position.set(x, 0, z);
    scene.add(group);

    const building = {
        id,
        type: 'shelter',
        group,
        position: new THREE.Vector3(x, 0, z),
        effect: {
            type: 'warmth_passive',
            radius: 8,
            warmthPerMinute: 2
        },
        builder: builderId,
        builtAt: Date.now()
    };

    buildings.push(building);
    console.log(`[Building] Shelter built at (${x.toFixed(1)}, ${z.toFixed(1)})`);
    return building;
}

/**
 * Create a building by type
 */
export function createBuilding(type, x, z, visualDirector, builderId = null) {
    switch (type.toLowerCase()) {
        case 'campfire':
            return createCampfire(x, z, visualDirector, builderId);
        case 'shelter':
            return createShelter(x, z, visualDirector, builderId);
        default:
            console.log(`[Building] Unknown building type: ${type}`);
            return null;
    }
}

/**
 * Apply building effects to nearby agents
 */
export function applyBuildingEffects(agents, delta = 0.016) {
    buildings.forEach(building => {
        agents.forEach(agent => {
            if (agent.isDead) return;

            const dist = agent.group.position.distanceTo(building.position);

            if (dist <= building.effect.radius) {
                switch (building.effect.type) {
                    case 'warmth_nearby':
                        agent.stats.warmth = Math.min(100,
                            agent.stats.warmth + building.effect.warmthPerSecond * delta
                        );
                        break;
                    case 'warmth_passive':
                        agent.stats.warmth = Math.min(100,
                            agent.stats.warmth + (building.effect.warmthPerMinute / 60) * delta
                        );
                        break;
                }
            }
        });
    });
}

/**
 * Get all buildings for serialization
 */
export function getBuildings() {
    return buildings;
}

/**
 * Find nearest building of a type
 */
export function findNearestBuilding(agent, buildingType = null) {
    const agentPos = agent.group.position;

    let nearest = null;
    let nearestDist = Infinity;

    buildings.forEach(building => {
        if (buildingType && building.type !== buildingType) return;

        const dist = agentPos.distanceTo(building.position);
        if (dist < nearestDist) {
            nearestDist = dist;
            nearest = building;
        }
    });

    return nearest;
}

/**
 * Serialize buildings for LLM prompt
 */
export function serializeBuildings(agentPos) {
    return buildings.map(b => ({
        id: b.id,
        type: b.type,
        position: [b.position.x.toFixed(1), 0, b.position.z.toFixed(1)],
        distance: agentPos.distanceTo(b.position).toFixed(1),
        effect: b.effect.type
    }));
}
