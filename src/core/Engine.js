import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls';
import { WORLD, COLORS } from '../config.js';

import { initThoughtBubbleRenderer, renderThoughtBubbles } from '../ui/ThoughtBubble.js';

/**
 * Engine class - Handles Three.js rendering, lighting, and core scene setup
 */
export class Engine {
    constructor(container) {
        this.container = container;
        this.scene = new THREE.Scene();
        this.scene.background = new THREE.Color(COLORS.BACKGROUND);
        this.scene.fog = new THREE.Fog(COLORS.BACKGROUND, WORLD.FOG_NEAR, WORLD.FOG_FAR);

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

        this._initLighting();
        this._initGround();
        this._initEvents();
    }

    _initLighting() {
        const ambientLight = new THREE.AmbientLight(COLORS.LIGHT_AMBIENT, 0.4);
        this.scene.add(ambientLight);

        const directionalLight = new THREE.DirectionalLight(COLORS.LIGHT_DIRECTIONAL, 1.2);
        directionalLight.position.set(5, 15, 5);
        directionalLight.castShadow = true;
        directionalLight.shadow.mapSize.width = 2048;
        directionalLight.shadow.mapSize.height = 2048;
        this.scene.add(directionalLight);
    }

    _initGround() {
        const groundGeometry = new THREE.PlaneGeometry(WORLD.GROUND_SIZE, WORLD.GROUND_SIZE);
        const groundMaterial = new THREE.MeshStandardMaterial({
            color: COLORS.GROUND,
            roughness: 0.8,
            metalness: 0.2
        });
        const ground = new THREE.Mesh(groundGeometry, groundMaterial);
        ground.rotation.x = -Math.PI / 2;
        ground.receiveShadow = true;
        this.scene.add(ground);

        const grid = new THREE.GridHelper(WORLD.GRID_SIZE, WORLD.GRID_DIVISIONS, COLORS.GRID_PRIMARY, COLORS.GRID_SECONDARY);
        this.scene.add(grid);
    }

    _initEvents() {
        window.addEventListener('resize', () => {
            this.camera.aspect = window.innerWidth / window.innerHeight;
            this.camera.updateProjectionMatrix();
            this.renderer.setSize(window.innerWidth, window.innerHeight);
        });
    }

    render() {
        this.controls.update();
        renderThoughtBubbles(this.scene, this.camera, this.css2dRenderer);
        this.renderer.render(this.scene, this.camera);
    }
}
