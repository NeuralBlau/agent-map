// Inventory System
// Manages agent inventory with capacity limits and item manipulation

import { AGENT } from '../config.js';

/**
 * Create a new empty inventory
 */
export function createInventory() {
    return {
        wood: 0,
        stone: 0,
        berries: 0,
        rawMeat: 0,
        cookedMeat: 0,
        fur: 0
    };
}

/**
 * Add items to agent's inventory
 * @returns {number} Amount actually added (may be less if at capacity)
 */
export function addToInventory(agent, item, amount) {
    if (!agent.inventory) {
        agent.inventory = createInventory();
    }

    const currentTotal = getTotalItems(agent);
    const capacity = agent.inventoryCapacity || AGENT.INVENTORY_CAPACITY;
    const freeSpace = capacity - currentTotal;

    if (freeSpace <= 0) {
        console.log(`[Inventory] ${agent.name}'s inventory is full!`);
        return 0;
    }

    const actualAmount = Math.min(amount, freeSpace);
    agent.inventory[item] = (agent.inventory[item] || 0) + actualAmount;

    console.log(`[Inventory] ${agent.name} gained ${actualAmount} ${item}. Total: ${agent.inventory[item]}`);
    return actualAmount;
}

/**
 * Remove items from agent's inventory
 * @returns {boolean} True if successful
 */
export function removeFromInventory(agent, item, amount) {
    if (!agent.inventory || agent.inventory[item] < amount) {
        console.log(`[Inventory] ${agent.name} doesn't have enough ${item}`);
        return false;
    }

    agent.inventory[item] -= amount;
    console.log(`[Inventory] ${agent.name} used ${amount} ${item}. Remaining: ${agent.inventory[item]}`);
    return true;
}

/**
 * Check if agent has required items
 * @param {Object} requirements - e.g., { wood: 5, stone: 2 }
 */
export function hasItems(agent, requirements) {
    if (!agent.inventory) return false;

    return Object.entries(requirements).every(
        ([item, needed]) => (agent.inventory[item] || 0) >= needed
    );
}

/**
 * Consume items for crafting/building
 * @returns {boolean} True if all items consumed
 */
export function consumeItems(agent, requirements) {
    if (!hasItems(agent, requirements)) {
        return false;
    }

    Object.entries(requirements).forEach(([item, amount]) => {
        removeFromInventory(agent, item, amount);
    });

    return true;
}

/**
 * Get total number of items in inventory
 */
export function getTotalItems(agent) {
    if (!agent.inventory) return 0;
    return Object.values(agent.inventory).reduce((sum, count) => sum + count, 0);
}

/**
 * Get capacity percentage (0-1)
 */
export function getInventoryFullness(agent) {
    const total = getTotalItems(agent);
    const capacity = agent.inventoryCapacity || AGENT.INVENTORY_CAPACITY;
    return total / capacity;
}

/**
 * Serialize inventory for LLM prompt
 */
export function serializeInventory(agent) {
    if (!agent.inventory) return {};

    // Only include non-zero items
    const nonZero = {};
    Object.entries(agent.inventory).forEach(([item, count]) => {
        if (count > 0) nonZero[item] = count;
    });

    return nonZero;
}
