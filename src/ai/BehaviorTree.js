// Behavior Tree System
// Executes tactical plans automatically without LLM calls

import * as THREE from 'three';
import { AGENT } from '../config.js';

// ============================================================================
// NODE STATUS
// ============================================================================

export const NodeStatus = {
    SUCCESS: 'SUCCESS',
    FAILURE: 'FAILURE',
    RUNNING: 'RUNNING'
};

// ============================================================================
// BASE NODE
// ============================================================================

export class BTNode {
    constructor(name = 'Node') {
        this.name = name;
        this.status = null;
    }

    getActiveNode() {
        return this;
    }

    tick(agent, context) {
        return NodeStatus.FAILURE;
    }

    reset() {
        this.status = null;
    }
}

// ============================================================================
// COMPOSITE NODES
// ============================================================================

/**
 * Sequence - Runs children in order until one fails
 * Returns SUCCESS if all children succeed
 * Returns FAILURE if any child fails
 * Returns RUNNING if a child is running
 */
export class Sequence extends BTNode {
    constructor(name, children = []) {
        super(name);
        this.children = children;
        this.currentIndex = 0;
    }

    tick(agent, context) {
        while (this.currentIndex < this.children.length) {
            const child = this.children[this.currentIndex];
            const status = child.tick(agent, context);

            if (status === NodeStatus.RUNNING) {
                this.status = NodeStatus.RUNNING;
                return NodeStatus.RUNNING;
            }

            if (status === NodeStatus.FAILURE) {
                this.reset();
                return NodeStatus.FAILURE;
            }

            // SUCCESS - move to next child
            this.currentIndex++;
        }

        // All children succeeded
        this.reset();
        return NodeStatus.SUCCESS;
    }

    reset() {
        this.currentIndex = 0;
        this.children.forEach(c => c.reset());
        this.status = null;
    }

    getActiveNode() {
        if (this.status === NodeStatus.RUNNING && this.children[this.currentIndex]) {
            return this.children[this.currentIndex].getActiveNode();
        }
        return this;
    }
}

/**
 * Selector - Tries children until one succeeds
 * Returns SUCCESS if any child succeeds
 * Returns FAILURE if all children fail
 */
export class Selector extends BTNode {
    constructor(name, children = []) {
        super(name);
        this.children = children;
        this.currentIndex = 0;
    }

    tick(agent, context) {
        while (this.currentIndex < this.children.length) {
            const child = this.children[this.currentIndex];
            const status = child.tick(agent, context);

            if (status === NodeStatus.RUNNING) {
                this.status = NodeStatus.RUNNING;
                return NodeStatus.RUNNING;
            }

            if (status === NodeStatus.SUCCESS) {
                this.reset();
                return NodeStatus.SUCCESS;
            }

            // FAILURE - try next child
            this.currentIndex++;
        }

        // All children failed
        this.reset();
        return NodeStatus.FAILURE;
    }

    reset() {
        this.currentIndex = 0;
        this.children.forEach(c => c.reset());
        this.status = null;
    }

    getActiveNode() {
        if (this.status === NodeStatus.RUNNING && this.children[this.currentIndex]) {
            return this.children[this.currentIndex].getActiveNode();
        }
        return this;
    }
}

// ============================================================================
// CONDITION NODES
// ============================================================================

/**
 * Check if agent is near a target
 */
export class IsNearTarget extends BTNode {
    constructor(targetId, distance = AGENT.INTERACTION_DISTANCE) {
        super(`IsNear(${targetId})`);
        this.targetId = targetId;
        this.distance = distance;
    }

    tick(agent, context) {
        const target = context.findTarget(this.targetId);
        if (!target) {
            this.status = NodeStatus.FAILURE;
            return NodeStatus.FAILURE;
        }

        const dist = agent.group.position.distanceTo(target.position);
        this.status = dist <= this.distance ? NodeStatus.SUCCESS : NodeStatus.FAILURE;
        return this.status;
    }
}

/**
 * Check if agent has enough of an item
 */
export class HasItem extends BTNode {
    constructor(itemType, count = 1) {
        super(`HasItem(${itemType}, ${count})`);
        this.itemType = itemType;
        this.count = count;
    }

    tick(agent, context) {
        const amount = agent.inventory?.[this.itemType] || 0;
        this.status = amount >= this.count ? NodeStatus.SUCCESS : NodeStatus.FAILURE;
        return this.status;
    }
}

/**
 * Check if stat is above threshold
 */
export class StatAbove extends BTNode {
    constructor(statName, threshold) {
        super(`StatAbove(${statName}, ${threshold})`);
        this.statName = statName;
        this.threshold = threshold;
    }

    tick(agent, context) {
        const value = agent.stats?.[this.statName] || 0;
        this.status = value >= this.threshold ? NodeStatus.SUCCESS : NodeStatus.FAILURE;
        return this.status;
    }
}

// ============================================================================
// ACTION NODES
// ============================================================================

/**
 * Move to a target position or entity
 */
export class MoveToNode extends BTNode {
    constructor(targetId) {
        super(`MoveTo(${targetId})`);
        this.targetId = targetId;
        this.started = false;
    }

    tick(agent, context) {
        let target = context.findTarget(this.targetId);

        // STRICT VALIDATION: If original target is gone, FAIL immediately.
        // Do NOT try to find a fallback. This prevents "Ghost Resource" loops where
        // the agent thinks it's going to Tree_A but walks to Tree_B without updating the plan.
        if (!target) {
            console.log(`[BT] Target ${this.targetId} missing/depleted. Failing plan.`);
            this.status = NodeStatus.FAILURE;
            agent.lastError = `Target ${this.targetId} missing`;
            return NodeStatus.FAILURE;
        }

        const dist = agent.group.position.distanceTo(target.position);

        // Already there
        if (dist <= AGENT.INTERACTION_DISTANCE) {
            this.started = false;
            this.status = NodeStatus.SUCCESS;
            return NodeStatus.SUCCESS;
        }

        // Start or continue moving
        if (!this.started || agent.state !== 'MOVING') {
            agent.targetPos.copy(target.position);
            agent.state = 'MOVING';
            this.started = true;
            console.log(`[BT] ${agent.name} moving to ${this.targetId}`);
        }

        this.status = NodeStatus.RUNNING;
        return NodeStatus.RUNNING;
    }

    reset() {
        this.started = false;
        this.status = null;
    }
}

/**
 * Harvest from a resource node
 */
export class HarvestNode extends BTNode {
    constructor(targetId) {
        super(`Harvest(${targetId})`);
        this.targetId = targetId;
        this.harvesting = false;
    }

    tick(agent, context) {
        const { findResource, startHarvest, addLog } = context;
        const resource = findResource(this.targetId);

        if (!resource) {
            this.status = NodeStatus.FAILURE;
            agent.lastError = `Resource ${this.targetId} not found/depleted`;
            return NodeStatus.FAILURE;
        }

        // Check if close enough
        const dist = agent.group.position.distanceTo(resource.group.position);
        if (dist > AGENT.INTERACTION_DISTANCE + 0.5) {
            // Need to move first
            this.status = NodeStatus.FAILURE;
            return NodeStatus.FAILURE;
        }

        // Already harvesting
        if (this.harvesting) {
            if (agent.state === 'HARVESTING') {
                this.status = NodeStatus.RUNNING;
                return NodeStatus.RUNNING;
            }
            // Finished harvesting
            this.harvesting = false;
            this.status = NodeStatus.SUCCESS;
            return NodeStatus.SUCCESS;
        }

        // Start harvesting
        const success = startHarvest(resource, agent, (hasMore) => {
            addLog(`${agent.name} harvested from ${this.targetId}`, 'system');
            this.harvesting = false;
        });

        if (success) {
            this.harvesting = true;
            this.status = NodeStatus.RUNNING;
            return NodeStatus.RUNNING;
        }

        this.status = NodeStatus.FAILURE;
        return NodeStatus.FAILURE;
    }

    reset() {
        this.harvesting = false;
        this.status = null;
    }
}

/**
 * Build a structure
 */
export class BuildNode extends BTNode {
    constructor(recipeId) {
        super(`Build(${recipeId})`);
        this.recipeId = recipeId;
        this.building = false;
    }

    tick(agent, context) {
        const { canCraft, startCraft, createBuilding, addLog, scene } = context;

        if (!canCraft(agent, this.recipeId)) {
            addLog(`${agent.name}: Missing materials for ${this.recipeId}`, 'system');
            agent.lastError = `Missing materials for ${this.recipeId}`;
            this.status = NodeStatus.FAILURE;
            return NodeStatus.FAILURE;
        }

        if (this.building) {
            if (agent.state === 'CRAFTING') {
                this.status = NodeStatus.RUNNING;
                return NodeStatus.RUNNING;
            }
            this.building = false;
            this.status = NodeStatus.SUCCESS;
            return NodeStatus.SUCCESS;
        }

        // Start building
        const buildPos = agent.group.position.clone();
        buildPos.x += 2;

        startCraft(agent, this.recipeId, buildPos, (recipe, pos) => {
            if (recipe.category === 'building') {
                createBuilding(recipe.id, pos.x, pos.z, scene, agent.name);
                addLog(`${agent.name} built a ${recipe.name}!`, 'system');
            }
            this.building = false;
        });

        this.building = true;
        addLog(`${agent.name} started building ${this.recipeId}...`, 'system');
        this.status = NodeStatus.RUNNING;
        return NodeStatus.RUNNING;
    }

    reset() {
        this.building = false;
        this.status = null;
    }
}

/**
 * Eat food from inventory
 */
export class EatNode extends BTNode {
    constructor(itemType = null) {
        super(`Eat(${itemType || 'any'})`);
        this.itemType = itemType;
    }

    tick(agent, context) {
        const { consumeItem, addLog, findTarget } = context;

        let foodType = this.itemType;
        if (!foodType) {
            // Anti-Hallucination: Removed cookedMeat/rawMeat. Only consume what exists.
            const edibles = ['berries']; 
            foodType = edibles.find(item => agent.inventory?.[item] > 0);
            
            // If no food in inventory, check if we are standing near a bush (Telekinesis check)
            if (!foodType) {
                const nearFood = edibles.find(item => {
                   const target = findTarget(item); // Checks resources/seeds
                   if (target) {
                       const dist = agent.group.position.distanceTo(target.position);
                       return dist < 5;
                   }
                   return false;
                });

                if (nearFood) {
                    this.status = NodeStatus.FAILURE;
                    agent.lastError = `Item ${nearFood} visible but not in inventory. YOU MUST HARVEST FIRST.`;
                    return NodeStatus.FAILURE;
                }
            }
        }

        if (!foodType || !agent.inventory?.[foodType]) {
            this.status = NodeStatus.FAILURE;
            // Specific feedback for singular item request
            if (this.itemType) {
                 const target = findTarget(this.itemType);
                 if (target && agent.group.position.distanceTo(target.position) < 5) {
                     agent.lastError = `Item ${this.itemType} visible but not in inventory. YOU MUST HARVEST FIRST.`;
                     return NodeStatus.FAILURE;
                 }
            }
            return NodeStatus.FAILURE;
        }

        const success = consumeItem(agent, foodType);
        if (success) {
            addLog(`${agent.name} ate ${foodType}`, 'system');
            this.status = NodeStatus.SUCCESS;
            return NodeStatus.SUCCESS;
        }

        this.status = NodeStatus.FAILURE;
        return NodeStatus.FAILURE;
    }
}

/**
 * Wait for a duration
 */
export class WaitNode extends BTNode {
    constructor(durationMs = 1000) {
        super(`Wait(${durationMs}ms)`);
        this.durationMs = durationMs;
        this.startTime = null;
    }

    tick(agent, context) {
        if (!this.startTime) {
            this.startTime = Date.now();
        }

        const elapsed = Date.now() - this.startTime;
        if (elapsed >= this.durationMs) {
            this.startTime = null;
            this.status = NodeStatus.SUCCESS;
            return NodeStatus.SUCCESS;
        }

        this.status = NodeStatus.RUNNING;
        return NodeStatus.RUNNING;
    }

    reset() {
        this.startTime = null;
        this.status = null;
    }
}

// ============================================================================
// DECORATOR NODES
// ============================================================================

/**
 * Invert child result
 */
export class Inverter extends BTNode {
    constructor(child) {
        super(`Invert(${child.name})`);
        this.child = child;
    }

    tick(agent, context) {
        const status = this.child.tick(agent, context);
        if (status === NodeStatus.SUCCESS) return NodeStatus.FAILURE;
        if (status === NodeStatus.FAILURE) return NodeStatus.SUCCESS;
        return NodeStatus.RUNNING;
    }

    reset() {
        this.child.reset();
        this.status = null;
    }

    getActiveNode() {
        return this.child.getActiveNode();
    }
}

/**
 * Repeat child until it fails
 */
export class RepeatUntilFail extends BTNode {
    constructor(child) {
        super(`RepeatUntilFail(${child.name})`);
        this.child = child;
    }

    tick(agent, context) {
        const status = this.child.tick(agent, context);
        if (status === NodeStatus.FAILURE) {
            return NodeStatus.SUCCESS;
        }
        if (status === NodeStatus.SUCCESS) {
            this.child.reset();
        }
        return NodeStatus.RUNNING;
    }

    reset() {
        this.child.reset();
        this.status = null;
    }

    getActiveNode() {
        return this.child.getActiveNode();
    }
}
