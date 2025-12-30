import * as THREE from 'three';
import { WORLD, COLORS } from '../config.js';
import themeManager from './ThemeManager.js';
import { ShaderUtils } from './ShaderUtils.js';

/**
 * EnvironmentManager - Handles lighting, ground, and atmosphere.
 * Now fully reactive via ThemeManager.
 */
class EnvironmentManager {
    constructor(scene) {
        this.scene = scene;
        this.lights = {};
        this._init();

        // 🟢 Listen for theme changes
        themeManager.onThemeChange(() => this.updateTheme());
    }

    updateTheme() {
        const theme = themeManager.themes[themeManager.activeTheme];
        const isSocialPop = themeManager.activeTheme === 'SOCIAL_POP';
        
        // Update Fog
        const fogDensity = isSocialPop ? 0.004 : (theme.isDark ? 0.003 : 0.005);
        if (this.scene.fog) {
            this.scene.fog.color.set(theme.atmosphere);
            this.scene.fog.density = fogDensity;
        } else {
            this.scene.fog = new THREE.FogExp2(theme.atmosphere, fogDensity);
        }

        // Update Background (Sky) - Now strictly following the atmosphere token
        this.scene.background = new THREE.Color(theme.atmosphere);

        // Update Lights
        if (this.lights.ambient) {
            // Social Pop needs balanced ambient to keep punchy shadows
            const ambientColor = isSocialPop ? 0xd0d8ff : (theme.isDark ? 0xb0b0ff : theme.atmosphere);
            const ambientIntensity = isSocialPop ? 0.5 : (theme.isDark ? 0.5 : 0.8);
            
            this.lights.ambient.color.set(ambientColor);
            this.lights.ambient.intensity = ambientIntensity;
        }

        if (this.lights.sun) {
            this.lights.sun.intensity = isSocialPop ? 2.0 : (theme.isDark ? 1.8 : 1.8);
            this.lights.sun.color.set(isSocialPop ? 0xffffff : (theme.isDark ? 0xd0d0ff : 0xffffee));
        }
    }

    _init() {
        this._setupMountains();
        this._setupLighting();
        this._setupGround();
        this._setupFoliage();
    }

    _setupMountains() {
        const ringRadius = 110; 
        const mountainCount = 8;
        const mountains = new THREE.Group();

        // 1. Geometry - Store height ratio for reactive shader
        const baseWidth = 50;
        const height = 90;
        const geo = new THREE.CylinderGeometry(0, baseWidth, height, 4, 1);
        
        const position = geo.attributes.position;
        const aHeightRatio = new Float32Array(position.count);
        for (let i = 0; i < position.count; i++) {
            const y = position.getY(i);
            aHeightRatio[i] = (y + height / 2) / height; 
        }
        geo.setAttribute('aHeightRatio', new THREE.BufferAttribute(aHeightRatio, 1));

        const mountainMat = new THREE.MeshStandardMaterial({
            roughness: 0.9,
            metalness: 0.1,
            flatShading: true
        });

        // 🟢 THEME INJECTION (ShaderUtils)
        mountainMat.onBeforeCompile = (shader) => {
            ShaderUtils.applyMountainGradients(shader);
        };

        // 2. Overlapping Massifs
        for (let i = 0; i < mountainCount; i++) {
            const angle = (i / mountainCount) * Math.PI * 2;
            const peaksPerMassif = 3;
            for (let p = 0; p < peaksPerMassif; p++) {
                const mesh = new THREE.Mesh(geo, mountainMat);
                const r = ringRadius + (Math.random() - 0.5) * 40;
                mesh.position.set(Math.cos(angle)*r, height/2 - 10, Math.sin(angle)*r);
                mesh.rotation.y = Math.random() * Math.PI;
                mesh.scale.set(0.8+Math.random()*0.4, 0.6+Math.random()*1.2, 0.8+Math.random()*0.4);
                mountains.add(mesh);
            }
        }
        this.scene.add(mountains);
        this.mountains = mountains;
        this.scene.fog = new THREE.FogExp2(themeManager.get('atmosphere'), 0.008);
    }

    _setupLighting() {
        // Natural fill light - Driven by Theme
        const ambientLight = new THREE.AmbientLight(themeManager.get('atmosphere'), 0.8);
        this.scene.add(ambientLight);
        this.lights.ambient = ambientLight;

        // Main sunlight
        const sun = new THREE.DirectionalLight(0xffffee, 1.8);
        sun.position.set(60, 100, 40); 
        sun.castShadow = true;
        
        // High quality shadows
        sun.shadow.mapSize.width = 4096;
        sun.shadow.mapSize.height = 4096;
        sun.shadow.camera.near = 0.5;
        sun.shadow.camera.far = 500; 
        
        this.scene.add(sun);
        this.lights.sun = sun;
    }

    _setupGround() {
        const visualSize = 400; 
        const playSize = 100;
        
        const groundGeometry = new THREE.PlaneGeometry(visualSize, visualSize);
        const groundMaterial = new THREE.MeshStandardMaterial({
            roughness: 0.9,
            metalness: 0.05
        });

        // 🟢 THEME INJECTION (ShaderUtils)
        groundMaterial.onBeforeCompile = (shader) => {
            ShaderUtils.injectUniform(shader, 'uSurfaceColor', 'vec3', themeManager.uniforms.uSurfaceColor);
            
            ShaderUtils.injectVertexLogic(shader, '#include <common>', 'varying vec2 vUv;');
            ShaderUtils.injectVertexLogic(shader, '#include <uv_vertex>', 'vUv = uv;');
            
            ShaderUtils.injectFragmentLogic(shader, '#include <common>', 'varying vec2 vUv;');
            ShaderUtils.applyGroundNoise(shader, 'uSurfaceColor');
        };
        
        const ground = new THREE.Mesh(groundGeometry, groundMaterial);
        ground.rotation.x = -Math.PI / 2;
        ground.receiveShadow = true;
        this.scene.add(ground);
        this.ground = ground;

        // 2. Stylized Play-Area Boundary
        const ringGeo = new THREE.RingGeometry(playSize, playSize + 0.3, 128);
        const ringMat = new THREE.MeshBasicMaterial({
            color: 0xa0ff90,
            transparent: true,
            opacity: 0.2,
            side: THREE.DoubleSide
        });
        const border = new THREE.Mesh(ringGeo, ringMat);
        border.rotation.x = -Math.PI / 2;
        border.position.y = 0.02;
        this.scene.add(border);
        this.boundary = border;
    }

    _setupFoliage() {
        const spawnRange = WORLD.SPAWN_RANGE || 25;
        const grassCount = 3500; // Boosted density
        const pebbleCount = 250; // Boosted density

        // 1. Instanced Grass
        const grassGeo = new THREE.PlaneGeometry(0.1, 0.3);
        const grassMat = new THREE.MeshStandardMaterial({
            side: THREE.DoubleSide,
            alphaTest: 0.5
        });

        // 🟢 THEME INJECTION (ShaderUtils)
        grassMat.onBeforeCompile = (shader) => {
            ShaderUtils.injectUniform(shader, 'time', 'float', themeManager.uniforms.uTime);
            ShaderUtils.injectUniform(shader, 'uGrassColor', 'vec3', themeManager.uniforms.uGrassColor);
            this.foliageUniforms = shader.uniforms;

            ShaderUtils.applyWind(shader, 'time');
            ShaderUtils.injectFragmentLogic(shader, '#include <color_fragment>', 'diffuseColor.rgb = uGrassColor;');
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

        if (this.boundary) {
            this.boundary.material.opacity = 0.1 + Math.sin(now * 0.002) * 0.1;
        }
        
        // Push uTime to global uniforms
        themeManager.uniforms.uTime.value = now * 0.001;
    }
}

export default EnvironmentManager;
