// Game Presets Configuration
// Allows users to customize game pacing and resource abundance
// Default: medium for all settings

export const PACING_PRESETS = {
    fast: {
        name: 'Fast',
        description: 'Quick stat decay, intense survival pressure',
        foodDecayRate: 2.0,      // Per second
        warmthDecayRate: 0.5,
        energyDecayRate: 0.3,
        healthRegenRate: 0.1,
        harvestTime: 2000,         // ms per harvest action
        craftTimeMultiplier: 0.5
    },
    medium: {
        name: 'Medium',
        description: 'Balanced gameplay',
        foodDecayRate: 1.0,
        warmthDecayRate: 0.2,
        energyDecayRate: 0.1,
        healthRegenRate: 0.05,
        harvestTime: 3000,
        craftTimeMultiplier: 1.0
    },
    slow: {
        name: 'Slow',
        description: 'Relaxed pace, focus on building',
        foodDecayRate: 0.5,
        warmthDecayRate: 0.1,
        energyDecayRate: 0.05,
        healthRegenRate: 0.02,
        harvestTime: 4000,
        craftTimeMultiplier: 1.5
    }
};

export const ABUNDANCE_PRESETS = {
    low: {
        name: 'Scarce',
        description: 'Few resources, strategic gathering required',
        treeCount: 8,
        rockCount: 5,
        berryBushCount: 3,
        resourcePerNode: { min: 3, max: 5 },
        respawnTimeMultiplier: 2.0
    },
    medium: {
        name: 'Balanced',
        description: 'Moderate resources',
        treeCount: 15,
        rockCount: 10,
        berryBushCount: 6,
        resourcePerNode: { min: 5, max: 10 },
        respawnTimeMultiplier: 1.0
    },
    high: {
        name: 'Abundant',
        description: 'Plentiful resources, focus on building',
        treeCount: 25,
        rockCount: 18,
        berryBushCount: 12,
        resourcePerNode: { min: 8, max: 15 },
        respawnTimeMultiplier: 0.5
    }
};

// Active preset selection (can be changed by user)
export const ACTIVE_PRESETS = {
    pacing: 'medium',
    abundance: 'medium'
};

// Helper to get current preset values
export function getPacingPreset() {
    return PACING_PRESETS[ACTIVE_PRESETS.pacing] || PACING_PRESETS.medium;
}

export function getAbundancePreset() {
    return ABUNDANCE_PRESETS[ACTIVE_PRESETS.abundance] || ABUNDANCE_PRESETS.medium;
}
