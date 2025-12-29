import { EffectComposer } from 'three/examples/jsm/postprocessing/EffectComposer';
import { RenderPass } from 'three/examples/jsm/postprocessing/RenderPass';
import { UnrealBloomPass } from 'three/examples/jsm/postprocessing/UnrealBloomPass';
import { OutputPass } from 'three/examples/jsm/postprocessing/OutputPass';
import { SAOPass } from 'three/examples/jsm/postprocessing/SAOPass';
import * as THREE from 'three';

/**
 * VFXManager - Manages post-processing, bloom, and screen-space effects.
 */
class VFXManager {
    constructor(engine) {
        this.engine = engine;
        this.renderer = engine.renderer;
        this.scene = engine.scene;
        this.camera = engine.camera;
        
        this.composer = null;
        this.bloomPass = null;
        
        this.init();
    }

    init() {
        this.composer = new EffectComposer(this.renderer);
        
        // Ensure the renderer is set for high-fidelity output
        this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
        this.renderer.toneMappingExposure = 1.0;

        const renderPass = new RenderPass(this.scene, this.camera);
        this.composer.addPass(renderPass);

        // 1. Ambient Occlusion (Grounding objects)
        const saoPass = new SAOPass(this.scene, this.camera);
        saoPass.params.saoIntensity = 0.05;
        saoPass.params.saoScale = 10;
        saoPass.params.saoKernelRadius = 25;
        saoPass.params.saoBlur = true;
        this.composer.addPass(saoPass);

        // 2. Standard Bloom setup
        this.bloomPass = new UnrealBloomPass(
            new THREE.Vector2(window.innerWidth, window.innerHeight),
            0.3, // Strength
            0.4, // Radius
            0.85 // Threshold
        );
        this.composer.addPass(this.bloomPass);

        const outputPass = new OutputPass();
        this.composer.addPass(outputPass);
    }

    handleResize(width, height) {
        if (this.composer) {
            this.composer.setSize(width, height);
        }
    }

    render() {
        if (this.composer) {
            this.composer.render();
        } else {
            this.renderer.render(this.scene, this.camera);
        }
    }

    /**
     * Boosts or dims effects based on mood
     */
    updateEffects(config) {
        if (this.bloomPass) {
            if (config.bloomStrength !== undefined) this.bloomPass.strength = config.bloomStrength;
        }
    }
}

export default VFXManager;
