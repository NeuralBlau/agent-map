import EnvironmentManager from './EnvironmentManager.js';
import VFXManager from './VFXManager.js';
import { materials } from './MaterialLibrary.js';

/**
 * VisualDirector - The "Human-in-the-Middle" between game logic and visuals.
 * Orchestrates all visual components based on the simulation state.
 */
class VisualDirector {
    constructor(engine) {
        this.engine = engine;
        this.scene = engine.scene;
        
        // Core Visual Components
        this.environment = new EnvironmentManager(this.scene);
        this.vfx = new VFXManager(this.engine);
        this.animators = new Set();
        
        console.log('[VisualDirector] Initialized');
    }

    /**
     * Update loop for visuals (animations, mood shifts)
     * @param {number} delta - Frame delta
     * @param {number} now - Current timestamp
     */
    update(delta, now) {
        // Process visual-only animations
        this.animators.forEach(animator => {
            if (animator.update) animator.update(delta, now);
        });

        // Demo: Emissive pulsing for all agents
        if (this.engine.world && this.engine.world.agents) {
            const pulse = 0.2 + Math.sin(now * 0.003) * 0.1;
            this.engine.world.agents.forEach(agent => {
                if (agent.body && agent.body.material) {
                    agent.body.material.emissiveIntensity = pulse;
                }
            });
        }
    }

    /**
     * Register an animator for an entity
     */
    registerAnimator(animator) {
        this.animators.add(animator);
    }

    /**
     * Get high-quality mesh from library
     */
    getAsset(type, config) {
        return materials.getMesh(type, config);
    }

    /**
     * Notify the director of a significant game event
     * @param {string} eventType 
     * @param {object} data 
     */
    notify(eventType, data) {
        switch (eventType) {
            case 'AGENT_HUNGER_CRITICAL':
                // Plan: Trigger visual panic (orange pulsing)
                break;
            case 'NIGHT_FALLS':
                this.environment.setMood('night');
                break;
        }
    }
}

export default VisualDirector;
