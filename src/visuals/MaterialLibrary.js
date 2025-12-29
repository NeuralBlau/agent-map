import * as THREE from 'three';
import { COLORS } from '../config.js';

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
        // Initialize basic geometries
        this.geometries.set('cube', new THREE.BoxGeometry(1, 1, 1));
        this.geometries.set('sphere', new THREE.SphereGeometry(1, 16, 16));
        this.geometries.set('plane', new THREE.PlaneGeometry(1, 1));
        
        // Complex geometries (Stylized/Low-poly)
        this.geometries.set('trunk', new THREE.CylinderGeometry(0.12, 0.22, 1.8, 6));
        this.geometries.set('canopy', new THREE.IcosahedronGeometry(0.8, 0));
        this.geometries.set('rock', new THREE.DodecahedronGeometry(0.55, 0));
        
        // Initial Materials
        this._createStandardMaterials();
    }

    _createStandardMaterials() {
        // Agent Body
        this.materials.set('agent_standard', (color) => new THREE.MeshStandardMaterial({
            color: color,
            emissive: color,
            emissiveIntensity: 0.2,
            roughness: 0.5,
            metalness: 0.1
        }));

        // UI / Face
        this.materials.set('ui_black', new THREE.MeshBasicMaterial({ color: 0x000000 }));
        
        // Resource Defaults
        this.materials.set('tree_trunk', new THREE.MeshStandardMaterial({ color: 0x3d2b1f, roughness: 0.9 }));
        this.materials.set('tree_leaves', new THREE.MeshStandardMaterial({ color: 0x22cc44, flatShading: true }));
        this.materials.set('rock_standard', new THREE.MeshStandardMaterial({
            color: 0x666677,
            roughness: 0.8,
            metalness: 0.2,
            flatShading: true
        }));
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
                    this.materials.get('agent_standard')(config.color || 0x00ff00)
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

                // Expose references for animations
                group.userData = {
                    body,
                    eyes: [e1, e2],
                    mouth,
                    face
                };
                return group;

            case 'tree':
                const treeTrunk = new THREE.Mesh(this.geometries.get('trunk'), this.materials.get('tree_trunk'));
                treeTrunk.position.y = 0.7;
                treeTrunk.castShadow = true;
                group.add(treeTrunk);

                // Leaf color variation
                const leafColor = new THREE.Color(0x22cc44).multiplyScalar(0.8 + Math.random() * 0.4);
                const treeCanopy = new THREE.Mesh(this.geometries.get('canopy'), new THREE.MeshStandardMaterial({ 
                    color: leafColor, 
                    flatShading: true 
                }));
                treeCanopy.position.y = 2.0;
                treeCanopy.castShadow = true;
                group.add(treeCanopy);

                // Random scale variation
                const scale = 0.8 + Math.random() * 0.4;
                group.scale.set(scale, scale, scale);
                group.rotation.y = Math.random() * Math.PI * 2;
                
                return group;

            case 'rock':
                const rock = new THREE.Mesh(this.geometries.get('rock'), this.materials.get('rock_standard'));
                rock.position.y = 0.25;
                rock.rotation.set(Math.random(), Math.random(), Math.random());
                rock.castShadow = true;
                group.add(rock);
                return group;

            case 'berry_bush':
                // Stylized bush (simple sphere cluster for now)
                const bushGeo = new THREE.SphereGeometry(0.4, 6, 6);
                const bushMat = new THREE.MeshStandardMaterial({ color: 0x1a4a1a, flatShading: true });
                const bush = new THREE.Mesh(bushGeo, bushMat);
                bush.position.y = 0.25;
                group.add(bush);
                
                // Add tiny red dots for berries
                const berryGeo = new THREE.SphereGeometry(0.05, 4, 4);
                const berryMat = new THREE.MeshStandardMaterial({ color: 0xff0000, emissive: 0xff0000, emissiveIntensity: 0.5 });
                for(let i=0; i<5; i++) {
                    const berry = new THREE.Mesh(berryGeo, berryMat);
                    berry.position.set(
                        (Math.random() - 0.5) * 0.6,
                        0.3 + Math.random() * 0.3,
                        (Math.random() - 0.5) * 0.6
                    );
                    group.add(berry);
                }
                return group;

            case 'campfire':
                // Stones
                const ringGeo = new THREE.RingGeometry(0.4, 0.6, 8);
                const ringMat = this.materials.get('rock_standard');
                const ring = new THREE.Mesh(ringGeo, ringMat);
                ring.rotation.x = -Math.PI / 2;
                ring.position.y = 0.05;
                group.add(ring);

                // Fire glow (Basic sphere)
                const fireGeo = new THREE.SphereGeometry(0.25, 8, 8);
                const fireMat = new THREE.MeshBasicMaterial({ color: 0xff6600, transparent: true, opacity: 0.8 });
                const fire = new THREE.Mesh(fireGeo, fireMat);
                fire.position.y = 0.3;
                group.add(fire);
                return group;

            case 'shelter':
                // Simple tent shape
                const tentGeo = new THREE.ConeGeometry(2, 2.5, 4);
                const tentMat = new THREE.MeshStandardMaterial({ color: 0x8b5a2b, flatShading: true });
                const tent = new THREE.Mesh(tentGeo, tentMat);
                tent.position.y = 1.25;
                tent.rotation.y = Math.PI / 4;
                group.add(tent);
                return group;

            case 'seed':
                const seed = new THREE.Mesh(
                    new THREE.IcosahedronGeometry(0.3, 0),
                    new THREE.MeshStandardMaterial({
                        color: COLORS.SEED,
                        emissive: COLORS.SEED,
                        emissiveIntensity: 0.5
                    })
                );
                seed.position.y = 0.3;
                seed.castShadow = true;
                group.add(seed);
                return group;

            default:
                console.warn(`[MaterialLibrary] Unknown type: ${type}`);
                return group;
        }
    }
}

export const materials = new MaterialLibrary();
