import * as THREE from 'three';
import { updateThoughtBubble } from './ThoughtBubble.js';

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
    initAgentPanels(agents, onAgentSelect) {
        if (!this.agentPanelsContainer) return;
        this.agentPanelsContainer.innerHTML = '';

        agents.forEach(agent => {
            const panel = document.createElement('div');
            panel.className = 'agent-panel';
            panel.id = `panel-${agent.name}`;

            const colorHex = '#' + new THREE.Color(agent.group.children[0].material.color).getHexString();

            panel.innerHTML = `
                <div class="agent-panel-header">
                    <div class="agent-color-dot" style="background: ${colorHex}"></div>
                    <span class="agent-name">${agent.name}</span>
                    <span class="agent-state">${agent.state}</span>
                </div>
                <div class="agent-thought">Waiting...</div>
                <div class="agent-stats-row">
                    <div class="agent-stat"><span class="stat-icon">🍖</span><span class="stat-value" id="stat-hunger-${agent.name}">100</span></div>
                    <div class="agent-stat"><span class="stat-icon">🔥</span><span class="stat-value" id="stat-warmth-${agent.name}">100</span></div>
                    <div class="agent-stat"><span class="stat-icon">❤️</span><span class="stat-value" id="stat-health-${agent.name}">100</span></div>
                    <div class="agent-stat"><span class="stat-icon">⚡</span><span class="stat-value" id="stat-energy-${agent.name}">100</span></div>
                </div>
            `;
            this.agentPanelsContainer.appendChild(panel);

            panel.addEventListener('click', () => {
                this.selectAgent(agent, onAgentSelect);
            });
        });
    }

    /**
     * Handle agent selection
     */
    selectAgent(agent, callback) {
        const panels = document.querySelectorAll('.agent-panel');
        panels.forEach(p => p.classList.remove('selected'));

        if (this.selectedAgent === agent) {
            this.selectedAgent.isSelected = false;
            this.selectedAgent = null;
            this.hideInspectorPanel();
        } else {
            if (this.selectedAgent) this.selectedAgent.isSelected = false;

            this.selectedAgent = agent;
            this.selectedAgent.isSelected = true;

            const panel = document.getElementById(`panel-${agent.name}`);
            if (panel) panel.classList.add('selected');

            this.showInspectorPanel(agent);
        }

        if (callback) callback(this.selectedAgent);
    }

    /**
     * Update HUD panel for an agent
     */
    updateAgentHUD(agent, thought = null) {
        const panel = document.getElementById(`panel-${agent.name}`);
        if (!panel) return;

        const stateEl = panel.querySelector('.agent-state');
        if (stateEl) stateEl.textContent = agent.state;

        if (thought) {
            const thoughtEl = panel.querySelector('.agent-thought');
            if (thoughtEl) {
                thoughtEl.textContent = `"${thought.substring(0, 80)}${thought.length > 80 ? '...' : ''}"`;
            }
            updateThoughtBubble(agent, thought);
        }

        const stats = ['hunger', 'warmth', 'health', 'energy'];
        stats.forEach(stat => {
            const el = document.getElementById(`stat-${stat}-${agent.name}`);
            if (el) {
                const value = Math.round(agent.stats[stat]);
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
    showInspectorPanel(agent) {
        if (!this.brainLogsInspector) return;

        this.brainLogsInspector.innerHTML = `
            <div class="inspector-header">
                <span class="inspector-title">📍 ${agent.name}</span>
                <button id="inspector-close-btn" class="inspector-close">✕</button>
            </div>
            
            <div class="layer-section strategic">
                <div class="layer-header">🎯 STRATEGIC <span class="layer-time" id="strategic-time"></span></div>
                <div class="layer-content" id="strategic-content">Loading...</div>
            </div>
            
            <div class="layer-section tactical">
                <div class="layer-header">📋 TACTICAL <span class="layer-time" id="tactical-time"></span></div>
                <div class="layer-content" id="tactical-content">Loading...</div>
            </div>
            
            <div class="layer-section immediate">
                <div class="layer-header">⚡ IMMEDIATE</div>
                <div class="layer-content" id="immediate-content">Loading...</div>
            </div>
            
            <div class="layer-section inventory">
                <div class="layer-header">🎒 INVENTORY</div>
                <div class="layer-content" id="inventory-content">Loading...</div>
            </div>
            
            <div class="layer-section history">
                <div class="layer-header">📜 AGENT LOG</div>
                <div class="layer-content scrollable" id="history-content">Loading...</div>
            </div>
        `;

        document.getElementById('inspector-close-btn').addEventListener('click', () => {
            this.selectAgent(agent);
        });

        this.updateInspectorPanel(agent);
    }

    hideInspectorPanel() {
        if (this.brainLogsInspector) {
            this.brainLogsInspector.innerHTML = '<div class="log-entry">Click an agent to inspect their LLM layers</div>';
        }
    }

    updateInspectorPanel(agent) {
        if (!this.selectedAgent || this.selectedAgent !== agent) return;

        // Strategic layer
        const strategicEl = document.getElementById('strategic-content');
        if (strategicEl && agent.layers.strategic) {
            const s = agent.layers.strategic;
            const timeAgo = s.updatedAt ? Math.round((Date.now() - s.updatedAt) / 1000) + 's ago' : '--';
            const timeEl = document.getElementById('strategic-time');
            if (timeEl) timeEl.textContent = timeAgo;

            strategicEl.innerHTML = `
                <div class="goal-line"><strong>Goal:</strong> ${s.goal || 'None'}</div>
                <div class="priority-line"><strong>Priority:</strong> ${s.priority || '--'}</div>
                <div class="reasoning-line">"${s.reasoning || 'No reasoning yet'}"</div>
            `;
        }

        // Tactical layer
        const tacticalEl = document.getElementById('tactical-content');
        if (tacticalEl && agent.layers.tactical) {
            const t = agent.layers.tactical;
            const timeAgo = t.updatedAt ? Math.round((Date.now() - t.updatedAt) / 1000) + 's ago' : '--';
            const timeEl = document.getElementById('tactical-time');
            if (timeEl) timeEl.textContent = timeAgo;

            const planHTML = (t.plan || []).map((step, i) =>
                `<div class="plan-step ${i === t.currentStep ? 'current' : ''}">${i + 1}. ${step}</div>`
            ).join('') || 'No plan';

            tacticalEl.innerHTML = `
                <div class="plan-list">${planHTML}</div>
                <div class="thought-line">"${t.thought || ''}"</div>
            `;
        }

        // Immediate layer
        const immediateEl = document.getElementById('immediate-content');
        if (immediateEl && agent.layers.immediate) {
            const i = agent.layers.immediate;
            immediateEl.innerHTML = `
                <div><strong>Action:</strong> ${i.action}</div>
                <div><strong>Target:</strong> ${i.target || 'None'}</div>
                <div><strong>State:</strong> ${agent.state}</div>
            `;
        }

        // Inventory
        const inventoryEl = document.getElementById('inventory-content');
        if (inventoryEl && agent.inventory) {
            const items = Object.entries(agent.inventory)
                .filter(([k, v]) => v > 0)
                .map(([k, v]) => `${k}: ${v}`)
                .join(' | ') || 'Empty';
            inventoryEl.textContent = items;
        }

        // Log history
        const historyEl = document.getElementById('history-content');
        if (historyEl && agent.logHistory) {
            historyEl.innerHTML = agent.logHistory
                .slice(0, 10)
                .map(log => `<div class="log-entry">[${log.time}] ${log.text}</div>`)
                .join('') || 'No history';
        }
    }
}
