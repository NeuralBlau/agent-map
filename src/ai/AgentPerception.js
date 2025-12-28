import { serializeInventory } from '../systems/Inventory.js';
import { RECIPES } from '../systems/Crafting.js';
import { serializeBuildings } from '../entities/Building.js';

/**
 * AgentPerception - Handles serialization of agent state and world perception for LLM consumption
 */
export function serializeAgent(agent, allAgents, seeds, scene, currentWhisper, resourceNodes = [], buildings = []) {
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
        const gaps = {};
        let isReady = true;
        Object.entries(recipe.requirements).forEach(([item, needed]) => {
            const have = agent.inventory[item] || 0;
            if (have < needed) {
                gaps[item] = `MISSING ${needed - have}`;
                isReady = false;
            }
        });
        allRecipeFeasibility[id] = isReady ? "READY" : gaps;
        
        // The "Glasses" - Simple boolean text for LLM
        buildingReadiness[`CAN_BUILD_${id}`] = isReady ? 
            "YES (Have Materials)" : 
            `NO (Missing: ${Object.values(gaps).join(', ')})`;
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
                hunger: agent.stats.hunger.toFixed(0),
                warmth: agent.stats.warmth.toFixed(0),
                health: agent.stats.health.toFixed(0),
                energy: agent.stats.energy.toFixed(0)
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
        seeds: seeds
            .filter(s => s.parent === scene)
            .map(s => ({
                id: s.userData.id,
                type: 'seed',
                position: [s.position.x.toFixed(1), 0, s.position.z.toFixed(1)],
                dist: agent.group.position.distanceTo(s.position).toFixed(1)
            })),
        buildings: buildings
    };

    if (currentWhisper) {
        state.god_whisper = currentWhisper;
    }

    return state;
}
