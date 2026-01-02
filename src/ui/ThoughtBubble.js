// ThoughtBubble.js - 3D Thought Bubble System
// Uses CSS2DRenderer to display floating text above agents

import { CSS2DRenderer, CSS2DObject } from 'three/examples/jsm/renderers/CSS2DRenderer.js';

let css2dRenderer = null;

/**
 * Initialize the CSS2D renderer for thought bubbles
 */
export function initThoughtBubbleRenderer(container) {
    // Cleanup existing renderer to prevent ghosts on HMR/Restart
    const existing = document.getElementById('css2d-container');
    if (existing) {
        existing.remove();
    }

    css2dRenderer = new CSS2DRenderer();
    css2dRenderer.setSize(window.innerWidth, window.innerHeight);
    css2dRenderer.domElement.style.position = 'absolute';
    css2dRenderer.domElement.style.top = '0';
    css2dRenderer.domElement.style.left = '0';
    css2dRenderer.domElement.style.pointerEvents = 'none';
    css2dRenderer.domElement.id = 'css2d-container'; // ID for cleanup
    
    container.appendChild(css2dRenderer.domElement);

    // Handle resize
    window.addEventListener('resize', () => {
        if (css2dRenderer) { // Check existence
            css2dRenderer.setSize(window.innerWidth, window.innerHeight);
        }
    });

    return css2dRenderer;
}

/**
 * Create a thought bubble for an agent
 */
export function createThoughtBubble(agent) {
    const div = document.createElement('div');
    div.className = 'thought-bubble';
    div.textContent = '...';
    div.style.opacity = '0';

    const bubble = new CSS2DObject(div);
    bubble.position.set(0, 2.2, 0); // Above the agent's head
    agent.group.add(bubble);

    agent.thoughtBubble = {
        object: bubble,
        element: div,
        hideTimeout: null,
        lastThought: ''
    };

    return bubble;
}

/**
 * Update an agent's thought bubble with new text
 */
export function updateThoughtBubble(agent, thought) {
    if (!agent.thoughtBubble) {
        createThoughtBubble(agent);
    }

    const bubble = agent.thoughtBubble;

    // Truncate long thoughts
    const displayText = thought.length > 50
        ? thought.substring(0, 47) + '...'
        : thought;

    // Only update if thought changed
    if (displayText === bubble.lastThought) return;

    bubble.lastThought = displayText;
    bubble.element.textContent = displayText;
    bubble.element.style.opacity = '1';
    bubble.element.classList.remove('fade-out');

    // Clear any existing timeout
    if (bubble.hideTimeout) {
        clearTimeout(bubble.hideTimeout);
    }

    // Hide after 5 seconds
    bubble.hideTimeout = setTimeout(() => {
        bubble.element.classList.add('fade-out');
        setTimeout(() => {
            bubble.element.style.opacity = '0';
        }, 1000);
    }, 5000);

    // Store current thought on agent for panel updates
    agent.currentThought = thought;
}

/**
 * Render the CSS2D layer
 */
export function renderThoughtBubbles(scene, camera) {
    if (css2dRenderer) {
        css2dRenderer.render(scene, camera);
    }
}

/**
 * Crate goal icon overlay for an agent
 */
export function createGoalIcon(agent) {
    const div = document.createElement('div');
    div.className = 'goal-icon';
    div.textContent = '';
    div.style.fontSize = '24px';
    div.style.textShadow = '0 0 4px black';
    div.style.cursor = 'default';
    div.style.pointerEvents = 'none'; // Click-through
    
    // Position offset to right of head
    const bubble = new CSS2DObject(div);
    bubble.position.set(0.5, 2.5, 0); 
    agent.group.add(bubble);

    agent.goalIcon = {
        object: bubble,
        element: div
    };

    return bubble;
}

/**
 * Update an agent's goal icon
 */
export function updateGoalIcon(agent, icon) {
    if (!agent.goalIcon) {
        createGoalIcon(agent);
    }
    
    // Only update if changed
    if (agent.goalIcon.element.textContent !== icon) {
        agent.goalIcon.element.textContent = icon;
    }
}

/**
 * Get the CSS2D renderer instance
 */
export function getCSS2DRenderer() {
    return css2dRenderer;
}
