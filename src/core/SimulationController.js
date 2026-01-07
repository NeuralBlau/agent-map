import * as THREE from 'three';
import { API, WORLD } from '../config.js';
import { Events } from '../systems/Events.js';
import { serializeAgent } from '../ai/AgentPerception.js';
import { serializeBuildings, createBuilding } from '../entities/Building.js';
import { buildTreeFromPlan, createBTContext } from '../ai/PlanExecutor.js';
import { TacticalPlanner } from '../ai/TacticalPlanner.js';
import { NodeStatus } from '../ai/BehaviorTree.js';
import { updateAgentMovement, 
  updateAgentStats, 
  updateAgentIdle, 
  updateAgentEating 
} from '../entities/Agent.js';
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

    // Clear 2D Overlays (Ghosts)
    const cssContainer = document.getElementById('css2d-container');
    if (cssContainer) cssContainer.innerHTML = '';

    // Reset World
    this.world.reset();
    this.ui.initAgentPanels(this.world.agents);
    
    this.isSimulationRunning = true;
    
    // Resume AI
    this.world.agents.forEach((agent, i) => {
      this.startBrainLoop(agent, i * 2000);
    });

    Events.emit('log', 'New run started.', 'system');
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
    if (!agent.goalBuffer) agent.goalBuffer = [];
    
    // Initial Think
    setTimeout(() => {
        if (!this.isSimulationRunning) return;
        this.strategicLoop(agent);
    }, initialDelay);

    // PRODUCER LOOP: Fixed 10s Interval
    agent.strategicInterval = setInterval(() => {
        if (!agent.isDead && this.isSimulationRunning) {
            this.strategicLoop(agent);
        } else {
            clearInterval(agent.strategicInterval);
        }
    }, 10000); // FIXED 10s Interval
  }

  async strategicLoop(agent) {
    if (agent.isDead || !this.isSimulationRunning || agent.isThinking) return;

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
      // Serializer... (We still need state for context, though less critical now)
      const buildings = serializeBuildings(agent.group.position);
      const state = serializeAgent(agent, this.world.agents, this.engine.scene, this.currentWhisper, this.world.resourceNodes, buildings);

      const res = await fetch(API.STRATEGIC_ENDPOINT, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ agentName: agent.name, state })
      });

      const result = await res.json();
      
      const newGoal = {
        goal: result.goal || 'SURVIVE',
        priority: result.priority || 'MEDIUM',
        reasoning: result.reasoning || '',
        updatedAt: Date.now()
      };

      // BUFFER LOGIC
      if (!agent.goalBuffer) agent.goalBuffer = [];

      // 1. Deduplication REPLACED by user request: ALLOW DUPLICATES
      // "Remove the logic that makes the agent the straegic goal from the straetgic mind if it was the same two times in a row."
      // So we just pass through.
      
      // 2. Push
      agent.goalBuffer.push(newGoal);
      this.addAgentLog(agent, `[Buffer] Added: ${newGoal.goal}. Size: ${agent.goalBuffer.length}`);

      // 3. Overflow Reset
      if (agent.goalBuffer.length > 5) {
          agent.goalBuffer = [newGoal]; // Hard Reset
          this.addAgentLog(agent, `[Buffer] Overflow! Resetting queue.`);
      }

      this.ui.updateInspectorPanel(agent);

    } catch (e) {
      console.error(`[Simulation] Strategic Error for ${agent.name}:`, e);
    } finally {
      agent.isThinking = false;
    }
  }

  async tacticalLoop(agent, force = false) {
    if (agent.isDead || !this.isSimulationRunning) return;
    
    // We don't need 'isThinking' lock for local planner really, but good for consistent state
    // agent.isThinking = true; 

    try {
      const strategicGoal = agent.layers.strategic;
      
      // LOCAL PLANNER CALL
      const result = TacticalPlanner.generatePlan(
          agent, 
          strategicGoal, 
          this.world.resourceNodes,
          this.world.buildings // Pass buildings for duplicate checks
      );

      agent.layers.tactical = {
        plan: result.plan || [],
        currentStep: 0,
        thought: result.thought || '',
        updatedAt: Date.now()
      };
      
      // Visualize Thought
      agent.thought = result.thought;
      Events.emit('agentStatus', agent); // Trigger bubble update

      if (result.plan && result.plan.length > 0) {
        agent.behaviorTree = buildTreeFromPlan(result.plan);
        if (agent.behaviorTree) {
          agent.btStartTime = Date.now();
          this.addAgentLog(agent, `[Tactical] Plan: ${result.plan.join(', ')}`);
        }
      } else {
        agent.behaviorTree = null;
        // If plan is null (e.g. missing materials), we should probably fail/wait
        // The thought bubble "❌" is handled inside Planner usually, or here if we want override
      }

      this.ui.updateInspectorPanel(agent);

    } finally {
      agent.isThinking = false;
    }
  }

  whisper() {
    const input = document.getElementById('whisper-input');
    const msg = input?.value?.trim();
    if (msg) {
      this.currentWhisper = msg;
      Events.emit('log', `God whispers: "${msg}"`, 'system');
      input.value = '';
      
      // Immediate reaction
      this.world.agents.forEach(agent => {
        if (!agent.isDead && !agent.isThinking) {
          this.strategicLoop(agent);
        }
      });

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

      // Panic Check - REMOVED per user request
      // (The system is now robust enough to recover without forced interrupts)

      // BT Execution
      if (agent.behaviorTree && !agent.isThinking) {
        const btContext = createBTContext({
          scene: this.engine.scene,
          agent,
          agents: this.world.agents,
          resourceNodes: this.world.resourceNodes,
          addLog: (m, t) => Events.emit('log', m, t),
          addAgentLog: (a, t) => this.addAgentLog(a, t),
          findResourceById,
          startHarvest,
          canCraft,
          startCraft,
          createBuilding: (type, x, z, bId) => createBuilding(type, x, z, this.engine.visualDirector, bId),
          consumeItem,
          findNearestResource: (type) => findNearestResource(type, agent.group.position, this.world.resourceNodes),
          visualDirector: this.engine.visualDirector,
          buildings: this.world.buildings // New: Pass buildings array
        });

        const status = agent.behaviorTree.tick(agent, btContext);
        
        // Update immediate layer for UI
        const activeNode = agent.behaviorTree.getActiveNode ? agent.behaviorTree.getActiveNode() : agent.behaviorTree;
        
        // InternalWait is purely functional, don't show it to user
        if (activeNode.name !== 'InternalWait') {
            agent.layers.immediate = {
            action: activeNode.name || 'Executing Plan',
            target: activeNode.targetId || activeNode.target || 'active',
            state: status
            };
        }

        if (status === NodeStatus.SUCCESS) {
          this.addAgentLog(agent, '[BT] Plan completed successfully!');
          agent.behaviorTree = null;
          
          // AGGRESSIVE TRIGGER: If buffer is empty, don't wait for 10s loop!
          if (!agent.goalBuffer || agent.goalBuffer.length === 0) {
              this.strategicLoop(agent);
          }

        } else if (status === NodeStatus.FAILURE) {
          agent.thought = "❌"; // Visual feedback
          this.addAgentLog(agent, `[BT] Plan failed: ${agent.lastError || ''}`);
          agent.behaviorTree = null;
          
          // AGGRESSIVE RETRY: If plan failed, we likely need a new strategy immediately.
          // Don't just wait 10s or pull from buffer (which might be the same bad plan).
          // Let's clear buffer and rethink? Or just rethink if empty?
          // User asked if it triggers rethink. Let's make it trigger rethink.
          if (!agent.goalBuffer || agent.goalBuffer.length === 0) {
               this.strategicLoop(agent);
          }
        }
      } 
      
      // Buffer Consumption (Consumer)
      if (!agent.behaviorTree && !agent.isThinking) {
          // Check Buffer
          if (agent.goalBuffer && agent.goalBuffer.length > 0) {
              const nextGoal = agent.goalBuffer.shift();
              agent.layers.strategic = nextGoal;
              this.addAgentLog(agent, `[Buffer] Popped goal: ${nextGoal.goal}. Remaining: ${agent.goalBuffer.length}`);
              this.tacticalLoop(agent); // Use local planner
          }
      }

      updateAgentIdle(agent, now);
      updateAgentEating(agent);
      updateAgentStats(agent, delta);
      Events.emit('agentStatus', agent);
    });

    // 2. World Updates
    applyBuildingEffects(this.world.agents, delta);
    
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
