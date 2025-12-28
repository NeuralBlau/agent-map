// Main Entry Point - Civilization Agent Game
// Integrates all game systems

import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls';

// Import configuration (relative to src/)
import { WORLD, COLORS, API } from './config.js';
import { getRandomName, resetUsedNames } from './agent_names.js';

// Import entity systems
import {
  createAgent,
  updateAgentMovement,
  updateAgentStats,
  updateAgentIdle,
  updateAgentEating
} from './entities/Agent.js';
import { serializeAgent } from './ai/AgentPerception.js';
import { createSeed, seeds, updateSeedAnimation, checkSeedRespawn, findSeedById } from './entities/Seed.js';
import { spawnWorldResources, resourceNodes, getResourceNodes, findNearestResource } from './entities/ResourceNode.js';
import { buildings, applyBuildingEffects, serializeBuildings, createBuilding } from './entities/Building.js';

// Import AI systems
import { executeAction, getAvailableActions } from './ai/actions.js';
import { getAllRecipes, serializeRecipes, canCraft, startCraft } from './systems/Crafting.js';
import { findResourceById, startHarvest } from './entities/ResourceNode.js';
import { consumeItem } from './entities/Agent.js';

// Import Behavior Tree system
import { NodeStatus } from './ai/BehaviorTree.js';
import { buildTreeFromPlan, createBTContext } from './ai/PlanExecutor.js';

// Import UI systems
import {
  createThoughtBubble,
  updateThoughtBubble
} from './ui/ThoughtBubble.js';

// Import core systems
import { Engine } from './core/Engine.js';
import { World } from './core/World.js';
import { UIManager } from './ui/UIManager.js';
import { Events } from './systems/Events.js';

// ============================================================================
// GAME INITIALIZATION
// ============================================================================

const engine = new Engine(document.getElementById('app'));
const scene = engine.scene;
const camera = engine.camera;

const world = new World(scene);
world.init();

const ui = new UIManager();
ui.initAgentPanels(world.agents);

const agents = world.agents;
let isSimulationRunning = false;
let currentWhisper = null;

// Bridge legacy addLog calls to the new event system
const addLog = (msg, type) => Events.emit('log', msg, type);

// ============================================================================
// PUB/SUB EVENT HANDLING
// ============================================================================

Events.on('log', (text, type) => ui.addLog(text, type));
Events.on('agentStatus', (agent, thought) => ui.updateAgentHUD(agent, thought));

// Helper to bridge agent specific logs to main UI
function addAgentLog(agent, text) {
  if (!agent.logHistory) agent.logHistory = [];
  const time = new Date().toLocaleTimeString();
  agent.logHistory.unshift({ time, text });
  if (agent.isSelected) {
    ui.updateInspectorPanel(agent);
  }
}


// ============================================================================
// AI BRAIN LOOP - Multi-Layer System
// ============================================================================

// STRATEGIC LAYER - Long-term goal planning (every 30 seconds)
async function strategicLoop(agent) {
  if (agent.isDead) {
    if (agent.strategicInterval) clearInterval(agent.strategicInterval);
    return;
  }

  // EXECUTION LOCK: If the agent has an active plan (Behavior Tree), DO NOT INTERRUPT.
  // This prevents "Execution Paralysis" where the agent re-thinks before acting.
  if (agent.behaviorTree && !agent.isThinking) {
    return;
  }

  // EXECUTION LOCK (Refined):
  // If the agent has an active plan (Behavior Tree), DO NOT INTERRUPT unless they are stuck.
  if (agent.behaviorTree && !agent.isThinking) {
    const btDuration = Date.now() - (agent.btStartTime || 0);
    // If plan is running for less than 60 seconds, let them cook.
    if (btDuration < 60000) {
      // console.log(`[Strategic] Skipping thinking for ${agent.name} (Busy executing plan for ${Math.round(btDuration/1000)}s)`);
      return; 
    } else {
      Events.emit('log', `⚠️ Execution Timeout: ${agent.name} stuck for >60s. Forcing re-think.`, 'system');
      agent.behaviorTree = null; // Force clear to allow re-think
    }
  }

  // v3.3 Logic Cooldown: Prevent redundant strategic calls
  const stateSnapshot = getStateSnapshot(agent);
  if (agent.lastStrategicSnapshot === stateSnapshot && Date.now() - agent.layers.strategic.updatedAt < 10000) {
    // console.log(`[Strategic] Skipping redundant call for ${agent.name} (state unchanged)`);
    if (!agent.behaviorTree && !agent.isThinking) {
      tacticalLoop(agent); // Ensure we at least have a tactical plan for existing goal
    }
    return;
  }
  agent.lastStrategicSnapshot = stateSnapshot;

  agent.isThinking = true;
  Events.emit('agentStatus', agent); // Show "..."

  try {
    const state = serializeAgent(agent, agents, seeds, scene, null, resourceNodes);
    state.buildings = serializeBuildings(agent.group.position);

    const res = await fetch(API.STRATEGIC_ENDPOINT, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ agentName: agent.name, state })
    });

    const result = await res.json();
    const previousGoal = agent.layers.strategic.goal;

    // Update strategic layer
    agent.layers.strategic = {
      goal: result.goal || 'SURVIVE',
      priority: result.priority || 'MEDIUM',
      reasoning: result.reasoning || '',
      updatedAt: Date.now()
    };

    // Add to agent log
    addAgentLog(agent, `[STRATEGIC] Goal: ${result.goal} (${result.priority})`);

    // If goal changed OR we have no active plan (Idle Bug Fix), trigger tactical update
    if (previousGoal !== result.goal || !agent.behaviorTree) {
      tacticalLoop(agent);
    }

    // Update inspector if selected
    ui.updateInspectorPanel(agent);

  } catch (e) {
    console.error(`[Strategic] Error for ${agent.name}:`, e);
  } finally {
    agent.isThinking = false;
  }
}

// TACTICAL LAYER - Mid-term planning (when goal changes)
async function tacticalLoop(agent) {
  if (agent.isDead) return;

  // v3.3 Logic Cooldown: Prevent redundant tactical calls
  const stateSnapshot = getStateSnapshot(agent) + agent.layers.strategic.goal;
  if (agent.lastTacticalSnapshot === stateSnapshot && Date.now() - agent.layers.tactical.updatedAt < 5000) {
    // console.log(`[Tactical] Skipping redundant call for ${agent.name} (state unchanged)`);
    return;
  }
  agent.lastTacticalSnapshot = stateSnapshot;

  // v3.2 Throttling: Prevent request storms
  const now = Date.now();
  if (now - agent.lastTacticalRequestTime < 2000) {
    // console.log(`[Tactical] Throttling request for ${agent.name} (too soon)`);
    return;
  }
  agent.lastTacticalRequestTime = now;

  try {
    const state = serializeAgent(agent, agents, seeds, scene, null, resourceNodes);
    state.buildings = serializeBuildings(agent.group.position);

    const res = await fetch(API.TACTICAL_ENDPOINT, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        agentName: agent.name,
        state,
        strategicGoal: agent.layers.strategic
      })
    });

    const result = await res.json();

    // Update tactical layer
    agent.layers.tactical = {
      plan: result.plan || [],
      currentStep: result.currentStep || 0,
      thought: result.thought || '',
      updatedAt: Date.now()
    };

    // Build behavior tree from plan
    if (result.plan && result.plan.length > 0) {
      agent.behaviorTree = buildTreeFromPlan(result.plan);
      if (agent.behaviorTree) {
        agent.btStartTime = Date.now(); // Track when this plan started
        addAgentLog(agent, `[BT] Built tree with ${result.plan.length} steps`);
      }
    } else {
      agent.behaviorTree = null;
    }

    // Add to agent log
    addAgentLog(agent, `[TACTICAL] Plan: ${result.plan?.length || 0} steps - ${result.thought?.substring(0, 40)}...`);

    // Update inspector if selected
    ui.updateInspectorPanel(agent);

  } catch (e) {
    console.error(`[Tactical] Error for ${agent.name}:`, e);
  }
}


// IMMEDIATE LAYER - Action execution (original brainLoop)
async function brainLoop(agent) {
  if (agent.state === 'THINKING' || agent.isThinking || agent.isDead) return;

  agent.state = 'THINKING';
  agent.isThinking = true;

  try {
    // Serialize world state for LLM
    const state = serializeAgent(agent, agents, seeds, scene, currentWhisper, resourceNodes);

    // Add buildings to state
    state.buildings = serializeBuildings(agent.group.position);

    // Add available actions and recipes
    state.availableActions = getAvailableActions();
    state.recipes = getAllRecipes();

    const res = await fetch(API.LLM_ENDPOINT, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ state, agentName: agent.name })
    });

    const decision = await res.json();

    // Update immediate layer
    agent.layers.immediate = {
      action: decision.action || 'IDLE',
      target: decision.targetId || decision.target || null,
      state: agent.state
    };

    // Add to agent log history
    addAgentLog(agent, `[IMMEDIATE] ${decision.action}: ${decision.thought?.substring(0, 50) || 'No thought'}`);

    // Update HUD panel and 3D thought bubble with the thought
    if (decision.thought) {
      Events.emit('agentStatus', agent, decision.thought);
    }

    // Update inspector if selected
    ui.updateInspectorPanel(agent);

    // Clear whisper after it's been processed
    if (currentWhisper && state.god_whisper) {
      currentWhisper = null;
    }

    // Execute the decided action
    const context = {
      scene,
      addLog: (msg, type) => Events.emit('log', msg, type),
      brainLoop,
      resourceNodes
    };

    executeAction(agent, decision, context);

  } catch (e) {
    console.error(`[BrainLoop] Error for ${agent.name}:`, e);
    agent.state = 'IDLE';
    // Retry after delay
    setTimeout(() => brainLoop(agent), 3000);
  } finally {
    agent.isThinking = false;
  }
}

// Helper to get a stable string representing agent's meaningful state
function getStateSnapshot(agent) {
  const stats = `${Math.round(agent.stats.hunger / 10)},${Math.round(agent.stats.warmth / 10)}`;
  const inv = Object.entries(agent.inventory || {}).map(([k, v]) => `${k}:${v}`).sort().join(',');
  const nearby = serializeBuildings(agent.group.position).length;
  return `${stats}|${inv}|${nearby}`;
}

// ============================================================================
// ANIMATION LOOP
// ============================================================================


let lastTime = Date.now();

function animate() {
  requestAnimationFrame(animate);

  const now = Date.now();
  const delta = (now - lastTime) / 1000; // Convert to seconds
  lastTime = now;

  // Update agents
  agents.forEach(agent => {
    if (agent.isDead) {
      if (!agent.isRespawning && isSimulationRunning) {
        // Auto-Reset Check: If ALL agents are dead, restart the run
        const allDead = agents.every(a => a.isDead);
        if (allDead) {
          Events.emit('log', `⚠️ EXTINCTION EVENT DETECTED. Resetting world in 5 seconds...`, 'system');
          isSimulationRunning = false; // Prevent multiple triggers
          setTimeout(() => {
            window.game.startRun();
          }, 5000);
        }
      }
      return;
    }

    // Movement
    const reachedTarget = updateAgentMovement(agent, delta);

    // Panic Interrupt - if stats are critical, abandon current plan
    // Panic Interrupt - Only if stats are CRITICALLY low (immediate death imminent)
    const isPanic = agent.stats.hunger < 5 || agent.stats.warmth < 5;
    if (isPanic && agent.behaviorTree && !agent.isThinking) {
      // Only panic if we aren't already frantically trying to survive
      // (This is a rough heuristic, but better than wiping the plan every frame)
      if (Math.random() < 0.1) { // Throttle the panic log/action
          addAgentLog(agent, '[PANIC] DO OR DIE! Stats critical!');
          agent.behaviorTree = null;
          strategicLoop(agent); 
      }
    }

    // Behavior Tree execution (if agent has a tree from tactical plan)
    if (agent.behaviorTree && !agent.isThinking) {
      const btContext = createBTContext({
        scene,
        addLog: (msg, type) => Events.emit('log', msg, type),
        resourceNodes,
        seeds,
        findResourceById,
        findSeedById: (id) => findSeedById(id, scene),
        startHarvest,
        canCraft,
        startCraft,
        createBuilding,
        consumeItem,
        findNearestResource: (type) => findNearestResource(type, agent.group.position, resourceNodes)
      });


      const status = agent.behaviorTree.tick(agent, btContext);

      // Update immediate layer from BT for the Inspector UI
      const activeNode = agent.behaviorTree.getActiveNode ? agent.behaviorTree.getActiveNode() : agent.behaviorTree;

      agent.layers.immediate = {
        action: activeNode.name || 'Executing Plan',
        target: activeNode.targetId || activeNode.target || 'active',
        state: status
      };

      // Update the thought bubble/panel with the current BT action
      if (agent.layers.immediate.action !== agent.lastBTAction) {
        Events.emit('agentStatus', agent, `Executing: ${agent.layers.immediate.action}`);
        agent.lastBTAction = agent.layers.immediate.action;
      }

      // If tree completed, clear it and request new tactical plan
      if (status === NodeStatus.SUCCESS) {
        addAgentLog(agent, '[BT] Plan completed successfully!');
        agent.behaviorTree = null;
        agent.lastFailure = null; // Clear failure memory
        strategicLoop(agent); // Get new strategic goal
      } else if (status === NodeStatus.FAILURE) {
        const reason = activeNode.name || 'Unknown failure';
        addAgentLog(agent, `[BT] Plan failed at: ${reason}`);
        agent.lastFailure = {
          step: reason,
          time: new Date().toLocaleTimeString(),
          goal: agent.layers.strategic.goal
        };
        agent.behaviorTree = null;
        tacticalLoop(agent); // Try new tactical plan
      }

      if (ui && ui.updateInspectorPanel) {
        ui.updateInspectorPanel(agent);
      }
    } else if (reachedTarget && !agent.behaviorTree && !agent.isThinking) {
      // Fallback: If no BT and idle, request a strategic re-evaluation
      strategicLoop(agent);
    }

    // Idle animations
    updateAgentIdle(agent, now);

    // Eating animation
    updateAgentEating(agent);

    // Stats decay (every frame for smooth display)
    updateAgentStats(agent, delta);

    // Update HUD panel stats (without thought - just stats)
    Events.emit('agentStatus', agent);
  });

  // Apply building effects (warmth from campfires/shelters)
  applyBuildingEffects(agents, delta);

  // Seed animations
  seeds.forEach(seed => updateSeedAnimation(seed, now));

  // Seed respawn check
  checkSeedRespawn(scene, addLog);

  // Render
  engine.render();
}

/**
 * Continuous Simulation: Respawn dead agents
 */
// Deprecated: respawnAgent (replaced by full world reset)
// function respawnAgent(deadAgent) { ... }

/**
 * Starts the multi-layer brain loop for an agent
 */
function startBrainLoop(agent, initialDelay = 0) {
  setTimeout(() => {
    // Initial call
    strategicLoop(agent);

    // Continuous updates
    agent.strategicInterval = setInterval(() => {
      if (!agent.isDead) {
        strategicLoop(agent);
      } else {
        clearInterval(agent.strategicInterval);
      }
    }, 30000 + Math.random() * 5000);
  }, initialDelay);
}


// ============================================================================
// GAME API (accessible from console)
// ============================================================================

window.game = {
  // Logging
  addLog,

  // Scene access
  engine,
  world,
  scene,
  agents,
  seeds,
  resourceNodes,
  buildings,

  // Manual testing
  testMove: () => {
    addLog('Manual movement test initiated.', 'system');
    agents.forEach(a => {
      const target = new THREE.Vector3(
        (Math.random() - 0.5) * 20,
        0,
        (Math.random() - 0.5) * 20
      );
      a.targetPos.copy(target);
      a.state = 'MOVING';
    });
  },

  // Start AI
  // Start New Run (Reset World)
  startRun: async () => {
    // 1. Stop existing
    window.game.stopAI();

    // 2. Reset Log
    try {
      await fetch(API.RESET_LOG_ENDPOINT, { method: 'POST' });
      addLog('=== NEW RUN STARTED ===', 'system');
    } catch (e) {
      console.error('Failed to reset log:', e);
    }

    // 3. Reset World Entities
    // Remove old agents from scene
    [...agents].forEach(a => {
      scene.remove(a.group);
      world.removeAgent(a);
    });

    // Remove old resources/buildings (optional, but cleaner for a "fresh run")
    // For now, we'll keep the world map static but reset agents
    // If you want a full map re-gen, we'd need to clear resourceNodes/buildings arrays too

    // 4. Spawn Fresh Agents
    resetUsedNames();
    const p1 = createAgent(getRandomName(), COLORS.AGENT_PIONEER, new THREE.Vector3(2, 0, 2), scene);
    const p2 = createAgent(getRandomName(), COLORS.AGENT_SETTLER, new THREE.Vector3(-2, 0, -2), scene);
    world.addAgent(p1);
    world.addAgent(p2);

    // 5. Update UI
    ui.initAgentPanels(agents);

    // 6. Start Loops
    isSimulationRunning = true;
    agents.forEach((agent, i) => {
      startBrainLoop(agent, i * 1000);
    });
  },

  // Stop AI
  stopAI: () => {
    isSimulationRunning = false;
    agents.forEach(a => {
      if (a.strategicInterval) clearInterval(a.strategicInterval);
      a.isThinking = false;
      a.state = 'IDLE';
    });
    addLog('Simulation stopped by user.', 'system');
  },

  // Agent selection
  selectAgent: (name) => {
    const agent = agents.find(a => a.name.toLowerCase() === name.toLowerCase());
    if (agent) ui.selectAgent(agent);
  },

  deselectAgent: () => {
    if (ui.selectedAgent) {
      ui.selectedAgent.isSelected = false;
      ui.selectedAgent = null;
    }
    ui.hideInspectorPanel();
  },


  // God whisper
  whisper: () => {
    const input = document.getElementById('whisper-input');
    const msg = input?.value?.trim();
    if (msg) {
      currentWhisper = msg;
      addLog(`God whispers: "${msg}"`, 'system');
      input.value = '';
      // Clear whisper after timeout
      setTimeout(() => {
        if (currentWhisper === msg) currentWhisper = null;
      }, API.WHISPER_TIMEOUT);
    }
  },

  // Debug: Give items to agent
  giveItems: (agentName, item, amount = 10) => {
    const agent = agents.find(a => a.name.toLowerCase() === agentName.toLowerCase());
    if (agent) {
      agent.inventory[item] = (agent.inventory[item] || 0) + amount;
      addLog(`DEBUG: Gave ${amount} ${item} to ${agent.name}`, 'system');
    } else {
      addLog(`Agent ${agentName} not found`, 'system');
    }
  },

  // Debug: Show agent state
  showAgent: (agentName) => {
    const agent = agents.find(a => a.name.toLowerCase() === agentName.toLowerCase());
    if (agent) {
      console.log('Agent:', agent.name);
      console.log('Stats:', agent.stats);
      console.log('Inventory:', agent.inventory);
      console.log('State:', agent.state);
      console.log('Position:', agent.group.position);
    }
  },

  // Debug: List all resources
  showResources: () => {
    console.log('Resource Nodes:', resourceNodes.map(r => ({
      id: r.id,
      type: r.type,
      remaining: r.remaining,
      depleted: r.isDepleted
    })));
  }
};

// ============================================================================
// START
// ============================================================================

// Initialize
animate();
Events.emit('log', 'Vast world initialized. Resources and explorers ready.', 'system');
Events.emit('log', `Agents: ${agents.map(a => a.name).join(', ')}`, 'system');
Events.emit('log', 'Click "Start AI" to begin.', 'system');
