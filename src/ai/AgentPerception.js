import { serializeInventory } from '../systems/Inventory.js';
import { RECIPES } from '../systems/Crafting.js';
import { serializeBuildings } from '../entities/Building.js';

/**
 * AgentPerception - Handles serialization of agent state and world perception for LLM consumption
 */
export function serializeAgent(agent, allAgents, scene, currentWhisper, resourceNodes = [], buildings = []) {
    // v3 Pre-processor: Calculate Distances
    const findNearest = (type) => {
        const matching = resourceNodes.filter(r => r.type === type && r.remaining > 0);
        if (matching.length === 0) return "Infinity";
        const dists = matching.map(r => agent.group.position.distanceTo(r.group.position));
        return Math.min(...dists).toFixed(1);
    };

    const nearestDistances = {
        tree: findNearest('tree'),
        rock: findNearest('rock'),
        berry: findNearest('berry')
    };

    // v3.2 Perception Diversity: Ensure we see at least some of each type
    const getDiverseResources = () => {
        const types = ['tree', 'rock', 'berry'];
        let diverseNodes = [];

        types.forEach(type => {
            const matching = resourceNodes
                .filter(r => r.type === type && r.remaining > 0)
                .map(r => ({
                    id: r.id,
                    type: r.type,
                    position: [r.group.position.x.toFixed(1), 0, r.group.position.z.toFixed(1)],
                    remaining: r.remaining,
                    dist: agent.group.position.distanceTo(r.group.position).toFixed(1)
                }))
                .sort((a, b) => parseFloat(a.dist) - parseFloat(b.dist))
                .slice(0, 5); // Take top 5 of each type

            diverseNodes = diverseNodes.concat(matching);
        });

        return diverseNodes.sort((a, b) => parseFloat(a.dist) - parseFloat(b.dist));
    };

    const resources = getDiverseResources();

    // v3.2 Exploration Cues
    const explorationCues = {};
    ['tree', 'rock', 'berry'].forEach(type => {
        if (!resources.some(r => r.type === type)) {
            explorationCues[type] = "NONE VISIBLE (EXPLORATION REQUIRED)";
        }
    });

    // v3.3 Strategic Feasibility: Check ALL recipes for the Strategic Mind
    const allRecipeFeasibility = {};
    const buildingReadiness = {}; // Simple flags for the prompt: CAN_BUILD_X: YES/NO

    Object.entries(RECIPES).forEach(([id, recipe]) => {
        const gaps = [];
        const costs = [];
        const haves = [];
        let isReady = true;

        Object.entries(recipe.requirements).forEach(([item, needed]) => {
            const have = agent.inventory[item] || 0;
            // Short codes for brevity: Wood->w, Stone->s
            const code = item.charAt(0); 
            costs.push(`${needed}${code}`);
            haves.push(`${have}${code}`);
            
            if (have < needed) {
                gaps.push(`${needed - have}${code}`);
                isReady = false;
            }
        });
        
        // Global Building Limit Check
        // If it's a building (not a tool) and one already exists on the map, forbid it.
        const isBuilding = recipe.category === 'building';
        const alreadyBuilt = isBuilding && buildings.some(b => b.type === recipe.id);

        if (alreadyBuilt) {
             buildingReadiness[`CAN_BUILD_${id}`] = `NO (Already Built on Map)`;
             allRecipeFeasibility[id] = "ALREADY_BUILT";
        } else {
            // Standard Material Check
            buildingReadiness[`CAN_BUILD_${id}`] = isReady ? 
                `YES (Cost: ${costs.join(', ')} | Have: ${haves.join(', ')})` : 
                `NO (Cost: ${costs.join(', ')} | Have: ${haves.join(', ')} | MISSING: ${gaps.join(', ')})`;
        }
    });

    // v3 Pre-processor: Material Gaps
    const strategicGoal = agent.layers.strategic.goal || "NONE";
    const recipeId = strategicGoal.toLowerCase().replace('build_', '');
    const currentRecipe = RECIPES[recipeId.toUpperCase()];
    const currentRequirements = {};

    if (currentRecipe) {
        Object.entries(currentRecipe.requirements).forEach(([item, needed]) => {
            const have = agent.inventory[item] || 0;
            currentRequirements[item] = {
                have,
                needed,
                status: have >= needed ? "READY" : `LOCKED (Need ${needed - have} more)`
            };
        });
    }

    const state = {
        agent: {
            name: agent.name,
            position: [agent.group.position.x.toFixed(1), 0, agent.group.position.z.toFixed(1)],
            stats: {
                food: agent.stats.food.toFixed(0),
                warmth: agent.stats.warmth.toFixed(0),
                health: agent.stats.health.toFixed(0)
            },
            inventory: serializeInventory(agent),
            state: agent.state,
            lastFailure: agent.lastFailure
        },
        perception: {
            nearestDistances,
            buildingReadiness: buildingReadiness, // The "Pre-calc Math" layer
            detailedRecipes: allRecipeFeasibility, // Legacy, kept for debugging/tactical drill-down
            goalRequirements: currentRecipe ? currentRequirements : "N/A",
            explorationCues: Object.keys(explorationCues).length > 0 ? explorationCues : undefined
        },
        others: allAgents
            .filter(a => a !== agent && !a.isDead)
            .map(a => ({
                name: a.name,
                position: [a.group.position.x.toFixed(1), 0, a.group.position.z.toFixed(1)],
                distance: agent.group.position.distanceTo(a.group.position).toFixed(1)
            })),
        resources: resources,
        buildings: buildings
    };

    if (currentWhisper) {
        state.god_whisper = currentWhisper;
    }

    return state;
}
