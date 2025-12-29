/**
 * PromptTemplates.js - Centralized storage for LLM prompt templates
 */

export function getStrategicPrompt(agentName, state, worldRules) {
    const agent = state.agent;
    const stats = agent.stats || {};
    const inventory = agent.inventory || {};
    const buildings = state.buildings || [];
    const nearbyCampfires = buildings.filter(b => b.type === 'CAMPFIRE');
    
    // Qualitative Stats Helper
    const describe = (val) => {
        if (val > 80) return `safe (${val})`;
        if (val > 40) return `WARN (${val})`;
        if (val > 15) return `CRITICAL (<40)`;
        return `DYING (<15)`;
    };

    const isCritical = stats.hunger < 15 || stats.warmth < 15 || stats.health < 40;

    return `
YOU ARE THE STRATEGIC MIND OF ${agentName}.
Your goal is LONG-TERM PRESERVATION.

WORLD RULES & KNOWLEDGE:
${worldRules}

---
CURRENT STATE:
- Stats: Hunger: ${describe(stats.hunger)}, Warmth: ${describe(stats.warmth)}, Health: ${describe(stats.health)}
- Inventory: ${JSON.stringify(inventory)}
- Nearby Campfires: ${nearbyCampfires.length} built nearby.
- Last Failure: ${JSON.stringify(agent.lastFailure || "None")}

FEASIBILITY CALCULATIONS (Pre-calculated):
${JSON.stringify(state.perception?.buildingReadiness || "Unknown", null, 2)}

YOUR TASK:
Define the next mid-term Strategic Goal.

GOAL PRIORITY RULES:
1. **SURVIVAL IS PARAMOUNT**. If any stat is DYING or CRITICAL, you MUST prioritize fixing that stat (EAT or WARMTH) immediately. Ignore building if you are dying.
2. **DO NOT LIE**. Trust the FEASIBILITY CALCULATIONS above. If it says "NO", you cannot build. Gather resources instead.
3. If "CAN_BUILD_X" says "YES", you SHOULD goal to "BUILD_X".
4. If "CAN_BUILD_X" says "NO" (Missing materials), you MUST goal to GATHER the missing materials.

Goals should be one of:
- SURVIVE (Generic/Critical State)
- BUILD_SHELTER (Needs 50 wood, 10 stone)
- BUILD_CAMPFIRE (Needs 10 wood)
- GATHER_FOOD (If hunger is low)
- GATHER_WOOD (Prerequisite for building)
- GATHER_STONE (Prerequisite for building)
- EXPLORE (If resources are far/unknown)

Respond in VALID JSON ONLY:
{
  "goal": "GOAL_NAME",
  "priority": "LOW/MEDIUM/HIGH/URGENT",
  "reasoning": "Brief explanation. IF DYING, state clearly: 'I am dying, must eat/warm up'.",
  "updateNotepad": "DEPRECATED - LEAVE EMPTY" 
}
`;
}

export function getTacticalPrompt(agentName, state, worldRules, strategicGoal) {
    const agent = state.agent;
    const stats = agent.stats || {};
    const inventory = agent.inventory || {};
    const failureMemory = agent.lastFailure ? `\nLAST PLAN FAILED AT: ${agent.lastFailure.step} because of the environment. AVOID DOING THE SAME THING.` : "";

    return `
YOU ARE THE TACTICAL MIND OF ${agentName}.
Your job is to break down a STRATEGIC GOAL into a list of executable steps for the Behavior Tree.

STRATEGIC GOAL: ${strategicGoal.goal} (${strategicGoal.priority})
REASONING: ${strategicGoal.reasoning}

WORLD RULES & KNOWLEDGE:
${worldRules}

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
    const seeds = state.seeds || state.objects || [];
    const others = state.others || [];
    const position = agent.position || [0, 0, 0];

    const nearbyTrees = resources.filter(r => r.type === 'tree').slice(0, 3);
    const nearbyRocks = resources.filter(r => r.type === 'rock').slice(0, 3);
    const nearbyBerries = resources.filter(r => r.type === 'berry').slice(0, 3);

    return `
You are ${agentName}, a survivor on a stranded island.

WORLD RULES & KNOWLEDGE:
${worldRules}

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

SEEDS: ${seeds.length > 0 ? seeds.map(s => `${s.id}(dist:${s.dist})`).join(', ') : 'none visible'}

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
