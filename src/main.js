// Main Entry Point - Civilization Agent Game
// Integrates all game systems

import { Engine } from './core/Engine.js';
import { World } from './core/World.js';
import { UIManager } from './ui/UIManager.js';
import { SimulationController } from './core/SimulationController.js';
import { Events } from './systems/Events.js';

// ============================================================================
// GAME INITIALIZATION
// ============================================================================

// 1. Core Engine (Three.js setup)
const engine = new Engine(document.getElementById('app'));

// 2. World Model (Entities & Physical state)
const world = new World(engine.visualDirector);
world.init();

// 3. UI Manager (DOM interaction)
const ui = new UIManager();
ui.initAgentPanels(world.agents, (agent) => {
    // When an agent is selected (or deselected)
    if (agent) {
        engine.setFollowTarget(agent.group);
        ui.addLog(`Camera locked on ${agent.name}`, 'system');
    } else {
        engine.setFollowTarget(null);
        ui.addLog(`Camera unlocked`, 'system');
    }
});

// 4. Simulation Controller (Logic & Loops)
// This orchestrates the thinking cycles and entity updates
const controller = new SimulationController(engine, world, ui);

// ============================================================================
// PUB/SUB EVENT HANDLING
// ============================================================================

Events.on('log', (text, type) => ui.addLog(text, type));
Events.on('agentStatus', (agent, thought) => ui.updateAgentHUD(agent, thought));

// ============================================================================
// START
// ============================================================================

// Start the animation loop
controller.animate();

Events.emit('log', 'Vast world initialized. Resources and explorers ready.', 'system');
Events.emit('log', `Agents: ${world.agents.map(a => a.name).join(', ')}`, 'system');
Events.emit('log', 'Click "New Run" to begin the simulation.', 'system');
