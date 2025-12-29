import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls';
import { WORLD, COLORS } from '../config.js';

import { initThoughtBubbleRenderer, renderThoughtBubbles } from '../ui/ThoughtBubble.js';
import VisualDirector from '../visuals/VisualDirector.js';

/**
 * Engine class - Handles Three.js rendering, lighting, and core scene setup
 */
export class Engine {
    constructor(container) {
        this.container = container;
        this.scene = new THREE.Scene();
        this.scene.background = new THREE.Color(COLORS.BACKGROUND);

        this.camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000);
        this.camera.position.set(15, 15, 15);

        this.renderer = new THREE.WebGLRenderer({ antialias: true });
        this.renderer.setSize(window.innerWidth, window.innerHeight);
        this.renderer.setPixelRatio(window.devicePixelRatio);
        this.renderer.shadowMap.enabled = true;
        this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
        this.container.appendChild(this.renderer.domElement);

        // Initialize CSS2D renderer for thought bubbles
        this.css2dRenderer = initThoughtBubbleRenderer(this.container);

        this.controls = new OrbitControls(this.camera, this.renderer.domElement);
        this.controls.enableDamping = true;
        this.controls.dampingFactor = 0.05;

        // NEW: Centralized Visual System
        this.visualDirector = new VisualDirector(this);

        this._initEvents();
    }

    _initEvents() {
        window.addEventListener('resize', () => {
            const width = window.innerWidth;
            const height = window.innerHeight;
            this.camera.aspect = width / height;
            this.camera.updateProjectionMatrix();
            this.renderer.setSize(width, height);
            
            // Notify Visual Systems of resize
            if (this.visualDirector && this.visualDirector.vfx) {
                this.visualDirector.vfx.handleResize(width, height);
            }
        });
    }

    render() {
        const delta = 0.016; // Approx 60fps
        const now = Date.now();
        
        this.controls.update();
        
        // Update Visual Systems
        if (this.visualDirector) {
            this.visualDirector.update(delta, now);
        }

        renderThoughtBubbles(this.scene, this.camera, this.css2dRenderer);
        
        // Let VisualDirector/VFX handle the actual render pass
        if (this.visualDirector && this.visualDirector.vfx) {
            this.visualDirector.vfx.render();
        } else {
            this.renderer.render(this.scene, this.camera);
        }
    }
}
