// Scene Setup Module
// Three.js scene, camera, renderer, lighting, and environment

import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls';
import { WORLD, COLORS } from './config.js';

// Scene
export const scene = new THREE.Scene();
scene.background = new THREE.Color(COLORS.BACKGROUND);
scene.fog = new THREE.Fog(COLORS.BACKGROUND, WORLD.FOG_NEAR, WORLD.FOG_FAR);

// Camera
export const camera = new THREE.PerspectiveCamera(
    75,
    window.innerWidth / window.innerHeight,
    0.1,
    1000
);
camera.position.set(15, 15, 15);

// Renderer
export const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.setPixelRatio(window.devicePixelRatio);
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;

// Controls
export const controls = new OrbitControls(camera, renderer.domElement);
controls.enableDamping = true;
controls.dampingFactor = 0.05;

// Lighting
const ambientLight = new THREE.AmbientLight(COLORS.LIGHT_AMBIENT, 0.4);
scene.add(ambientLight);

const directionalLight = new THREE.DirectionalLight(COLORS.LIGHT_DIRECTIONAL, 1.2);
directionalLight.position.set(5, 15, 5);
directionalLight.castShadow = true;
directionalLight.shadow.mapSize.width = 2048;
directionalLight.shadow.mapSize.height = 2048;
scene.add(directionalLight);

// Ground
const groundGeometry = new THREE.PlaneGeometry(WORLD.GROUND_SIZE, WORLD.GROUND_SIZE);
const groundMaterial = new THREE.MeshStandardMaterial({
    color: COLORS.GROUND,
    roughness: 0.8,
    metalness: 0.2
});
const ground = new THREE.Mesh(groundGeometry, groundMaterial);
ground.rotation.x = -Math.PI / 2;
ground.receiveShadow = true;
scene.add(ground);

const grid = new THREE.GridHelper(
    WORLD.GRID_SIZE,
    WORLD.GRID_DIVISIONS,
    COLORS.GRID_PRIMARY,
    COLORS.GRID_SECONDARY
);
scene.add(grid);

// Environment Decorations
function createTree(x, z) {
    const tree = new THREE.Group();
    const trunkGeo = new THREE.CylinderGeometry(0.2, 0.2, 1);
    const trunkMat = new THREE.MeshStandardMaterial({ color: COLORS.TREE_TRUNK });
    const trunk = new THREE.Mesh(trunkGeo, trunkMat);
    trunk.position.y = 0.5;
    trunk.castShadow = true;
    tree.add(trunk);

    const leavesGeo = new THREE.DodecahedronGeometry(0.8);
    const leavesMat = new THREE.MeshStandardMaterial({ color: COLORS.TREE_LEAVES });
    const leaves = new THREE.Mesh(leavesGeo, leavesMat);
    leaves.position.y = 1.3;
    leaves.castShadow = true;
    tree.add(leaves);

    tree.position.set(x, 0, z);
    scene.add(tree);
}

function createRock(x, z) {
    const rockGeo = new THREE.IcosahedronGeometry(0.4, 0);
    const rockMat = new THREE.MeshStandardMaterial({ color: COLORS.ROCK });
    const rock = new THREE.Mesh(rockGeo, rockMat);
    rock.scale.set(Math.random() + 0.5, Math.random() + 0.5, Math.random() + 0.5);
    rock.position.set(x, 0.2, z);
    rock.rotation.set(Math.random(), Math.random(), Math.random());
    rock.castShadow = true;
    scene.add(rock);
}

// Initialize decorations
for (let i = 0; i < WORLD.DECORATION_COUNT; i++) {
    const range = WORLD.GRID_SIZE / 2;
    createTree(Math.random() * range * 2 - range, Math.random() * range * 2 - range);
    createRock(Math.random() * range * 2 - range, Math.random() * range * 2 - range);
}

// Mount renderer to DOM
export function mountRenderer() {
    document.getElementById('app').appendChild(renderer.domElement);
}

// Handle window resize
export function setupResizeHandler() {
    window.addEventListener('resize', () => {
        camera.aspect = window.innerWidth / window.innerHeight;
        camera.updateProjectionMatrix();
        renderer.setSize(window.innerWidth, window.innerHeight);
    });
}
