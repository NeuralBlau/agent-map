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
        // Update Environment (Wind, Light Anim)
        this.environment.update(delta, now);

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
            case 'AGENT_ACTION_START':
                this.triggerInteractionEffect(data.target, data.actionType);
                break;
            case 'AGENT_HUNGER_CRITICAL':
                break;
            case 'NIGHT_FALLS':
                this.environment.setMood('night');
                break;
        }
    }

    /**
     * Triggers a visual-only feedback effect for an interaction
     */
    triggerInteractionEffect(entityGroup, actionType) {
        if (!entityGroup) return;

        // 1. Shake Effect (The "Kinetic" part)
        this._applyShake(entityGroup);

        // 2. Icon Pop (The "Information" part)
        this._showActionIcon(entityGroup, actionType);
    }

    _applyShake(group) {
        const originalPos = group.position.clone();
        const startTime = Date.now();
        const duration = 500; // ms

        const shakeAnimator = {
            update: (delta, now) => {
                const elapsed = Date.now() - startTime;
                const progress = elapsed / duration;

                if (progress >= 1.0) {
                    group.position.copy(originalPos);
                    this.animators.delete(shakeAnimator);
                    return;
                }

                // Dampened Sine Wave for the shake
                const decay = 1.0 - progress;
                const freq = 30;
                const offset = Math.sin(progress * freq) * 0.2 * decay;
                group.position.set(originalPos.x + offset, originalPos.y, originalPos.z + offset * 0.5);
            }
        };

        this.registerAnimator(shakeAnimator);
    }

    _showActionIcon(group, actionType) {
        // Icon mapping (Axe for wood, Pickaxe for stones, Heart for food etc)
        const icons = {
            'HARVESTING': '🪓',
            'MINING': '⛏️',
            'EATING': '🍎',
            'BUILDING': '🔨',
            'COLLECTING': '📦'
        };

        const iconSymbol = icons[actionType] || '❓';
        
        // Use ThoughtBubble infrastructure or a simple floating 3D text
        // For now, let's use a very simple CSS2D-like pop
        const container = document.createElement('div');
        container.className = 'interaction-icon-pop';
        container.textContent = iconSymbol;
        container.style.position = 'absolute';
        container.style.fontSize = '24px';
        container.style.pointerEvents = 'none';
        container.style.transition = 'all 1s ease-out';
        container.style.opacity = '1';
        container.style.transform = 'translateY(0)';
        
        // This requires access to the 2D overlay or a 3D Sprite
        // Since we have ThoughtBubble system, let's try a simple 3D Sprite pop
        const canvas = document.createElement('canvas');
        canvas.width = 64;
        canvas.height = 64;
        const ctx = canvas.getContext('2d');
        ctx.font = '48px serif';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(iconSymbol, 32, 32);

        const texture = new THREE.CanvasTexture(canvas);
        const material = new THREE.SpriteMaterial({ map: texture, transparent: true });
        const sprite = new THREE.Sprite(material);
        
        sprite.position.copy(group.position);
        sprite.position.y += 2.0;
        sprite.scale.set(0.8, 0.8, 1);
        
        this.scene.add(sprite);

        const startTime = Date.now();
        const spriteAnimator = {
            update: (delta, now) => {
                const elapsed = Date.now() - startTime;
                const progress = elapsed / 1000;

                if (progress >= 1.0) {
                    this.scene.remove(sprite);
                    this.animators.delete(spriteAnimator);
                    return;
                }

                sprite.position.y += delta * 1.5;
                sprite.material.opacity = 1.0 - progress;
                sprite.scale.setScalar(0.8 + progress * 0.4);
            }
        };

        this.registerAnimator(spriteAnimator);
    }
}

export default VisualDirector;
