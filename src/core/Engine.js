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
        this.camera.position.set(20, 20, 20);

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
        this.controls.maxPolarAngle = Math.PI / 2.1; 
        this.controls.maxDistance = 80; // Back to cohesive range
        this.controls.minDistance = 5;

        // NEW: Centralized Visual System
        this.visualDirector = new VisualDirector(this);

        this.keys = {};
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

        window.addEventListener('keydown', (e) => this.keys[e.key.toLowerCase()] = true);
        window.addEventListener('keyup', (e) => this.keys[e.key.toLowerCase()] = false);
    }

    setFollowTarget(target) {
        // Allow re-snapping if called again
        
        this.followedObject = target;
        
        if (target) {
            // SNAP ZOOM: Move camera close to agent
            const offset = new THREE.Vector3(10, 10, 10); // Close Isometric
            this.camera.position.copy(target.position).add(offset);
            this.controls.target.copy(target.position);
            
            // Store last known position
            this.lastTargetPos = target.position.clone();
            console.log(`[Camera] Locked on ${target.position.x.toFixed(2)}, ${target.position.z.toFixed(2)}`);
        }
    }

    render() {
        const delta = 0.016; // Approx 60fps
        const now = Date.now();
        
        if (!this.followedObject) {
            // WASD Panning
            const panSpeed = 0.5;
            const forward = new THREE.Vector3();
            this.camera.getWorldDirection(forward);
            forward.y = 0;
            forward.normalize();
            
            const right = new THREE.Vector3();
            right.crossVectors(forward, new THREE.Vector3(0, 1, 0));

            if (this.keys['w']) this.controls.target.addScaledVector(forward, panSpeed);
            if (this.keys['s']) this.controls.target.addScaledVector(forward, -panSpeed);
            if (this.keys['a']) this.controls.target.addScaledVector(right, -panSpeed);
            if (this.keys['d']) this.controls.target.addScaledVector(right, panSpeed);
        } else {
            // FOLLOW MODE: Robust Offset Preservation
            // 1. Calculate current offset from the *current* target (which is where OrbitControls thinks it is)
            const offset = new THREE.Vector3().subVectors(this.camera.position, this.controls.target);
            
            // 2. Update controls target to the new agent position
            const newTargetPos = this.followedObject.position;
            this.controls.target.copy(newTargetPos);
            
            // 3. Move camera to maintain the exact same relative offset
            this.camera.position.addVectors(newTargetPos, offset);
        }

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
