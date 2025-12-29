// Seed Entity Module
// Seed creation, animation, and respawn logic

import * as THREE from 'three';
import { SEED, COLORS, WORLD } from '../config.js';

export const seeds = [];

export function createSeed(id, x, z, visualDirector) {
    const scene = visualDirector.scene;
    const seed = visualDirector.getAsset('seed');
    
    seed.position.set(x, 0.3, z);
    seed.userData = { id };
    scene.add(seed);
    seeds.push(seed);
    return seed;
}

export function updateSeedAnimation(seed, now) {
    if (seed.parent) {
        seed.position.y = 0.3 + Math.sin(now * SEED.FLOAT_SPEED + seed.position.x) * SEED.FLOAT_AMPLITUDE;
        seed.rotation.y += SEED.ROTATION_SPEED;
    }
}

export function checkSeedRespawn(visualDirector, addLog) {
    const scene = visualDirector.scene;
    const activeSeeds = seeds.filter(s => s.parent === scene);

    if (activeSeeds.length < SEED.MIN_COUNT && Math.random() < SEED.RESPAWN_CHANCE) {
        const x = (Math.random() - 0.5) * WORLD.SPAWN_RANGE;
        const z = (Math.random() - 0.5) * WORLD.SPAWN_RANGE;
        createSeed(`seed_gen_${Date.now()}`, x, z, visualDirector);
        if (addLog) addLog('A new golden seed has emerged in the wild.', 'system');
    }
}

export function findSeedById(id, scene) {
    return seeds.find(s => s.userData.id === id && s.parent === scene);
}
