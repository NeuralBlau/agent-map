import * as THREE from 'three';
import { updateThoughtBubble, updateGoalIcon } from './ThoughtBubble.js';

// Helper for icons
function getGoalIcon(goal) {
    if (!goal) return '💤';
    switch (goal) {
        case 'GATHER_WOOD': return '🪵';
        case 'GATHER_STONE': return '🪨';
        case 'GATHER_FOOD': 
        case 'GATHER_BERRIES': 
        case 'CONSUME_BERRIES': 
        case 'EAT_BERRIES': return '🫐';
        case 'BUILD_SHELTER': 
        case 'CRAFT_SHELTER': return '🏠';
        case 'BUILD_CAMPFIRE': 
        case 'CRAFT_CAMPFIRE': return '🔥';
        case 'STAND_NEAR_CAMPFIRE': return '🌡️';
        case 'EXPLORE': return '🗺️';
        default: return '❓';
    }
}

/**
 * UIManager class - Handles all DOM manipulation, HUD, and inspector panels
 */
export class UIManager {
    constructor() {
        this.selectedAgent = null;
        this.logPanel = document.getElementById('log-panel');
        this.brainLogsFull = document.getElementById('brain-logs-full');
        this.brainLogsInspector = document.getElementById('brain-logs');
        this.agentPanelsContainer = document.getElementById('agent-panels');
        
        // Cache for all per-agent UI elements
        this.agentElements = new Map(); 

        this._initGlobalHandlers();
    }

    _initGlobalHandlers() {
        window.toggleLog = () => {
            if (this.logPanel) this.logPanel.classList.toggle('collapsed');
        };
    }

    /**
     * Initialize HUD panels for each agent
     */
    /**
     * Initialize HUD panels for each agent
     */
    initAgentPanels(agents, onAgentSelect) {
        // Persist callback if provided, or use existing
        if (onAgentSelect) {
            this.agentSelectCallback = onAgentSelect;
        }

        if (!this.agentPanelsContainer) return;
        this.agentPanelsContainer.innerHTML = '';
        this.agentElements.clear();

        agents.forEach(agent => {
            const panel = document.createElement('div');
            // ... (rest of creation logic unchanged, assuming it's consistent)
            panel.className = 'agent-panel';
            panel.id = `panel-${agent.name}`;

            // Create structure via template
            const agentIndex = agents.indexOf(agent); 
            panel.innerHTML = `
                <div class="agent-panel-header">
                    <div class="agent-color-dot agent-${agentIndex}"></div>
                    <span class="agent-name">${agent.name}</span>
                    <span class="agent-goal-icon" style="margin-left:5px; font-size:1.2em;">💤</span>
                    <span class="agent-state">${agent.state}</span>
                </div>
                <div class="agent-thought">Waiting...</div>
                <div class="agent-stats-row">
                    <div class="agent-stat"><span class="stat-icon">🍖</span><span class="stat-value">100</span></div>
                    <div class="agent-stat"><span class="stat-icon">🔥</span><span class="stat-value">100</span></div>
                    <div class="agent-stat"><span class="stat-icon">❤️</span><span class="stat-value">100</span></div>
                </div>
            `;
            this.agentPanelsContainer.appendChild(panel);

            // Cache all dynamic parts
            const stats = panel.querySelectorAll('.stat-value');
            this.agentElements.set(agent.name, {
                panel: panel,
                state: panel.querySelector('.agent-state'),
                goalIcon: panel.querySelector('.agent-goal-icon'),
                thought: panel.querySelector('.agent-thought'),
                stats: {
                    food: stats[0],
                    warmth: stats[1],
                    health: stats[2]
                }
            });

            panel.addEventListener('click', () => {
                this.selectAgent(agent, this.agentSelectCallback);
            });
        });
    }

    /**
     * Handle agent selection
     */
    selectAgent(agent, callback) {
        // Clear previous selections
        this.agentElements.forEach(els => els.panel.classList.remove('selected'));

        if (this.selectedAgent === agent) {
            this.selectedAgent.isSelected = false;
            this.selectedAgent = null;
            this.hideInspectorPanel();
        } else {
            if (this.selectedAgent) this.selectedAgent.isSelected = false;

            this.selectedAgent = agent;
            this.selectedAgent.isSelected = true;

            const els = this.agentElements.get(agent.name);
            if (els) els.panel.classList.add('selected');

            this.showInspectorPanel(agent);
        }

        if (callback) callback(this.selectedAgent);
    }

    /**
     * Update HUD panel for an agent
     */
    updateAgentHUD(agent, thought = null) {
        const els = this.agentElements.get(agent.name);
        if (!els) return;

        // Efficient text updates
        if (els.state.textContent !== agent.state) {
            els.state.textContent = agent.state;
        }

        // --- NEW: Update Goal Icon ---
        const currentGoal = agent.layers?.strategic?.goal;
        const icon = getGoalIcon(currentGoal);
        if (els.goalIcon.textContent !== icon) {
            els.goalIcon.textContent = icon;
            // Optional: tooltip
            els.goalIcon.title = currentGoal || 'Idle';
        }
        
        // Update 3D Overlay
        updateGoalIcon(agent, icon);
        // -----------------------------

        if (thought) {
            const formatted = `"${thought.substring(0, 80)}${thought.length > 80 ? '...' : ''}"`;
            if (els.thought.textContent !== formatted) {
                els.thought.textContent = formatted;
            }
            updateThoughtBubble(agent, thought);
        }

        const statKeys = ['food', 'warmth', 'health'];
        statKeys.forEach(key => {
            const el = els.stats[key];
            const value = Math.round(agent.stats[key]);
            
            if (el.textContent !== value.toString()) {
                el.textContent = value;
                el.className = value < 20 ? 'stat-value critical' : 'stat-value';
            }
        });

        // Also update inspector if it's the selected agent
        if (this.selectedAgent === agent) {
            this.updateInspectorPanel(agent);
        }
    }

    /**
     * Main log panel logic
     */
    addLog(text, type = 'system') {
        if (!this.brainLogsFull) return;

        const entry = document.createElement('div');
        entry.className = `log-entry ${type}`;
        entry.innerText = `[${new Date().toLocaleTimeString()}] ${text}`;

        this.brainLogsFull.prepend(entry);
        while (this.brainLogsFull.children.length > 100) {
            this.brainLogsFull.removeChild(this.brainLogsFull.lastChild);
        }
    }

    /**
     * Inspector Panel Logic
     */
    /**
     * Inspector Panel Logic
     */
    showInspectorPanel(agent) {
        if (!this.brainLogsInspector) return;

        // Build structure once
        this.brainLogsInspector.innerHTML = `
            <div class="inspector-header glass-panel">
                <span class="inspector-title">📍 ${agent.name}</span>
                <button id="inspector-close-btn" class="inspector-close">✕</button>
            </div>
            
            <div class="layer-section strategic">
                <div class="layer-header">🎯 STRATEGIC <span class="layer-time" id="inspector-s-time"></span></div>
                <div id="inspector-s-content" class="layer-content"></div>
            </div>
            
            <div class="layer-section tactical">
                <div class="layer-header">📋 TACTICAL <span class="layer-time" id="inspector-t-time"></span></div>
                <div id="inspector-t-content" class="layer-content"></div>
            </div>
            
            <div class="layer-section immediate">
                <div class="layer-header">⚡ IMMEDIATE</div>
                <div id="inspector-i-content" class="layer-content"></div>
            </div>
            
            <div class="layer-section inventory">
                <div class="layer-header">🎒 INVENTORY</div>
                <div id="inspector-inv-content" class="layer-content"></div>
            </div>
            
            <div class="layer-section history">
                <div class="layer-header">📜 AGENT LOG</div>
                <div id="inspector-history-content" class="layer-content scrollable"></div>
            </div>
        `;

        // Cache inspector elements
        this.inspectorEls = {
            sTime: document.getElementById('inspector-s-time'),
            sContent: document.getElementById('inspector-s-content'),
            tTime: document.getElementById('inspector-t-time'),
            tContent: document.getElementById('inspector-t-content'),
            iContent: document.getElementById('inspector-i-content'),
            invContent: document.getElementById('inspector-inv-content'),
            historyContent: document.getElementById('inspector-history-content')
        };

        document.getElementById('inspector-close-btn').addEventListener('click', () => {
            this.selectAgent(agent);
        });

        this.updateInspectorPanel(agent);
    }

    hideInspectorPanel() {
        if (this.brainLogsInspector) {
            this.brainLogsInspector.innerHTML = '<div class="log-entry">Click an agent to inspect their LLM layers</div>';
            this.inspectorEls = null;
        }
    }

    updateInspectorPanel(agent) {
        if (!this.selectedAgent || this.selectedAgent !== agent || !this.inspectorEls) return;

        const { sTime, sContent, tTime, tContent, iContent, invContent, historyContent } = this.inspectorEls;

        // Strategic layer
        if (agent.layers.strategic) {
            const s = agent.layers.strategic;
            if (sTime) sTime.textContent = s.updatedAt ? Math.round((Date.now() - s.updatedAt) / 1000) + 's ago' : '--';
            if (sContent) {
                sContent.innerHTML = `
                    <div class="goal-line"><strong>Goal:</strong> ${s.goal || 'None'}</div>
                    <div class="priority-line"><strong>Priority:</strong> ${s.priority || '--'}</div>
                    <div class="reasoning-line">"${s.reasoning || 'No reasoning yet'}"</div>
                `;
            }
        }

        // Tactical layer
        if (agent.layers.tactical) {
            const t = agent.layers.tactical;
            if (tTime) tTime.textContent = t.updatedAt ? Math.round((Date.now() - t.updatedAt) / 1000) + 's ago' : '--';
            if (tContent) {
                const planHTML = (t.plan || []).map((step, i) =>
                    `<div class="plan-step ${i === t.currentStep ? 'current' : ''}">${i + 1}. ${step}</div>`
                ).join('') || 'No plan';
                tContent.innerHTML = `
                    <div class="plan-list">${planHTML}</div>
                    <div class="thought-line">"${t.thought || ''}"</div>
                `;
            }
        }

        // Immediate layer
        if (iContent && agent.layers.immediate) {
            const i = agent.layers.immediate;
            iContent.innerHTML = `
                <div><strong>Action:</strong> ${i.action}</div>
                <div><strong>Target:</strong> ${i.target || 'None'}</div>
                <div><strong>State:</strong> ${agent.state}</div>
            `;
        }

        // Inventory
        if (invContent && agent.inventory) {
            invContent.textContent = Object.entries(agent.inventory)
                .filter(([k, v]) => v > 0)
                .map(([k, v]) => `${k}: ${v}`)
                .join(' | ') || 'Empty';
        }

        // Log history
        if (historyContent && agent.logHistory) {
            historyContent.innerHTML = agent.logHistory
                .slice(0, 10)
                .map(log => `<div class="log-entry">[${log.time}] ${log.text}</div>`)
                .join('') || 'No history';
        }
    }
}
