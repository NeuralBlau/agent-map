/**
 * TacticalPlanner.js
 * 
 * Deterministic logic to translate Strategic Goals into proper Behavior Tree plans.
 * Replaces the remote LLM Tactical Mind.
 */

import { RECIPES, canCraft } from '../systems/Crafting.js';

export const TacticalPlanner = {

    /**
     * Generate a plan based on the strategic goal
     * @param {Object} agent - The agent entity
     * @param {Object} strategicGoal - { goal: 'GATHER_WOOD', priority: 'HIGH' }
     * @param {Array} worldResources - List of all resource nodes in the world
     * @param {Array} worldBuildings - List of all buildings in the world
     * @returns {Object} { plan: string[], thought: string }
     */
    generatePlan(agent, strategicGoal, worldResources, worldBuildings = []) {
        const goal = strategicGoal.goal.toUpperCase();
        
        // 1. GATHER Logic
        if (goal.startsWith('GATHER_')) {
            const type = goal.replace('GATHER_', '').toLowerCase(); 
            // Map Goal Type to Resource Type
            let resourceType = type;
            if (type === 'wood') resourceType = 'tree';
            if (type === 'stone') resourceType = 'rock';
            if (type === 'berries') resourceType = 'berry';

            return this.planGather(agent, resourceType, worldResources);
        }

        // 2. BUILD Logic
        if (goal.startsWith('BUILD_')) {
            const recipeId = goal.replace('BUILD_', '').toLowerCase();
            return this.planBuild(agent, recipeId, worldBuildings);
        }

        // 3. CONSUME Logic
        if (goal.startsWith('CONSUME_')) {
            const itemType = goal.replace('CONSUME_', '').toLowerCase();
            return this.planConsume(agent, itemType);
        }

        // 4. STAND_NEAR_CAMPFIRE Logic
        if (goal === 'STAND_NEAR_CAMPFIRE') {
            return this.planStandNearCampfire(agent, worldBuildings);
        }
        
        // Fallback for IDLE or SURVIVE
        if (goal === 'SURVIVE' || goal === 'IDLE') {
             return { plan: ['WAIT'], thought: 'Surviving...' };
        }

        return { plan: ['WAIT'], thought: `Unknown Goal: ${goal}` };
    },

    planGather(agent, resourceType, worldResources) {
        // Find nearest VALID resource
        const resources = worldResources
            .filter(r => r.type === resourceType && r.remaining > 0)
            .map(r => ({
                node: r,
                dist: agent.group.position.distanceTo(r.group.position)
            }))
            .sort((a, b) => a.dist - b.dist);

        if (resources.length === 0) {
            return { 
                plan: null, 
                thought: `❌ No ${resourceType} found!` 
            };
        }

        const target = resources[0].node;
        const targetId = target.id;

        // Multi-Harvest Logic (1-3 times)
        const count = Math.floor(Math.random() * 3) + 1;
        
        const plan = [`Move to ${targetId}`];
        for(let i=0; i<count; i++) {
            plan.push(`Harvest ${targetId}`);
        }

        return {
            plan: plan,
            thought: `Gathering ${resourceType} from ${targetId}`
        };
    },

    planBuild(agent, recipeId, worldBuildings) {
        // Normalize Recipe ID (handle case variations)
        const recipeKey = Object.keys(RECIPES).find(k => k.toLowerCase() === recipeId.toLowerCase());
        
        if (!recipeKey) {
             return { plan: null, thought: `❌ Unknown recipe: ${recipeId}` };
        }
        
        const realId = RECIPES[recipeKey].id;

        // CRITICAL BUG FIX: Prevent multiple campfires
        if (realId === 'campfire') {
            const hasCampfire = worldBuildings.some(b => b.type === 'campfire');
            if (hasCampfire) {
                 return { plan: null, thought: `Campfire already exists!` };
            }
        }

        // Check Requirements
        if (!canCraft(agent, recipeKey)) {
             return { plan: null, thought: `❌ Missing materials for ${realId}` };
        }

        return {
            plan: [`Build ${realId}`],
            thought: `Building ${realId}!`
        };
    },

    planConsume(agent, itemType) {
        // Validation handled by EatNode usually, but we check inv here too
        if (!agent.inventory[itemType] || agent.inventory[itemType] <= 0) {
            return { plan: null, thought: `❌ No ${itemType} to eat` };
        }

        return {
            plan: [`Eat ${itemType}`],
            thought: `Yummy ${itemType}!`
        };
    },

    planStandNearCampfire(agent, worldBuildings) {
        const campfire = worldBuildings.find(b => b.type === 'campfire');
        if (!campfire) {
            return { plan: null, thought: `❌ No campfire found!` };
        }

        return {
            plan: [`Move to ${campfire.id}`, 'Wait(2000)'],
            thought: `Warming up at ${campfire.id}`
        };
    }
};
