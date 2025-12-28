// Game Configuration Constants
// Centralized tuning parameters for easy adjustment

import { getPacingPreset, getAbundancePreset } from './game_presets.js';

// Get active presets
const pacing = getPacingPreset();
const abundance = getAbundancePreset();

export const WORLD = {
    FOG_NEAR: 10,
    FOG_FAR: 50,
    GRID_SIZE: 40,
    GRID_DIVISIONS: 40,
    GROUND_SIZE: 100,
    SPAWN_RANGE: 30,
    // Resource counts from abundance preset
    TREE_COUNT: abundance.treeCount,
    ROCK_COUNT: abundance.rockCount,
    BERRY_BUSH_COUNT: abundance.berryBushCount
};

export const AGENT = {
    BASE_SPEED: 0.15,
    STARVING_SPEED: 0.08,
    FREEZING_SPEED: 0.06,
    STUCK_TIMEOUT: 15, // seconds
    INTERACTION_DISTANCE: 2.0,
    DECISION_INTERVAL: 5000,

    // Extended stats - initial values
    INITIAL_STATS: {
        hunger: 100,
        warmth: 100,
        health: 100,
        energy: 100
    },

    // Stat decay rates (per second) from pacing preset
    STAT_DECAY: {
        hunger: pacing.hungerDecayRate,
        warmth: pacing.warmthDecayRate,
        energy: pacing.energyDecayRate
    },

    // Health regeneration when other stats are good
    HEALTH_REGEN_RATE: pacing.healthRegenRate,

    // Critical thresholds
    CRITICAL_THRESHOLD: 20,  // Below this, apply penalties
    DEATH_THRESHOLD: 0,      // At 0, agent dies

    // Stat effects
    HUNGER_REPLENISH: {
        berry: 15,
        cookedMeat: 40,
        rawMeat: 20
    },
    WARMTH_REPLENISH: {
        nearFire: 5,         // Per 10 seconds
        inShelter: 2         // Per minute (passive)
    },

    // Inventory
    INVENTORY_CAPACITY: 50
};

export const RESOURCES = {
    // Resource per node from abundance preset
    YIELD_RANGE: abundance.resourcePerNode,
    RESPAWN_MULTIPLIER: abundance.respawnTimeMultiplier,

    TREE: {
        harvestTime: pacing.harvestTime,
        yieldMin: abundance.resourcePerNode.min,
        yieldMax: abundance.resourcePerNode.max,
        respawnTime: 60000 * abundance.respawnTimeMultiplier
    },
    ROCK: {
        harvestTime: pacing.harvestTime * 1.2,
        yieldMin: Math.floor(abundance.resourcePerNode.min * 0.6),
        yieldMax: Math.floor(abundance.resourcePerNode.max * 0.6),
        respawnTime: 90000 * abundance.respawnTimeMultiplier
    },
    BERRY_BUSH: {
        harvestTime: pacing.harvestTime * 0.5,
        yieldMin: 1,
        yieldMax: 3,
        respawnTime: 45000 * abundance.respawnTimeMultiplier
    }
};

export const SEED = {
    MIN_COUNT: 3,
    RESPAWN_CHANCE: 0.01,
    FLOAT_AMPLITUDE: 0.1,
    FLOAT_SPEED: 0.002,
    ROTATION_SPEED: 0.01,
    EAT_SHRINK_RATE: 0.9,
    EAT_THRESHOLD: 0.05
};

export const COLORS = {
    BACKGROUND: 0x0a0a0a,
    GROUND: 0x1a1a1a,
    GRID_PRIMARY: 0x444444,
    GRID_SECONDARY: 0x222222,
    LIGHT_AMBIENT: 0xffffff,
    LIGHT_DIRECTIONAL: 0xa0ff90,
    SEED: 0xffd700,
    AGENT_PIONEER: 0xa0ff90,
    AGENT_SETTLER: 0x90a0ff,
    TREE_TRUNK: 0x4d2902,
    TREE_LEAVES: 0x1a4d1a,
    ROCK: 0x444444,
    BERRY_BUSH: 0x8b0045,
    BERRY: 0xff1493,
    // Stat bar colors
    HUNGER_BAR: 0xffa500,
    WARMTH_BAR: 0x4169e1,
    HEALTH_BAR: 0xff0000,
    ENERGY_BAR: 0xffff00,
    EYE: 0x000000
};

export const API = {
    BASE_URL: 'http://localhost:3000',
    LLM_ENDPOINT: 'http://localhost:3000/decide',
    STRATEGIC_ENDPOINT: 'http://localhost:3000/strategic',
    TACTICAL_ENDPOINT: 'http://localhost:3000/tactical',
    RESET_LOG_ENDPOINT: 'http://localhost:3000/reset-log',
    WHISPER_TIMEOUT: 15000
};
