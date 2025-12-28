// ThoughtBubble.js - 3D Thought Bubble System
// Uses CSS2DRenderer to display floating text above agents

import { CSS2DRenderer, CSS2DObject } from 'three/examples/jsm/renderers/CSS2DRenderer.js';

let css2dRenderer = null;

/**
 * Initialize the CSS2D renderer for thought bubbles
 */
export function initThoughtBubbleRenderer(container) {
    css2dRenderer = new CSS2DRenderer();
    css2dRenderer.setSize(window.innerWidth, window.innerHeight);
    css2dRenderer.domElement.style.position = 'absolute';
    css2dRenderer.domElement.style.top = '0';
    css2dRenderer.domElement.style.left = '0';
    css2dRenderer.domElement.style.pointerEvents = 'none';
    container.appendChild(css2dRenderer.domElement);

    // Handle resize
    window.addEventListener('resize', () => {
        css2dRenderer.setSize(window.innerWidth, window.innerHeight);
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
 * Get the CSS2D renderer instance
 */
export function getCSS2DRenderer() {
    return css2dRenderer;
}
