// Crafting System
// Recipes for building structures and crafting items

import { hasItems, consumeItems } from './Inventory.js';
import { getPacingPreset } from '../game_presets.js';

const pacing = getPacingPreset();

/**
 * All available recipes in the game
 * Easily expandable - just add new entries
 */
export const RECIPES = {
    // Buildings
    CAMPFIRE: {
        id: 'campfire',
        name: 'Campfire',
        category: 'building',
        requirements: { wood: 10, stone: 3 },
        craftTime: 10000 * pacing.craftTimeMultiplier,
        description: 'Provides warmth when standing nearby',
        effect: {
            type: 'warmth_nearby',
            radius: 5,
            warmthPerSecond: 0.5
        }
    },
    SHELTER: {
        id: 'shelter',
        name: 'Shelter',
        category: 'building',
        requirements: { wood: 20, stone: 10 },
        craftTime: 1000 * pacing.craftTimeMultiplier,
        description: 'Provides passive warmth restoration',
        effect: {
            type: 'warmth_passive',
            radius: 8,
            warmthPerMinute: 2
        }
    },

    // Tools
    SPEAR: {
        id: 'spear',
        name: 'Spear',
        category: 'tool',
        requirements: { wood: 5, stone: 2 },
        craftTime: 5000 * pacing.craftTimeMultiplier,
        description: 'Enables hunting animals',
        effect: {
            type: 'enables_action',
            action: 'HUNT'
        }
    }
};

/**
 * Check if agent can craft a recipe
 */
export function canCraft(agent, recipeId) {
    const recipe = RECIPES[recipeId];
    if (!recipe) {
        console.log(`[Crafting] Unknown recipe: ${recipeId}`);
        return false;
    }

    return hasItems(agent, recipe.requirements);
}

/**
 * Get missing items for a recipe
 */
export function getMissingItems(agent, recipeId) {
    const recipe = RECIPES[recipeId];
    if (!recipe) return null;

    const missing = {};
    Object.entries(recipe.requirements).forEach(([item, needed]) => {
        const have = agent.inventory?.[item] || 0;
        if (have < needed) {
            missing[item] = needed - have;
        }
    });

    return Object.keys(missing).length > 0 ? missing : null;
}

/**
 * Start crafting a recipe
 * @param {Object} agent - The agent crafting
 * @param {string} recipeId - Recipe ID to craft
 * @param {THREE.Vector3} position - Where to place the result (for buildings)
 * @param {Function} onComplete - Callback when complete
 * @returns {boolean} True if crafting started
 */
export function startCraft(agent, recipeId, position, onComplete) {
    const recipe = RECIPES[recipeId];

    if (!recipe) {
        console.log(`[Crafting] Unknown recipe: ${recipeId}`);
        return false;
    }

    if (!canCraft(agent, recipeId)) {
        console.log(`[Crafting] ${agent.name} missing items for ${recipe.name}`);
        return false;
    }

    // Consume resources
    if (!consumeItems(agent, recipe.requirements)) {
        console.log(`[Crafting] Failed to consume items for ${recipe.name}`);
        return false;
    }

    agent.state = 'CRAFTING';
    agent.crafting = {
        recipe,
        position,
        startTime: Date.now()
    };

    console.log(`[Crafting] ${agent.name} started crafting ${recipe.name}...`);

    setTimeout(() => {
        agent.state = 'IDLE';
        agent.crafting = null;

        console.log(`[Crafting] ${agent.name} finished crafting ${recipe.name}!`);

        if (onComplete) {
            onComplete(recipe, position);
        }
    }, recipe.craftTime);

    return true;
}

/**
 * Get all recipes an agent can currently craft
 */
export function getCraftableRecipes(agent) {
    return Object.entries(RECIPES)
        .filter(([id]) => canCraft(agent, id))
        .map(([id, recipe]) => ({ id, ...recipe }));
}

/**
 * Get all recipes (for LLM context)
 */
export function getAllRecipes() {
    return Object.entries(RECIPES).map(([id, recipe]) => ({
        id,
        name: recipe.name,
        category: recipe.category,
        requirements: recipe.requirements,
        description: recipe.description
    }));
}

/**
 * Serialize recipes for LLM prompt
 */
export function serializeRecipes() {
    return Object.entries(RECIPES).map(([id, recipe]) => {
        const req = Object.entries(recipe.requirements)
            .map(([item, amt]) => `${amt} ${item}`)
            .join(', ');
        return `${id}: ${recipe.name} (${req}) - ${recipe.description}`;
    }).join('\n');
}
