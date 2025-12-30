import * as THREE from 'three';
import { spawnWorldResources, resourceNodes, resetResourceRegistry } from '../entities/ResourceNode.js';
import { createSeed, seeds } from '../entities/Seed.js';
import { createAgent } from '../entities/Agent.js';
import { buildings, resetBuildingRegistry } from '../entities/Building.js';
import { COLORS } from '../config.js';
import { getRandomName, resetUsedNames } from '../agent_names.js';

/**
 * World class - Manages game entities, state, and lifecycle
 */
export class World {
    constructor(visualDirector) {
        this.visualDirector = visualDirector;
        this.scene = visualDirector.scene;
        this.agents = [];
        this.seeds = seeds;
        this.resourceNodes = resourceNodes;
        this.buildings = buildings;
        this.currentWhisper = null;
    }

    init() {
        // Spawn harvestable resources
        spawnWorldResources(this.visualDirector);

        // Create initial seeds
        createSeed('seed_01', 8, 8, this.visualDirector);
        createSeed('seed_02', -10, 5, this.visualDirector);
        createSeed('seed_03', 4, -12, this.visualDirector);
        createSeed('seed_04', -5, -5, this.visualDirector);

        // Create agents
        resetUsedNames();
        
        const agentPioneer = createAgent(getRandomName(), 0, new THREE.Vector3(2, 0, 2), this.visualDirector);
        const agentSettler = createAgent(getRandomName(), 1, new THREE.Vector3(-2, 0, -2), this.visualDirector);

        this.agents.push(agentPioneer);
        this.agents.push(agentSettler);

        console.log(`[World] Initialized with agents: ${this.agents.map(a => a.name).join(', ')}`);
    }

    getEntities() {
        return {
            agents: this.agents,
            resourceNodes: resourceNodes,
            buildings: buildings,
            seeds: seeds
        };
    }

    addAgent(agent) {
        this.agents.push(agent);
    }

    removeAgent(agent) {
        const index = this.agents.indexOf(agent);
        if (index > -1) {
            this.agents.splice(index, 1);
        }
    }

    findAgentByName(name) {
        return this.agents.find(a => a.name === name);
    }
    
    reset() {
        // 1. Remove agents from scene
        this.agents.forEach(a => this.scene.remove(a.group));
        this.agents.length = 0;

        // 2. Remove resources from scene and clear registry
        this.resourceNodes.forEach(n => this.scene.remove(n.group));
        resetResourceRegistry();

        // 3. Remove seeds from scene and clear registry
        this.seeds.forEach(s => this.scene.remove(s));
        this.seeds.length = 0;

        // 4. Remove buildings from scene and clear registry
        this.buildings.forEach(b => this.scene.remove(b.group));
        resetBuildingRegistry();

        // 5. Re-init
        this.init();
    }
}
