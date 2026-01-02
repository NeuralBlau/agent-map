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
        berry: 45,
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


import themeManager from './visuals/ThemeManager.js';

export const COLORS = {
    get BACKGROUND() { return themeManager.get('atmosphere'); },
    get GROUND() { return themeManager.get('surface'); },
    get GRID_PRIMARY() { return themeManager.get('surface'); },
    get GRID_SECONDARY() { return themeManager.get('surface'); },
    get AGENT_PIONEER() { return themeManager.get('accentA'); },
    get AGENT_SETTLER() { return themeManager.get('accentB'); },
    
    // Bar colors - Keeping these static or semantic?
    HUNGER_BAR: 'hsl(30, 100%, 60%)',
    WARMTH_BAR: 'hsl(210, 100%, 65%)',
    HEALTH_BAR: 'hsl(0, 100%, 65%)',
    ENERGY_BAR: 'hsl(50, 100%, 60%)',
    EYE: 'hsl(0, 0%, 20%)'
};

export const API = {
    BASE_URL: 'http://localhost:3000',
    LLM_ENDPOINT: 'http://localhost:3000/decide',
    STRATEGIC_ENDPOINT: 'http://localhost:3000/strategic',
    TACTICAL_ENDPOINT: 'http://localhost:3000/tactical',
    RESET_LOG_ENDPOINT: 'http://localhost:3000/reset-log',
    WHISPER_TIMEOUT: 15000
};
