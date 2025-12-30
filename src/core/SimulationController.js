import * as THREE from 'three';
import { API, WORLD } from '../config.js';
import { Events } from '../systems/Events.js';
import { serializeAgent } from '../ai/AgentPerception.js';
import { serializeBuildings, createBuilding } from '../entities/Building.js';
import { buildTreeFromPlan, createBTContext } from '../ai/PlanExecutor.js';
import { NodeStatus } from '../ai/BehaviorTree.js';
import { 
  updateAgentMovement, 
  updateAgentStats, 
  updateAgentIdle, 
  updateAgentEating 
} from '../entities/Agent.js';
import { updateSeedAnimation, checkSeedRespawn, findSeedById } from '../entities/Seed.js';
import { applyBuildingEffects } from '../entities/Building.js';
import { findResourceById, startHarvest, findNearestResource } from '../entities/ResourceNode.js';
import { consumeItem } from '../entities/Agent.js';
import { canCraft, startCraft } from '../systems/Crafting.js';
import themeManager from '../visuals/ThemeManager.js';

/**
 * SimulationController - Manages the lifecycle of the simulation, 
 * AI thinking loops, and bridges the UI to the engine.
 */
export class SimulationController {
  constructor(engine, world, ui) {
    this.engine = engine;
    this.world = world;
    this.ui = ui;
    
    this.isSimulationRunning = false;
    this.currentWhisper = null;
    this.lastTime = Date.now();
    
    // Expose to window for UI bindings (Backward Compatibility)
    window.game = this.getPublicInterface();
    
    // Bind animate to this
    this.animate = this.animate.bind(this);
  }

  /**
   * Returns the methods and data exposed to the global window.game object.
   */
  getPublicInterface() {
    return {
      // Core Access
      engine: this.engine,
      world: this.world,
      agents: this.world.agents,
      resourceNodes: this.world.resourceNodes,
      seeds: this.world.seeds,
      buildings: this.world.buildings,

      // Operations
      startRun: () => this.startRun(),
      stopAI: () => this.stopAI(),
      whisper: () => this.whisper(),
      toggleTheme: () => this.toggleTheme(),
      
      // Rendering Control
      animate: this.animate,
      
      // Debug / Utility
      addLog: (msg, type) => Events.emit('log', msg, type),
      giveItems: (name, item, amt) => this.giveItems(name, item, amt),
      showAgent: (name) => this.showAgent(name),
      showResources: () => this.showResources(),
      testMove: () => this.testMove()
    };
  }

  async startRun() {
    this.stopAI();
    Events.emit('log', 'Restarting simulation...', 'system');

    try {
      await fetch(API.RESET_LOG_ENDPOINT, { method: 'POST' });
    } catch (e) {
      console.warn('[Simulation] Failed to reset server logs', e);
    }

    // Reset World
    this.world.reset();
    this.ui.initAgentPanels(this.world.agents);
    
    this.isSimulationRunning = true;
    
    // Resume AI
    this.world.agents.forEach((agent, i) => {
      this.startBrainLoop(agent, i * 2000);
    });

    Events.emit('log', 'New run started. Agents are awakening.', 'system');
  }

  stopAI() {
    this.isSimulationRunning = false;
    this.world.agents.forEach(agent => {
      if (agent.strategicInterval) {
        clearInterval(agent.strategicInterval);
        agent.strategicInterval = null;
      }
      agent.isThinking = false;
    });
    Events.emit('log', 'AI Simulation halted.', 'warning');
  }

  startBrainLoop(agent, initialDelay = 0) {
    setTimeout(() => {
      if (!this.isSimulationRunning) return;
      
      this.strategicLoop(agent);

      agent.strategicInterval = setInterval(() => {
        if (!agent.isDead && this.isSimulationRunning) {
          this.strategicLoop(agent);
        } else {
          clearInterval(agent.strategicInterval);
        }
      }, 30000 + Math.random() * 5000);
    }, initialDelay);
  }

  async strategicLoop(agent) {
    if (agent.isDead || !this.isSimulationRunning) return;

    // BT Lock: Don't interrupt active plans unless they've timed out
    if (agent.behaviorTree && !agent.isThinking) {
      const btDuration = Date.now() - (agent.btStartTime || 0);
      if (btDuration < 60000) return;
      
      Events.emit('log', `⚠️ ${agent.name} stuck. Forcing re-think.`, 'system');
      agent.behaviorTree = null;
    }

    agent.isThinking = true;
    Events.emit('agentStatus', agent);

    try {
      const state = serializeAgent(
        agent, 
        this.world.agents, 
        this.world.seeds, 
        this.engine.scene, 
        null, 
        this.world.resourceNodes
      );
      state.buildings = serializeBuildings(agent.group.position);

      const res = await fetch(API.STRATEGIC_ENDPOINT, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ agentName: agent.name, state })
      });

      const result = await res.json();
      const previousGoal = agent.layers.strategic.goal;

      agent.layers.strategic = {
        goal: result.goal || 'SURVIVE',
        priority: result.priority || 'MEDIUM',
        reasoning: result.reasoning || '',
        updatedAt: Date.now()
      };

      this.addAgentLog(agent, `[STRATEGIC] Goal: ${result.goal} (${result.priority})`);

      if (previousGoal !== result.goal || !agent.behaviorTree) {
        this.tacticalLoop(agent);
      }

      this.ui.updateInspectorPanel(agent);

    } catch (e) {
      console.error(`[Simulation] Strategic Error for ${agent.name}:`, e);
    } finally {
      agent.isThinking = false;
    }
  }

  async tacticalLoop(agent) {
    if (agent.isDead || !this.isSimulationRunning) return;

    try {
      const state = serializeAgent(
        agent, 
        this.world.agents, 
        this.world.seeds, 
        this.engine.scene, 
        null, 
        this.world.resourceNodes
      );
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
      agent.layers.tactical = {
        plan: result.plan || [],
        currentStep: result.currentStep || 0,
        thought: result.thought || '',
        updatedAt: Date.now()
      };

      if (result.plan && result.plan.length > 0) {
        agent.behaviorTree = buildTreeFromPlan(result.plan);
        if (agent.behaviorTree) {
          agent.btStartTime = Date.now();
          this.addAgentLog(agent, `[BT] Built tree with ${result.plan.length} steps`);
        }
      } else {
        agent.behaviorTree = null;
      }

      this.addAgentLog(agent, `[TACTICAL] Plan: ${result.plan?.length || 0} steps`);
      this.ui.updateInspectorPanel(agent);

    } catch (e) {
      console.error(`[Simulation] Tactical Error for ${agent.name}:`, e);
    }
  }

  whisper() {
    const input = document.getElementById('whisper-input');
    const msg = input?.value?.trim();
    if (msg) {
      this.currentWhisper = msg;
      Events.emit('log', `God whispers: "${msg}"`, 'system');
      input.value = '';
      setTimeout(() => {
        if (this.currentWhisper === msg) this.currentWhisper = null;
      }, API.WHISPER_TIMEOUT);
    }
  }

  toggleTheme() {
    const next = themeManager.activeTheme === 'CANDY_VALLEY' ? 'MIDNIGHT_VALLEY' : 'CANDY_VALLEY';
    themeManager.setTheme(next);
  }

  /**
   * Main Simulation Loop
   */
  animate() {
    requestAnimationFrame(this.animate);

    const now = Date.now();
    const delta = (now - this.lastTime) / 1000;
    this.lastTime = now;

    // 1. Update Agents
    this.world.agents.forEach(agent => {
      if (agent.isDead) {
        this.checkExtinction();
        return;
      }

      const reachedTarget = updateAgentMovement(agent, delta);

      // Panic Check
      if ((agent.stats.hunger < 5 || agent.stats.warmth < 5) && agent.behaviorTree && !agent.isThinking) {
        if (Math.random() < 0.1) {
          this.addAgentLog(agent, '[PANIC] Stats critical!');
          agent.behaviorTree = null;
          this.strategicLoop(agent);
        }
      }

      // BT Execution
      if (agent.behaviorTree && !agent.isThinking) {
        const btContext = createBTContext({
          scene: this.engine.scene,
          agent,
          agents: this.world.agents,
          seeds: this.world.seeds,
          resourceNodes: this.world.resourceNodes,
          addLog: (m, t) => Events.emit('log', m, t),
          addAgentLog: (a, t) => this.addAgentLog(a, t),
          findResourceById,
          findSeedById: (id) => findSeedById(id, this.engine.scene),
          startHarvest,
          canCraft,
          startCraft,
          createBuilding: (type, x, z, bId) => createBuilding(type, x, z, this.engine.visualDirector, bId),
          consumeItem,
          findNearestResource: (type) => findNearestResource(type, agent.group.position, this.world.resourceNodes),
          visualDirector: this.engine.visualDirector
        });

        const status = agent.behaviorTree.tick(agent, btContext);
        
        // Update immediate layer for UI
        const activeNode = agent.behaviorTree.getActiveNode ? agent.behaviorTree.getActiveNode() : agent.behaviorTree;
        agent.layers.immediate = {
          action: activeNode.name || 'Executing Plan',
          target: activeNode.targetId || activeNode.target || 'active',
          state: status
        };

        if (status === NodeStatus.SUCCESS) {
          this.addAgentLog(agent, '[BT] Plan completed successfully!');
          agent.behaviorTree = null;
          this.strategicLoop(agent);
        } else if (status === NodeStatus.FAILURE) {
          this.addAgentLog(agent, `[BT] Plan failed.`);
          agent.behaviorTree = null;
          this.tacticalLoop(agent);
        }
      } else if (reachedTarget && !agent.behaviorTree && !agent.isThinking) {
        this.strategicLoop(agent);
      }

      updateAgentIdle(agent, now);
      updateAgentEating(agent);
      updateAgentStats(agent, delta);
      Events.emit('agentStatus', agent);
    });

    // 2. World Updates
    applyBuildingEffects(this.world.agents, delta);
    this.world.seeds.forEach(seed => updateSeedAnimation(seed, now));
    checkSeedRespawn(this.engine.visualDirector, (m, t) => Events.emit('log', m, t));

    // 3. Render
    this.engine.render();
  }

  checkExtinction() {
    if (!this.isSimulationRunning) return;
    const allDead = this.world.agents.every(a => a.isDead);
    if (allDead) {
      Events.emit('log', `⚠️ EXTINCTION EVENT. Resetting world in 5s...`, 'system');
      this.isSimulationRunning = false;
      setTimeout(() => this.startRun(), 5000);
    }
  }

  addAgentLog(agent, text) {
    if (!agent.logHistory) agent.logHistory = [];
    const time = new Date().toLocaleTimeString();
    agent.logHistory.unshift({ time, text });
    if (agent.isSelected) {
      this.ui.updateInspectorPanel(agent);
    }
  }
}
