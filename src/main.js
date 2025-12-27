// Main Entry Point
// Orchestrates all modules and initializes the game

import * as THREE from 'three';
import { AGENT, COLORS } from './config.js';
import { scene, camera, renderer, controls, mountRenderer, setupResizeHandler } from './scene.js';
import { createAgent, updateAgentMovement, updateAgentIdle, updateAgentHunger, updateAgentEating } from './entities/Agent.js';
import { seeds, createSeed, updateSeedAnimation, checkSeedRespawn } from './entities/Seed.js';
import { createBrainLoopForAgent } from './ai/brainLoop.js';
import { moveAgent } from './ai/actions.js';
import { addLog, getCurrentWhisper, setupWhisper } from './ui.js';

// Initialize renderer
mountRenderer();
setupResizeHandler();

// Create agents
const agents = [];
agents.push(createAgent('Pioneer', COLORS.AGENT_PIONEER, new THREE.Vector3(2, 0, 2), scene));
agents.push(createAgent('Settler', COLORS.AGENT_SETTLER, new THREE.Vector3(-2, 0, -2), scene));

// Create initial seeds
createSeed('seed_01', 8, 8, scene);
createSeed('seed_02', -10, 5, scene);
createSeed('seed_03', 4, -12, scene);
createSeed('seed_04', -5, -5, scene);

// Track hunger decay timing
let lastHungerUpdate = 0;

// Animation loop
function animate() {
  requestAnimationFrame(animate);
  const now = Date.now();

  // Update agents
  agents.forEach(agent => {
    // Create brain loop for this agent
    const brainLoop = createBrainLoopForAgent(agents, seeds, scene, getCurrentWhisper, addLog);

    // Movement with stuck detection
    const shouldThink = updateAgentMovement(agent);
    if (shouldThink) {
      setTimeout(() => brainLoop(agent), 500);
    }

    // Idle animation
    updateAgentIdle(agent, now);

    // Hunger decay (every ~3 seconds)
    if (now - lastHungerUpdate > AGENT.HUNGER_DECAY_INTERVAL) {
      updateAgentHunger(agent);
    }

    // Eating animation
    updateAgentEating(agent);
  });

  // Update hunger timing
  if (now - lastHungerUpdate > AGENT.HUNGER_DECAY_INTERVAL) {
    lastHungerUpdate = now;
  }

  // Update seeds
  seeds.forEach(seed => {
    if (seed.parent === scene) {
      updateSeedAnimation(seed, now);
    }
  });

  // Seed respawn
  checkSeedRespawn(scene, addLog);

  // Render
  controls.update();
  renderer.render(scene, camera);
}

// Global game interface
window.game = {
  addLog,
  scene,
  agents,
  seeds,

  testMove: () => {
    addLog('Manual movement test initiated.', 'system');
    agents.forEach(a => {
      const target = new THREE.Vector3(
        (Math.random() - 0.5) * 20,
        0,
        (Math.random() - 0.5) * 20
      );
      moveAgent(a, target);
    });
  },

  startAI: () => {
    addLog('Universal Intelligence activated. Survival protocols online.', 'system');
    agents.forEach(agent => {
      const brainLoop = createBrainLoopForAgent(agents, seeds, scene, getCurrentWhisper, addLog);
      brainLoop(agent);
      setInterval(() => {
        if (agent.state === 'IDLE') brainLoop(agent);
      }, AGENT.DECISION_INTERVAL);
    });
  },

  whisper: setupWhisper()
};

// Start
animate();
addLog('Vast world initialized. Multiple explorers standing by.', 'system');
addLog('Click "Start AI" to begin.', 'system');
