/**
 * PromptTemplates.js - Centralized storage for LLM prompt templates
 */

export function getStrategicPrompt(agentName, state, worldRules) {
    const agent = state.agent;
    const stats = agent.stats || {};
    const inventory = agent.inventory || {};
    const buildings = state.buildings || [];
    const nearbyCampfires = buildings.filter(b => b.type === 'CAMPFIRE');
    
    // DEBUG LOG
    console.log(`[PromptTemplate] Generating prompt for ${agentName}. Inventory:`, inventory);
    
    // Qualitative Stats Helper
    const describe = (val) => {
        if (val > 40) return `safe (${val})`;
        if (val > 20) return `WARN (${val})`;
        if (val > 5) return `CRITICAL (<20)`;
        return `DYING (<5)`;
    };

    const describeRes = (type, val) => {
        let needed = 20; // Shelter Wood
        if (type === 'stone') needed = 10;
        
        if (val >= needed) return `HIGH (Sufficient > ${needed} -> STOP GATHERING)`;
        if (val >= needed / 2) return `MEDIUM (${val})`;
        if (val > 0) return `LOW (${val})`;
        return `NONE (0)`;
    };

    const invStr = `Wood: ${describeRes('wood', inventory.wood || 0)}, Stone: ${describeRes('stone', inventory.stone || 0)}, Berries: ${inventory.berries || 0}`;

    const isCritical = stats.hunger < 10 || stats.warmth < 10 || stats.health < 20;
    const emergencyDirective = isCritical ? 
        `\n!!! EMERGENCY PROTOCOL !!! VITAL SIGNS CRITICAL. IGNORE ALL BUILDING GOALS. YOU MUST GATHER FOOD OR WARM UP. IF YOU BUILD, YOU DIE.\n` : "";

    return `
YOU ARE THE STRATEGIC MIND OF ${agentName}.

${emergencyDirective}


You control an agent in a video game and your task is to make long-term plans which allows your agent to survive long enough to eventually build a shelter.

If your health points are empty, you lose; if you build a shelter, you win.
So you have to balance going for the win and making sure you dont die in the process by identifiying the most important actions to take each time you are asked.

HERE IS YOUR CURRENT STATE:
- Stats: Hunger: ${describe(stats.hunger)}, Warmth: ${describe(stats.warmth)}, Health: ${describe(stats.health)}
- Inventory: ${invStr}
- Nearby Campfires: ${nearbyCampfires.length} built nearby.

THE FOLLOWING OPTIONS ARE AVAILABLE TO YOU. DECIDE WHAT YOU WANT TO DO NEXT:

• Need to Restore Hunger: Collect & eat berries (Goal: GATHER_FOOD)
• Need to Increase Warmth: Stand next to campfire (Goal: STAND_NEAR_CAMPFIRE) or Build one (Goal: BUILD_CAMPFIRE).
• Need to Win game: Build a shelter (Goal: BUILD_SHELTER). Needs Stone & Wood.
• Need Stone: Gather stone ONLY if Stone < 10 (Goal: GATHER_STONE).
• Need Wood: Gather wood ONLY if Wood < 20 (Goal: GATHER_WOOD).

IMPORTANT RULES:
1. Gathering WOOD does NOT help with Hunger.
2. Campfires do NOT produce food.
3. IF YOU HAVE ENOUGH WOOD (>20), DO NOT GATHER MORE WOOD. GATHER STONE OR BUILD.
4. If you are Hungry (WARN/CRITICAL), you MUST choose GATHER_FOOD.

---


FEASIBILITY CALCULATIONS (Pre-calculated):
${JSON.stringify(state.perception?.buildingReadiness || "Unknown", null, 2)}

YOUR TASK:
Define the next mid-term Strategic Goal.

GOAL PRIORITY RULES:
1. **PRIORITIZE HEALTH**. If any stat is DYING or CRITICAL, you MUST prioritize fixing that stat (EAT or WARMTH) immediately. Ignore building if you are dying.


VALID GOALS (CHOOSE EXACTLY ONE KEY FROM BELOW, DO NOT INVENT NEW GOALS):

- BUILD_SHELTER (Needs 20 wood,10 stone)
- BUILD_CAMPFIRE (Needs 10 wood)
- STAND_NEAR_CAMPFIRE (only possible if one is built)
- GATHER_FOOD (To maintain high hunger or stockpile)
- GATHER_WOOD 
- GATHER_STONE 

Respond in VALID JSON ONLY:
{
  "goal": "GOAL_NAME",
  "priority": "LOW/MEDIUM/HIGH/URGENT",
  "reasoning": "Brief explanation. IF DYING, state clearly: 'I am dying, must eat/warm up'.", 
}
`;
}

export function getTacticalPrompt(agentName, state, worldRules, strategicGoal) {
    const agent = state.agent;
    const stats = agent.stats || {};
    const inventory = agent.inventory || {};
    const failureMemory = agent.lastFailure ? `\nLAST PLAN FAILED AT: ${agent.lastFailure.step} because of the environment. AVOID DOING THE SAME THING.` : "";

    // LOGIC INJECTION: Anti-Grazer Hint
    // If agent has food and is hungry/surviving, tell them to EAT immediately.
    let tacticalHint = "";
    if ((inventory.berries > 0) && (strategicGoal.goal === 'SURVIVE' || strategicGoal.goal === 'GATHER_FOOD')) {
        tacticalHint = `\n[SYSTEM HINT]: You have ${inventory.berries} berries in inventory. PLAN 'EAT berries' IMMEDIATELY. Do not walk to a bush.`;
    }

    return `
YOU ARE THE TACTICAL MIND OF ${agentName}.
Your job is to break down a STRATEGIC GOAL into a list of executable steps for the Behavior Tree.

STRATEGIC GOAL: ${strategicGoal.goal} (${strategicGoal.priority})
REASONING: ${strategicGoal.reasoning}



---
CURRENT STATE:
- Stats: Hunger: ${stats.hunger}, Warmth: ${stats.warmth}, Health: ${stats.health}
- Inventory: ${JSON.stringify(inventory)}
- Last Action Failure: ${agent.lastFailure ? agent.lastFailure.step : "None"}${failureMemory}

PERCEPTION (Goal Requirements):
${JSON.stringify(state.perception?.goalRequirements || "N/A", null, 2)}

PERCEPTION (Nearby Resources):
${JSON.stringify(state.resources || [], null, 2)}

INSTRUCTIONS:
1. Break the goal into 1-5 specific steps.
2. Steps must use keywords: MOVE_TO [targetId], HARVEST [targetId], BUILD [recipeId], EAT [itemType], WAIT [ms].
3. For MOVE_TO/HARVEST, use the exact ID from Nearby Resources if available (e.g., "tree_01").
4. If no specific ID is visible for a required resource, use generic MoveTo: "MOVE_TO tree" or "MOVE_TO rock".
5. ALWAYS ensure you have the materials before a BUILD step.
6. If the Goal is GATHER_X, ensure the plan ends with at least one HARVEST step.
7. YOU CANNOT EAT FROM THE GROUND. You must HARVEST first.
8. ${tacticalHint}

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

export function getDecidePrompt(agentName, state, worldRules) {
    const agent = state.agent;
    const stats = {
        hunger: parseFloat(agent.stats?.hunger) || 100,
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
- Stats: Hunger=${stats.hunger}/100, Warmth=${stats.warmth}/100, Health=${stats.health}/100, Energy=${stats.energy}/100
- Inventory: ${JSON.stringify(inventory)}
- Current State: ${agent.state || 'IDLE'}

NEARBY RESOURCES:
- Trees (wood): ${nearbyTrees.length > 0 ? nearbyTrees.map(t => `${t.id}(${t.remaining} left, dist:${t.dist})`).join(', ') : 'none visible'}
- Rocks (stone): ${nearbyRocks.length > 0 ? nearbyRocks.map(r => `${r.id}(${r.remaining} left, dist:${r.dist})`).join(', ') : 'none visible'}
- Berry bushes: ${nearbyBerries.length > 0 ? nearbyBerries.map(b => `${b.id}(${b.remaining} left, dist:${b.dist})`).join(', ') : 'none visible'}

BUILDINGS: ${buildings.length > 0 ? buildings.map(b => `${b.type}(dist:${b.distance})`).join(', ') : 'none built yet'}

OTHER SURVIVORS: ${others.length > 0 ? others.map(o => `${o.name}(dist:${o.distance})`).join(', ') : 'alone'}

GOD WHISPER: ${state.god_whisper || "None"}
${state.god_whisper ? "IMPORTANT: You received a whisper from the god. Acknowledge and prioritize it!" : ""}

INSTRUCTIONS:
1. Response MUST be valid JSON only.
2. You MUST be within 2.5 units to HARVEST a resource.
3. Use your knowledge to prioritize health and survival.
4. If resources are needed for a building mentioned in world rules, gather them.

What is your next action? Respond with JSON only:
{"action": "ACTION_NAME", "targetId": "id" OR "target": [x,0,z], "recipeId": "RECIPE", "itemType": "item", "thought": "brief reasoning"}
`;
}
