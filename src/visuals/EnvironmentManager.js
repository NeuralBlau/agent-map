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
        this._setupFoliage();
        this._setupMountains();
    }

    _setupMountains() {
        const ringRadius = 110; 
        const mountainCount = 8;
        const mountains = new THREE.Group();

        // 1. Geometry with vertex colors for gradient
        // Moderate large scale
        const baseWidth = 50;
        const height = 90;
        const geo = new THREE.CylinderGeometry(0, baseWidth, height, 4, 1);
        
        // Add vertex colors (Top = peak color, Bottom = dark to blend with ground)
        const colors = [];
        const topColor = new THREE.Color(0x3a4f30); 
        const bottomColor = new THREE.Color(0x0c120c); // Very dark to blend with the rim
        
        const position = geo.attributes.position;
        for (let i = 0; i < position.count; i++) {
            const y = position.getY(i);
            const t = (y + height / 2) / height; 
            const color = bottomColor.clone().lerp(topColor, Math.pow(t, 2.0));
            colors.push(color.r, color.g, color.b);
        }
        geo.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));

        const mountainMat = new THREE.MeshStandardMaterial({
            vertexColors: true,
            roughness: 0.9,
            metalness: 0.1,
            flatShading: true
        });

        // 2. Overlapping Massifs
        for (let i = 0; i < mountainCount; i++) {
            const angle = (i / mountainCount) * Math.PI * 2;
            
            const peaksPerMassif = 3;
            for (let p = 0; p < peaksPerMassif; p++) {
                const mesh = new THREE.Mesh(geo, mountainMat);
                
                const clusterOffset = (Math.random() - 0.5) * 40;
                const r = ringRadius + (Math.random() - 0.5) * 40;
                const x = Math.cos(angle + (clusterOffset * 0.01)) * r;
                const z = Math.sin(angle + (clusterOffset * 0.01)) * r;

                mesh.position.set(x, height / 2 - 10, z);
                mesh.rotation.y = Math.random() * Math.PI;
                mesh.scale.set(
                    0.8 + Math.random() * 0.4,
                    0.6 + Math.random() * 1.2,
                    0.8 + Math.random() * 0.4
                );

                mountains.add(mesh);
            }
        }

        this.scene.add(mountains);
        this.mountains = mountains;

        // Optimized Fog
        this.scene.fog = new THREE.FogExp2(0x050a05, 0.005);
    }

    _setupLighting() {
        // Natural fill light - slightly blue/green
        const ambientLight = new THREE.AmbientLight(0xddeeff, 0.8);
        this.scene.add(ambientLight);
        this.lights.ambient = ambientLight;

        // Main sunlight - warm
        const sun = new THREE.DirectionalLight(0xffffee, 1.8);
        sun.position.set(60, 100, 40); 
        sun.castShadow = true;
        
        // High quality shadows
        sun.shadow.mapSize.width = 4096; // 4K shadows for clarity
        sun.shadow.mapSize.height = 4096;
        sun.shadow.camera.near = 0.5;
        sun.shadow.camera.far = 500; 
        sun.shadow.camera.left = -200;
        sun.shadow.camera.right = 200;
        sun.shadow.camera.top = 200;
        sun.shadow.camera.bottom = -200;
        
        this.scene.add(sun);
        this.lights.sun = sun;
    }

    _setupGround() {
        const visualSize = 400; // Manageable skirt
        const playSize = WORLD.GROUND_SIZE || 100;
        
        const groundGeometry = new THREE.PlaneGeometry(visualSize, visualSize);
        const groundMaterial = new THREE.MeshStandardMaterial({
            color: 0x1a2e1a, // Forest Green
            roughness: 0.8,
            metalness: 0.1
        });
        
        const ground = new THREE.Mesh(groundGeometry, groundMaterial);
        ground.rotation.x = -Math.PI / 2;
        ground.receiveShadow = true;
        this.scene.add(ground);
        this.ground = ground;

        // Subtle grid for the play area ONLY
        const grid = new THREE.GridHelper(playSize, 20, 0x445544, 0x334433);
        grid.position.y = 0.05;
        grid.material.transparent = true;
        grid.material.opacity = 0.4;
        this.scene.add(grid);
        this.grid = grid;
    }

    _setupFoliage() {
        const spawnRange = WORLD.SPAWN_RANGE || 25;
        const grassCount = 1500;
        const pebbleCount = 100;

        // 1. Instanced Grass
        const grassGeo = new THREE.PlaneGeometry(0.1, 0.3);
        const grassMat = new THREE.MeshStandardMaterial({
            color: 0x44aa44,
            side: THREE.DoubleSide,
            alphaTest: 0.5
        });

        // Inject wind shader logic
        grassMat.onBeforeCompile = (shader) => {
            shader.uniforms.time = { value: 0 };
            this.foliageUniforms = shader.uniforms;
            shader.vertexShader = `
                uniform float time;
            ` + shader.vertexShader.replace(
                '#include <begin_vertex>',
                `
                #include <begin_vertex>
                float windScale = 0.3;
                float windSpeed = 2.0;
                float wave = sin(time * windSpeed + position.x * 2.0 + position.z * 2.0) * windScale;
                // Only move top vertices (y > 0)
                if (position.y > 0.0) {
                    transformed.x += wave;
                    transformed.z += wave * 0.5;
                }
                `
            );
        };

        const grassMesh = new THREE.InstancedMesh(grassGeo, grassMat, grassCount);
        const dummy = new THREE.Object3D();

        for (let i = 0; i < grassCount; i++) {
            const x = (Math.random() - 0.5) * spawnRange * 2.5;
            const z = (Math.random() - 0.5) * spawnRange * 2.5;
            
            dummy.position.set(x, 0.15, z);
            dummy.rotation.y = Math.random() * Math.PI;
            dummy.scale.setScalar(0.5 + Math.random() * 1.5);
            dummy.updateMatrix();
            grassMesh.setMatrixAt(i, dummy.matrix);
        }
        grassMesh.receiveShadow = true;
        this.scene.add(grassMesh);

        // 2. Instanced Pebbles
        const pebbleGeo = new THREE.DodecahedronGeometry(0.15, 0);
        const pebbleMat = new THREE.MeshStandardMaterial({
            color: 0x777788,
            roughness: 0.8
        });

        const pebbleMesh = new THREE.InstancedMesh(pebbleGeo, pebbleMat, pebbleCount);
        for (let i = 0; i < pebbleCount; i++) {
            const x = (Math.random() - 0.5) * spawnRange * 2.5;
            const z = (Math.random() - 0.5) * spawnRange * 2.5;
            
            dummy.position.set(x, 0, z);
            dummy.rotation.set(Math.random(), Math.random(), Math.random());
            dummy.scale.setScalar(0.2 + Math.random() * 0.8);
            dummy.updateMatrix();
            pebbleMesh.setMatrixAt(i, dummy.matrix);
        }
        pebbleMesh.castShadow = true;
        pebbleMesh.receiveShadow = true;
        this.scene.add(pebbleMesh);

        this.foliage = { grass: grassMesh, pebbles: pebbleMesh };
    }

    update(delta, now) {
        if (this.foliageUniforms) {
            this.foliageUniforms.time.value = now * 0.001;
        }
    }

    setMood(mood, duration = 2.0) {
        // Mood Configs: [lightIntensity, ambientColor, sunColor]
        const profiles = {
            'day': { sun: 1.2, ambient: 0.6, ambientColor: 0xddeeff },
            'night': { sun: 0.1, ambient: 0.1, ambientColor: 0x111133 },
            'warning': { sun: 1.5, ambient: 0.3, ambientColor: 0xff3300 }
        };

        const config = profiles[mood] || profiles.day;
        
        // Basic instant shift for now
        this.lights.ambient.color.setHex(config.ambientColor);
        this.lights.ambient.intensity = config.ambient;
        this.lights.sun.intensity = config.sun;
        
        console.log(`[Environment] Mood shifted to: ${mood}`);
    }
}

export default EnvironmentManager;
