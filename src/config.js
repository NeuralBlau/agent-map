// Game Configuration Constants
// Centralized tuning parameters for easy adjustment

export const WORLD = {
    FOG_NEAR: 10,
    FOG_FAR: 50,
    GRID_SIZE: 40,
    GRID_DIVISIONS: 40,
    GROUND_SIZE: 100,
    DECORATION_COUNT: 15,
    SPAWN_RANGE: 30
};

export const AGENT = {
    BASE_SPEED: 0.15,
    STARVING_SPEED: 0.08,
    STUCK_TIMEOUT: 15, // seconds
    INTERACTION_DISTANCE: 2.0,
    DECISION_INTERVAL: 5000,
    HUNGER_DECAY_RATE: 1.5,
    HUNGER_DECAY_INTERVAL: 3000,
    HUNGER_REPLENISH: 30,
    STARVING_THRESHOLD: 20
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
    HUNGER_FULL: 0x00ff00,
    EYE: 0x000000
};

export const API = {
    LLM_ENDPOINT: 'http://localhost:3000/decide',
    WHISPER_TIMEOUT: 30000
};
