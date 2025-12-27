// Seed Entity Module
// Seed creation, animation, and respawn logic

import * as THREE from 'three';
import { SEED, COLORS, WORLD } from '../config.js';

export const seeds = [];

export function createSeed(id, x, z, scene) {
    const seed = new THREE.Mesh(
        new THREE.IcosahedronGeometry(0.3, 0),
        new THREE.MeshStandardMaterial({
            color: COLORS.SEED,
            emissive: COLORS.SEED,
            emissiveIntensity: 0.5
        })
    );
    seed.position.set(x, 0.3, z);
    seed.castShadow = true;
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

export function checkSeedRespawn(scene, addLog) {
    const activeSeeds = seeds.filter(s => s.parent === scene);

    if (activeSeeds.length < SEED.MIN_COUNT && Math.random() < SEED.RESPAWN_CHANCE) {
        const x = (Math.random() - 0.5) * WORLD.SPAWN_RANGE;
        const z = (Math.random() - 0.5) * WORLD.SPAWN_RANGE;
        createSeed(`seed_gen_${Date.now()}`, x, z, scene);
        if (addLog) addLog('A new golden seed has emerged in the wild.', 'system');
    }
}

export function findSeedById(id, scene) {
    return seeds.find(s => s.userData.id === id && s.parent === scene);
}
