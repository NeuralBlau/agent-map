/**
 * PromptTemplates.js - Centralized storage for LLM prompt templates
 */

export function getStrategicPrompt(agentName, state) {
    const agent = state.agent;
    const stats = agent.stats || {};
    const inventory = agent.inventory || {};
    const buildings = state.buildings || [];
    const nearbyCampfires = buildings.filter(b => b.type.toUpperCase() === 'CAMPFIRE');
    
    // Helper: Numeric -> Qualitative
    const qual = (val) => {
        if (val <= 0) return "Empty";
        if (val < 10) return "Low";
        if (val < 50) return "Medium";
        return "High";
    };

    // Helper: Inventory -> Qualitative
    // Wood/Stone: Low(<5), Medium(5-15), High(15-25), Very High(>25)
    // Berries: Low(<3), Medium(3-10), High(>10)
    const qualInv = (type, val) => {
        if (val <= 0) return "None";
        if (type === 'berries') {
            if (val >= 2) return "High";
            if (val >= 1) return "Medium";
            return "Low";
        }
        if (type === 'stone') {
            if (val >= 5) return "High";
            if (val >= 2) return "Medium";
            return "Low";
        }
        if (val >= 10) return "Very High";
        if (val >= 9) return "High";
        if (val >= 5) return "Medium";        
        return "Low";
    };

    // Dynamic Goals based on Resources
    // Only show CRAFT options if resources are available (approximate check for prompt clarity)
    // We strictly follow the prompt structure provided by the user.

    const promptText = `
You are an expert thinking model which can come up with optimal plans controll an agent in a video game and your task is to make plans to survive and build a shelter.

For this you have to ALWAYS think in three steps: 1) Analyse the situation and and evaluate which Goal to focus on 2) Analyse the context to find out what is needed to achieve the goal and 3) Critically evaluate your inventory and find out if you have to correct materials or if you have to gather them first

Here is the context of the sitation and the game:

If your health points are empty, you lose; if you build a shelter, you win.
So you have to balance going for the win and making sure you dont die in the process.

The following status values and characteristics are available:

• Food: Empty, Low, Medium, High
• Warmth: Empty, Low, Medium, High
• Life: Empty, Low, Medium, High

Your life decreases over time from High -> Medium -> Low -> Empty when either your warmth or food is empty.

Your food decreases over time from High -> Medium -> Low -> Empty.

Your warmth decreases over time from High -> Medium -> Low -> Empty.

You can increase you warmth again if you stand next to a campfire (more context later).
You can increase your food if you eat berries (more context later).

The following options are available:
• Increase life: Food & warmth High and your life will slowly increase again
• Increase food: Collect & eat berries | if you have berries in your inventory you can eat them right away
• Increase warmth: Stand next to campfire | Requieres campfire on the map and contiously deciding to stand next to it for at least 1 action step.
• Gather resources to to be able to craft

• AVAILABLE CAMPFIRES ON THE MAP: ${nearbyCampfires.length > 0 ? "YES" : "NONE"}

You have the following options to manipulate the game score:
• Gather wood
• Gather stone
• Gather berries
• Craft a campfire
• Stand next to a campfire
• Consume berries
• Craft a shelter

For a campfire you need the following two ressources in this amount or more: High wood AND Medium stone.

For a shelter you need the following two ressources in this amount or more: Very High wood AND High stone.

When you craft a campfire both Wood and Stone immediatley decrease to NONE and you need to collect ressources again before you can craft.

Standing next to a campfire will regain your warmth stat regardless if you crafted it before or not, you simple have to stand next to it.

HERE ARE YOU CURRENT STATUS VALUES - CONSIDER BEFORE YOU TAKE ACTION:
Food: ${qual(stats.food)}
Warmth: ${qual(stats.warmth)}
Life: ${qual(stats.health)}


HERE IS YOUR CURRENT INVENTORY - CONSIDER BEFORE YOU TAKE ACTION:
Wood: ${qualInv('wood', inventory.wood || 0)}
Stone: ${qualInv('stone', inventory.stone || 0)}
Berries: ${qualInv('berries', inventory.berries || 0)}

Decide now which value you want to focus on (Focus) and what specific action will achieve that (Goal).

Valid GOAL options:

- GATHER_WOOD
- GATHER_STONE
- GATHER_BERRIES
- CONSUME_BERRIES

Valid GOAL options ONLY IF YOU HAVE THE REQUIERED RESSOURCES:

- BUILD_CAMPFIRE
- BUILD_SHELTER

Valid GOAL options ONLY IF ALREADY AVAILABLE ON THE MAP:

- STAND_NEAR_CAMPFIRE

Before you answer, walk me through your thought process.

Then append your answer as a VALID JSON ONLY to solve the query.


{
"goal": "One of the Valid GOAL options",
"priority": "LOW/MEDIUM/HIGH/URGENT",
"reasoning": "Brief explanation of why you chose this Focus and Goal."
}
`;
    // Debug logging for prompt analysis
    console.log(`\n\n[STRATEGIC PROMPT for ${agentName}]:\n${promptText}\n----------------------------------------\n`);
    
    return promptText;
}

export function getTacticalPrompt(agentName, state, strategicGoal) {
    const agent = state.agent;
    const stats = agent.stats || {};
    const inventory = agent.inventory || {};
    const failureMemory = agent.lastFailure ? `\nLAST PLAN FAILED AT: ${agent.lastFailure.step} because of the environment. AVOID DOING THE SAME THING.` : "";


    return `
YOU ARE THE TACTICAL MIND OF ${agentName}.
Your job is to break down a STRATEGIC GOAL into a list of executable steps for the Behavior Tree.

STRATEGIC GOAL: ${strategicGoal.goal} (${strategicGoal.priority})
REASONING: ${strategicGoal.reasoning}

---
CURRENT STATE:
- Stats: Food: ${stats.food}, Warmth: ${stats.warmth}, Health: ${stats.health}
- Inventory: ${JSON.stringify(inventory)}
- Last Action Failure: ${agent.lastFailure ? agent.lastFailure.step : "None"}${failureMemory}

PERCEPTION (Goal Requirements):
${JSON.stringify(state.perception?.goalRequirements || "N/A", null, 2)}

PERCEPTION (Nearby Resources):
${JSON.stringify(state.resources || [], null, 2)}


INSTRUCTIONS:
1. Break the goal into 1-5 specific steps.
2. Steps must use keywords: MOVE_TO [targetId], HARVEST [targetId], BUILD [recipeId], EAT [itemType].
3. For MOVE_TO/HARVEST, use the exact ID from Nearby Resources if available (e.g., "tree_01").
4. For STRATEGIC GOAL: CONSUME_BERRIES you can EAT the item from your inventory right away and don't have to harvest first.
5. For STRATEGIC GOAL: BUILD_CAMPFIRE or BUILD_SHELTER you can directly BUILD with the items from your inventory and don't have to gather first.
6. If no specific ID is visible for a required resource, use generic MoveTo: "MOVE_TO tree" or "MOVE_TO rock".
7. ALWAYS ensure you have the materials before a BUILD step.
8. If the Goal is GATHER_X, ensure the plan ends with at least one HARVEST step.

Respond in VALID JSON ONLY:
{
  "thought": "Brief tactical reasoning",
  "plan": [
    "MOVE_TO tree_01",
    "HARVEST tree_01",
    "MOVE_TO rock_02"
  ]
}
`;
}

export function getDecidePrompt(agentName, state) {
    const agent = state.agent;
    const stats = {
        food: parseFloat(agent.stats?.food) || 100,
        warmth: parseFloat(agent.stats?.warmth) || 100,
        health: parseFloat(agent.stats?.health) || 100,
        energy: parseFloat(agent.stats?.energy) || 100
    };
    const inventory = agent.inventory || {};
    const resources = state.resources || [];
    const buildings = state.buildings || [];
    const others = state.others || [];
    const position = agent.position || [0, 0, 0];

    const nearbyTrees = resources.filter(r => r.type === 'tree').slice(0, 3);
    const nearbyRocks = resources.filter(r => r.type === 'rock').slice(0, 3);
    const nearbyBerries = resources.filter(r => r.type === 'berry').slice(0, 3);

    return `
You are ${agentName}, a survivor on a stranded island.



YOUR CURRENT STATE:
- Position: [${position}]
- Stats: Food=${stats.food}/100, Warmth=${stats.warmth}/100, Health=${stats.health}/100, Energy=${stats.energy}/100
- Inventory: ${JSON.stringify(inventory)}
- Current State: ${agent.state || 'IDLE'}

NEARBY RESOURCES:
- Trees (wood): ${nearbyTrees.length > 0 ? nearbyTrees.map(t => `${t.id}(${t.remaining} left, dist:${t.dist})`).join(', ') : 'none visible'}
- Rocks (stone): ${nearbyRocks.length > 0 ? nearbyRocks.map(r => `${r.id}(${r.remaining} left, dist:${r.dist})`).join(', ') : 'none visible'}
- Berry bushes: ${nearbyBerries.length > 0 ? nearbyBerries.map(b => `${b.id}(${b.remaining} left, dist:${b.dist})`).join(', ') : 'none visible'}

BUILDINGS: ${buildings.length > 0 ? buildings.map(b => `${b.type}(dist:${b.distance})`).join(', ') : 'none built yet'}

OTHER SURVIVORS: ${others.length > 0 ? others.map(o => `${o.name}(dist:${o.distance})`).join(', ') : 'alone'}

INSTRUCTIONS:
1. Response MUST be valid JSON only.
2. You MUST be within 2.5 units to HARVEST a resource.
3. Use your knowledge to prioritize health and survival.
4. If resources are needed for a building mentioned in world rules, gather them.

What is your next action? Respond with JSON only:
{"action": "ACTION_NAME", "targetId": "id" OR "target": [x,0,z], "recipeId": "RECIPE", "itemType": "item", "thought": "brief reasoning"}
`;
}
