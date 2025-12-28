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
export function createCampfire(x, z, scene, builderId = null) {
    const group = new THREE.Group();
    const id = `campfire_${++buildingIdCounter}`;

    // Stone ring
    const ringGeo = new THREE.RingGeometry(0.4, 0.6, 8);
    const ringMat = new THREE.MeshStandardMaterial({
        color: COLORS.ROCK,
        side: THREE.DoubleSide
    });
    const ring = new THREE.Mesh(ringGeo, ringMat);
    ring.rotation.x = -Math.PI / 2;
    ring.position.y = 0.05;
    group.add(ring);

    // Fire logs
    const logGeo = new THREE.CylinderGeometry(0.05, 0.05, 0.4, 6);
    const logMat = new THREE.MeshStandardMaterial({ color: COLORS.TREE_TRUNK });
    for (let i = 0; i < 4; i++) {
        const log = new THREE.Mesh(logGeo, logMat);
        log.rotation.z = Math.PI / 2;
        log.rotation.y = (i / 4) * Math.PI;
        log.position.y = 0.1;
        group.add(log);
    }

    // Fire glow (simple orange/yellow sphere)
    const fireGeo = new THREE.SphereGeometry(0.25, 8, 8);
    const fireMat = new THREE.MeshBasicMaterial({
        color: 0xff6600,
        transparent: true,
        opacity: 0.8
    });
    const fire = new THREE.Mesh(fireGeo, fireMat);
    fire.position.y = 0.3;
    group.add(fire);

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
export function createShelter(x, z, scene, builderId = null) {
    const group = new THREE.Group();
    const id = `shelter_${++buildingIdCounter}`;

    // Base platform
    const baseGeo = new THREE.BoxGeometry(3, 0.2, 3);
    const baseMat = new THREE.MeshStandardMaterial({ color: COLORS.TREE_TRUNK });
    const base = new THREE.Mesh(baseGeo, baseMat);
    base.position.y = 0.1;
    group.add(base);

    // Corner posts
    const postGeo = new THREE.BoxGeometry(0.2, 2, 0.2);
    const postMat = new THREE.MeshStandardMaterial({ color: COLORS.TREE_TRUNK });
    const positions = [
        [-1.2, 1, -1.2], [1.2, 1, -1.2],
        [-1.2, 1, 1.2], [1.2, 1, 1.2]
    ];
    positions.forEach(pos => {
        const post = new THREE.Mesh(postGeo, postMat);
        post.position.set(...pos);
        group.add(post);
    });

    // Roof (simple pyramid)
    const roofGeo = new THREE.ConeGeometry(2.2, 1.5, 4);
    const roofMat = new THREE.MeshStandardMaterial({ color: COLORS.TREE_LEAVES });
    const roof = new THREE.Mesh(roofGeo, roofMat);
    roof.position.y = 2.5;
    roof.rotation.y = Math.PI / 4;
    group.add(roof);

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
export function createBuilding(type, x, z, scene, builderId = null) {
    switch (type.toLowerCase()) {
        case 'campfire':
            return createCampfire(x, z, scene, builderId);
        case 'shelter':
            return createShelter(x, z, scene, builderId);
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
