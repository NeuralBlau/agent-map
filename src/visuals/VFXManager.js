import * as THREE from 'three';
import { EffectComposer } from 'three/examples/jsm/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/examples/jsm/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/examples/jsm/postprocessing/UnrealBloomPass.js';
import { SAOPass } from 'three/examples/jsm/postprocessing/SAOPass.js';
import { OutputPass } from 'three/examples/jsm/postprocessing/OutputPass.js';
import themeManager from './ThemeManager.js';

/**
 * VFXManager - Orchestrates post-processing.
 * Now adapts tone-mapping and bloom threshold based on active theme.
 */
class VFXManager {
    constructor(renderer, scene, camera) {
        this.renderer = renderer;
        this.scene = scene;
        this.camera = camera;
        this.composer = new EffectComposer(this.renderer);
        
        this._init();
        
        // 🟢 Listen for theme changes
        themeManager.onThemeChange(() => this.updateTheme());
    }

    _init() {
        // High-fidelity defaults
        this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
        
        const renderPass = new RenderPass(this.scene, this.camera);
        this.composer.addPass(renderPass);

        // Ambient Occlusion
        const saoPass = new SAOPass(this.scene, this.camera);
        saoPass.params.saoIntensity = 0.03;
        saoPass.params.saoScale = 12;
        saoPass.params.saoBlur = true;
        this.composer.addPass(saoPass);

        // Bloom - Threshold adapts to theme
        const theme = themeManager.themes[themeManager.activeTheme];
        this.bloomPass = new UnrealBloomPass(
            new THREE.Vector2(window.innerWidth, window.innerHeight),
            0.15, 
            0.5,  
            theme.isDark ? 0.85 : 0.92 
        );
        this.composer.addPass(this.bloomPass);

        this.composer.addPass(new OutputPass());
    }

    updateTheme() {
        const theme = themeManager.themes[themeManager.activeTheme];
        this.renderer.toneMappingExposure = theme.isDark ? 1.3 : 0.95;
        this.bloomPass.threshold = theme.isDark ? 0.8 : 0.9;
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
