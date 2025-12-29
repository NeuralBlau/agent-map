import * as THREE from 'three';
import { spawnWorldResources, resourceNodes } from '../entities/ResourceNode.js';
import { createSeed, seeds } from '../entities/Seed.js';
import { createAgent } from '../entities/Agent.js';
import { buildings } from '../entities/Building.js';
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
        
        const agentPioneer = createAgent(getRandomName(), COLORS.AGENT_PIONEER, new THREE.Vector3(2, 0, 2), this.visualDirector);
        const agentSettler = createAgent(getRandomName(), COLORS.AGENT_SETTLER, new THREE.Vector3(-2, 0, -2), this.visualDirector);

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
}
