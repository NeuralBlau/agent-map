import * as THREE from 'three';
import { WORLD, COLORS } from '../config.js';

/**
 * EnvironmentManager - Manages lighting, terrain, and atmospheric decorators.
 */
class EnvironmentManager {
    constructor(scene) {
        this.scene = scene;
        this.lights = {};
        this.init();
    }

    init() {
        this._setupLighting();
        this._setupGround();
    }

    _setupLighting() {
        // Natural fill light
        const ambientLight = new THREE.AmbientLight(COLORS.LIGHT_AMBIENT, 0.4);
        this.scene.add(ambientLight);
        this.lights.ambient = ambientLight;

        // Main sunlight
        const sun = new THREE.DirectionalLight(COLORS.LIGHT_DIRECTIONAL, 1.2);
        sun.position.set(15, 25, 10);
        sun.castShadow = true;
        
        // Shadow configuration
        sun.shadow.mapSize.width = 2048;
        sun.shadow.mapSize.height = 2048;
        sun.shadow.camera.near = 0.5;
        sun.shadow.camera.far = 100;
        sun.shadow.camera.left = -50;
        sun.shadow.camera.right = 50;
        sun.shadow.camera.top = 50;
        sun.shadow.camera.bottom = -50;
        
        this.scene.add(sun);
        this.lights.sun = sun;
    }

    _setupGround() {
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
        this.ground = ground;

        // Subtle grid for orientation
        const grid = new THREE.GridHelper(WORLD.GRID_SIZE, WORLD.GRID_DIVISIONS, COLORS.GRID_PRIMARY, COLORS.GRID_SECONDARY);
        grid.position.y = 0.05;
        this.scene.add(grid);
        this.grid = grid;
    }

    /**
     * Shifts the environment mood (colors, light intensity)
     * @param {string} mood - 'day', 'night', 'cold', 'panic'
     */
    setMood(mood) {
        // To be implemented: Smooth lerps between lighting states
        console.log(`[Environment] Mood shifting to: ${mood}`);
    }
}

export default EnvironmentManager;
