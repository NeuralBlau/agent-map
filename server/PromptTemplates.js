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
            if (val >= 6) return "High";
            if (val >= 3) return "Medium";
            return "Low";
        }
        if (val >= 15) return "Very High";
        if (val >= 10) return "High";
        if (val >= 5) return "Medium";        
        return "Low";
    };

    // Dynamic Goals based on Resources
    // Only show CRAFT options if resources are available (approximate check for prompt clarity)
    // We strictly follow the prompt structure provided by the user.

    const promptText = `
You are an expert thinking model which can come up with optimal plans controll an agent in a video game and your task is to make plans to survive and build a shelter.

For this you have to ALWAYS think in three steps: 1) Analyse the situation and and evaluate which Goal to focus on 2) Analyse the context to find out what is needed to achieve the goal and 3) Critically evaluate your inventory and the available campfires on the map and find out if you have to requiered components or if you have to get them first

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
YOU DON'T NEED TO CRAFT A CAMPFIRE WHEN THERE IS ALREADY ONE ON THE MAP YOU CAN STAND NEXT TO IT RIGHT AWAY.

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




