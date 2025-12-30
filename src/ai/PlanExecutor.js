// Plan Executor - Converts tactical plans to behavior trees
// Parses step descriptions and builds executable BT nodes

import {
    Sequence,
    Selector,
    MoveToNode,
    HarvestNode,
    BuildNode,
    EatNode,
    WaitNode,
    IsNearTarget,
    HasItem,
    NodeStatus
} from './BehaviorTree.js';

// ============================================================================
// PLAN PARSER
// ============================================================================

/**
 * Parse a tactical plan into a behavior tree
 * @param {Array<string>} plan - Array of step descriptions
 * @returns {BTNode} - Root behavior tree node
 */
export function buildTreeFromPlan(plan) {
    console.log(`[BT Parser] Building tree from plan:`, plan);

    if (!plan || plan.length === 0) {
        console.log(`[BT Parser] Empty plan, returning null`);
        return null;
    }

    const steps = plan.map((stepDesc, index) => {
        const node = parseStep(stepDesc, index);
        if (node) {
            console.log(`[BT Parser] Step ${index}: "${stepDesc}" -> ${node.name}`);
            return new StepTrackerNode(index, node);
        }
        console.log(`[BT Parser] Step ${index}: "${stepDesc}" -> null`);
        return null;
    });
    const validSteps = steps.filter(s => s !== null);

    if (validSteps.length === 0) {
        console.log(`[BT Parser] No valid steps parsed, returning null`);
        return null;
    }

    console.log(`[BT Parser] Built tree with ${validSteps.length} steps`);
    // Create a sequence of all steps
    return new Sequence('TacticalPlan', validSteps);
}


/**
 * Parse a single step description into a behavior tree node
 * @param {string} stepDesc - Natural language step description
 * @param {number} index - Step index
 * @returns {BTNode|null}
 */
function parseStep(stepDesc, index) {
    const lower = stepDesc.toLowerCase();

    // Pattern: "Move to [target]"
    if (/\b(move[ _]to|go[ _]to|walk[ _]to|head[ _]to)\b/i.test(stepDesc)) {
        const targetId = extractTargetId(stepDesc);
        if (targetId) {
            return new MoveToNode(targetId);
        }

        // Check for generic resource types if no ID found
        if (/\b(tree|forest|woods)\b/i.test(stepDesc)) return createGatherNode('tree');
        if (/\b(rock|stone|mountain)\b/i.test(stepDesc)) return createGatherNode('rock');
        if (/\b(berry|berries|bush|food)\b/i.test(stepDesc)) return createGatherNode('berry');
    }

    // Pattern: "Gather/Harvest [resource]"
    if (/\b(gather|harvest|collect|get|pick)\b/i.test(stepDesc)) {
        const targetId = extractTargetId(stepDesc);
        if (targetId) {
            // Move then harvest sequence
            return new Sequence(`Step${index}_Harvest`, [
                new MoveToNode(targetId),
                new HarvestNode(targetId)
            ]);
        }

        // Resource type mentioned without ID
        if (/\b(wood|tree|forest)\b/i.test(stepDesc)) return createGatherNode('tree');
        if (/\b(stone|rock)\b/i.test(stepDesc)) return createGatherNode('rock');
        if (/\b(berry|berries|bush)\b/i.test(stepDesc)) return createGatherNode('berry');
    }

    // Pattern: "Build [structure]"
    if (/\b(build|construct|craft|make)\b/i.test(stepDesc)) {
        if (/\b(shelter|house)\b/i.test(stepDesc)) return new BuildNode('SHELTER');
        if (/\b(campfire|fire)\b/i.test(stepDesc)) return new BuildNode('CAMPFIRE');
        if (/\b(spear|weapon)\b/i.test(stepDesc)) return new BuildNode('SPEAR');
    }

    // Pattern: "Eat [food]"
    if (/\b(eat|consume|munch)\b/i.test(stepDesc)) {
        if (/\b(berry|berries)\b/i.test(stepDesc)) return new EatNode('berries');
        if (/\b(meat)\b/i.test(stepDesc)) {
            return new EatNode(lower.includes('cooked') ? 'cookedMeat' : 'rawMeat');
        }
        return new EatNode(null); // Eat anything available
    }

    // Pattern: "Return to base/camp"
    if (/\b(return|go back|head back)\b/i.test(stepDesc)) {
        // TODO: Add base location tracking
        return null;
    }

    // Pattern: "Assess/Wait/Rest"
    // Using word boundaries to avoid matching "Forest" as "Rest"
    if (/\b(wait|rest|assess|sleep|chill)\b/i.test(stepDesc)) {
        // If waiting near campfire, use a 10s wait
        if (/\b(campfire|fire)\b/i.test(stepDesc)) {
            return new WaitNode(10000); // 10 seconds of warmth
        }
        return new WaitNode(3000); // Default short wait
    }

    console.log(`[PlanExecutor] Could not parse step: "${stepDesc}"`);
    return null;
}

/**
 * Extract a target ID from step description
 * Looks for patterns like "tree_7", "rock_3", etc.
 */
function extractTargetId(stepDesc) {
    // Match patterns like: tree_7, rock_3, berry_2, bush_01
    const match = stepDesc.match(/(tree|rock|berry|bush)_?\d+/i);
    if (match) {
        return match[0];
    }

    // Match patterns like: tree 7, rock 3
    const spacedMatch = stepDesc.match(/(tree|rock|berry|bush)\s+(\d+)/i);
    if (spacedMatch) {
        const type = spacedMatch[1].toLowerCase();
        const num = spacedMatch[2];
        if (type === 'berry' || type === 'bush') {
            return `berry_${num}`;
        }
        return `${type}_${num}`;
    }

    return null;
}

/**
 * Create a gather node that finds the nearest resource of a type
 */
function createGatherNode(resourceType) {
    // This will be resolved at runtime using context
    return new GatherNearestNode(resourceType);
}

// ============================================================================
// DYNAMIC NODES (resolve at runtime)
// ============================================================================

import { BTNode } from './BehaviorTree.js';

/**
 * Decorator node that updates the agent's current tactical step index
 */
class StepTrackerNode extends BTNode {
    constructor(stepIndex, child) {
        super(child.name);
        this.stepIndex = stepIndex;
        this.child = child;
    }

    tick(agent, context) {
        // Update the agent's tactical layer progress for the UI
        if (agent.layers && agent.layers.tactical) {
            agent.layers.tactical.currentStep = this.stepIndex;
        }
        return this.child.tick(agent, context);
    }

    reset() {
        this.child.reset();
    }

    getActiveNode() {
        return this.child.getActiveNode();
    }
}

/**
 * Gather from the nearest resource of a type
 * Dynamically finds target at runtime
 */
class GatherNearestNode extends BTNode {
    constructor(resourceType) {
        super(`GatherNearest(${resourceType})`);
        this.resourceType = resourceType;
        this.targetId = null;
        this.moveNode = null;
        this.harvestNode = null;
    }

    tick(agent, context) {
        // Find nearest resource of type if not already set
        if (!this.targetId) {
            const nearest = context.findNearestResource(this.resourceType, agent.group.position);
            if (!nearest) {
                return NodeStatus.FAILURE;
            }
            this.targetId = nearest.id;
            this.moveNode = new MoveToNode(this.targetId);
            this.harvestNode = new HarvestNode(this.targetId);
        }

        // First move to target
        const moveStatus = this.moveNode.tick(agent, context);
        if (moveStatus === NodeStatus.RUNNING) {
            return NodeStatus.RUNNING;
        }
        if (moveStatus === NodeStatus.FAILURE) {
            this.reset();
            return NodeStatus.FAILURE;
        }

        // Then harvest
        const harvestStatus = this.harvestNode.tick(agent, context);
        if (harvestStatus === NodeStatus.RUNNING) {
            return NodeStatus.RUNNING;
        }

        this.reset();
        return harvestStatus;
    }

    reset() {
        this.targetId = null;
        this.moveNode = null;
        this.harvestNode = null;
        this.status = null;
    }

    getActiveNode() {
        if (this.moveNode && this.moveNode.status === NodeStatus.RUNNING) {
            return this.moveNode.getActiveNode();
        }
        if (this.harvestNode && this.harvestNode.status === NodeStatus.RUNNING) {
            return this.harvestNode.getActiveNode();
        }
        return this;
    }
}

// ============================================================================
// BEHAVIOR TREE CONTEXT
// ============================================================================

/**
 * Create execution context for behavior trees
 */
export function createBTContext(options) {
    const {
        scene,
        addLog,
        findResourceById,
        startHarvest,
        canCraft,
        startCraft,
        createBuilding,
        consumeItem,
        findNearestResource,
        visualDirector
    } = options;

    return {
        scene,
        addLog,
        visualDirector,

        // Find a target by ID (resource, seed, or position)
        findTarget(targetId) {
            // Try resources
            const resource = findResourceById(targetId);
            if (resource) {
                return { position: resource.group.position, entity: resource };
            }

            return null;
        },

        // Find resource by ID
        findResource(targetId) {
            return findResourceById(targetId);
        },

        // Find nearest resource of a type
        findNearestResource(resourceType, position) {
            // Use passed helper if available (it binds agent position correctly)
            if (findNearestResource) {
                return findNearestResource(resourceType);
            }

            // Fallback (Logic that crashed because 'position' was undefined)
            if (!position) {
                console.error('[PlanExecutor] findNearestResource called without position and no bound helper!');
                return null;
            }

            const matching = resourceNodes
                .filter(r => r.type === resourceType && r.remaining > 0);

            if (matching.length === 0) return null;

            matching.sort((a, b) =>
                position.distanceTo(a.group.position) -
                position.distanceTo(b.group.position)
            );

            return matching[0];
        },

        // Action helpers
        startHarvest,
        canCraft,
        startCraft,
        createBuilding,
        consumeItem
    };
}
