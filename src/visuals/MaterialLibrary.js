import * as THREE from 'three';
import themeManager from './ThemeManager.js';
import { ShaderUtils } from './ShaderUtils.js';

/**
 * MaterialLibrary - Centralized registry for all geometries and materials.
 * Decouples the "look" of assets from the entity logic.
 */
class MaterialLibrary {
    constructor() {
        this.geometries = new Map();
        this.materials = new Map();
        this._initLibrary();
    }

    _initLibrary() {
        // ... (geometries stay same)
        this.geometries.set('cube', new THREE.BoxGeometry(1, 1, 1));
        this.geometries.set('sphere', new THREE.SphereGeometry(1, 16, 16));
        this.geometries.set('plane', new THREE.PlaneGeometry(1, 1));
        this.geometries.set('trunk', new THREE.CylinderGeometry(0.12, 0.22, 1.8, 6));
        this.geometries.set('canopy', new THREE.IcosahedronGeometry(0.8, 0));
        this.geometries.set('rock', new THREE.DodecahedronGeometry(0.55, 0));
        
        this._createStandardMaterials();
    }

    _createStandardMaterials() {
        // Custom "Soft Stylized" Material Template - Now Theme-Aware
        const createSoftMaterial = (colorSource, roughness = 0.8, uniformRef = null) => {
            const mat = new THREE.MeshStandardMaterial({
                color: typeof colorSource === 'string' ? new THREE.Color(colorSource) : (colorSource.value ? colorSource.value : colorSource),
                roughness: roughness,
                metalness: 0.1,
                flatShading: false
            });

            // CRITICAL: Ensure unique shader programs for materials using onBeforeCompile
            if (uniformRef) {
                mat.customProgramCacheKey = () => uniformRef;
                
                mat.onBeforeCompile = (shader) => {
                    ShaderUtils.injectUniform(shader, uniformRef, 'vec3', themeManager.uniforms[uniformRef]);
                    ShaderUtils.applyFoliagePop(shader, uniformRef);
                };
            }
            return mat;
        };

        // Agent Body - Now decoupled from UI accents & Indexed for scaling
        this.materials.set('agent_standard', (index = 0) => {
            const mat = new THREE.MeshStandardMaterial({
                roughness: 0.4,
                metalness: 0.2
            });
            
            // CRITICAL: Unique cache key for each index to prevent shader sharing
            mat.customProgramCacheKey = () => `agent_${index}`;
            
            mat.onBeforeCompile = (shader) => {
                ShaderUtils.applyAgentColors(shader, index);
            };
            return mat;
        });

        // Seed Material - Now reactive
        this.materials.set('seed_standard', () => {
            const mat = new THREE.MeshStandardMaterial({ roughness: 0.2 });
            mat.onBeforeCompile = (shader) => {
                ShaderUtils.injectUniform(shader, 'uAccentA', 'vec3', themeManager.uniforms.uAccentA);
                ShaderUtils.injectFragmentLogic(shader, '#include <color_fragment>', 'diffuseColor.rgb = uAccentA;');
            };
            return mat;
        });

        // UI / Face
        this.materials.set('ui_black', new THREE.MeshBasicMaterial({ color: 0x000000 }));
        
        // Resource Defaults - Using theme tints
        this.materials.set('tree_trunk', createSoftMaterial(themeManager.uniforms.uTrunkColor, 0.9, 'uTrunkColor'));
        this.materials.set('tree_leaves', createSoftMaterial(themeManager.uniforms.uTreeColor, 0.4, 'uTreeColor'));
        this.materials.set('berry_leaves', createSoftMaterial(themeManager.uniforms.uBerryColor, 0.4, 'uBerryColor'));
        this.materials.set('rock_standard', createSoftMaterial('hsl(0, 0%, 50%)', 0.8, null));
        this.materials.set('mountain_standard', createSoftMaterial(themeManager.uniforms.uMountainColor, 0.95, 'uMountainColor'));
    }

    /**
     * Get a mesh based on type and config
     * @param {string} type - 'agent', 'tree', 'rock', etc.
     * @param {object} config - colors, variants, etc.
     */
    getMesh(type, config = {}) {
        const group = new THREE.Group();

        switch (type) {
            case 'agent':
                // Body
                const body = new THREE.Mesh(
                    this.geometries.get('cube'),
                    this.materials.get('agent_standard')(config.colorIndex)
                );
                body.position.y = 0.5;
                body.castShadow = true;
                group.add(body);

                // Face
                const face = new THREE.Group();
                face.position.set(0, 0, 0.51);
                
                const eyeGeo = new THREE.PlaneGeometry(0.2, 0.2);
                const mouthGeo = new THREE.PlaneGeometry(0.25, 0.05);
                const uiMat = this.materials.get('ui_black');

                const e1 = new THREE.Mesh(eyeGeo, uiMat);
                e1.position.set(0.22, 0.7, 0);
                
                const e2 = new THREE.Mesh(eyeGeo, uiMat);
                e2.position.set(-0.22, 0.7, 0);
                
                const mouth = new THREE.Mesh(mouthGeo, uiMat);
                mouth.position.set(0, 0.45, 0);
                
                face.add(e1, e2, mouth);
                group.add(face);

                // Expose references
                group.userData = { body, eyes: [e1, e2], mouth, face };
                return group;

            case 'tree':
                const treeTrunk = new THREE.Mesh(this.geometries.get('trunk'), this.materials.get('tree_trunk'));
                treeTrunk.position.y = 0.7;
                treeTrunk.castShadow = true;
                group.add(treeTrunk);

                const treeCanopy = new THREE.Mesh(this.geometries.get('canopy'), this.materials.get('tree_leaves'));
                treeCanopy.position.y = 2.0;
                treeCanopy.castShadow = true;
                group.add(treeCanopy);

                const scale = 0.8 + Math.random() * 0.4;
                group.scale.set(scale, scale, scale);
                group.rotation.y = Math.random() * Math.PI * 2;
                return group;

            case 'rock':
                const rock = new THREE.Mesh(this.geometries.get('rock'), this.materials.get('rock_standard'));
                rock.position.y = 0.25;
                rock.castShadow = true;
                group.add(rock);
                return group;

            case 'berry_bush':
                const bush = new THREE.Mesh(this.geometries.get('sphere'), this.materials.get('berry_leaves'));
                bush.scale.set(0.6, 0.4, 0.6);
                bush.position.y = 0.2;
                group.add(bush);
                
                const berryMat = new THREE.MeshStandardMaterial({ color: 0xff3366, emissive: 0xff3366, emissiveIntensity: 0.5 });
                for(let i=0; i<5; i++) {
                    const berry = new THREE.Mesh(new THREE.SphereGeometry(0.05, 4, 4), berryMat);
                    berry.position.set((Math.random()-0.5)*0.5, 0.3+Math.random()*0.2, (Math.random()-0.5)*0.5);
                    group.add(berry);
                }
                return group;

            case 'campfire':
                const ring = new THREE.Mesh(new THREE.RingGeometry(0.4, 0.6, 8), this.materials.get('rock_standard'));
                ring.rotation.x = -Math.PI/2;
                ring.position.y = 0.05;
                group.add(ring);

                const fireMat = new THREE.MeshBasicMaterial({ color: 0xff6633, transparent: true, opacity: 0.8 });
                const fire = new THREE.Mesh(new THREE.SphereGeometry(0.25, 8, 8), fireMat);
                fire.position.y = 0.3;
                group.add(fire);
                return group;

            case 'shelter':
                const tent = new THREE.Mesh(new THREE.ConeGeometry(2, 2.5, 4), createSoftMaterial('hsl(25, 40%, 40%)'));
                tent.position.y = 1.25;
                tent.rotation.y = Math.PI/4;
                group.add(tent);
                return group;

            case 'seed':
                const seed = new THREE.Mesh(new THREE.IcosahedronGeometry(0.3, 0), this.materials.get('seed_standard')());
                seed.position.y = 0.3;
                seed.castShadow = true;
                group.add(seed);
                return group;

            default:
                return group;
        }
    }
}

export const materials = new MaterialLibrary();
