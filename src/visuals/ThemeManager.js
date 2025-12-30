import * as THREE from 'three';

/**
 * ThemeManager - Reactive engine for colors and atmosphere.
 * Synchronizes 3D uniforms, CSS variables, and renderer state.
 */
class ThemeManager {
    constructor() {
        this.themes = {
            'CANDY_VALLEY': {
                surface: 'hsl(145, 80%, 45%)',
                grass: 'hsl(120, 90%, 65%)',
                mountains: 'hsl(160, 40%, 40%)',
                trees: 'hsl(140, 80%, 50%)',
                trunks: 'hsl(25, 40%, 40%)',
                atmosphere: 'hsl(205, 100%, 85%)',
                accentA: 'hsl(330, 100%, 65%)',
                accentB: 'hsl(190, 100%, 50%)',
                uiBg: 'hsla(0, 0%, 100%, 0.95)',
                uiText: 'hsl(210, 30%, 15%)',
                uiPanel: 'hsla(145, 80%, 10%, 0.05)',
                uiHover: 'hsla(330, 100%, 50%, 0.12)',
                uiAccentMuted: 'hsla(330, 100%, 50%, 0.1)',
                uiBorder: 'hsla(145, 80%, 10%, 0.1)',
                accentA_H: 330,
                isDark: false
            },
            'MIDNIGHT_VALLEY': {
                surface: 'hsl(230, 60%, 8%)',
                grass: 'hsl(120, 100%, 60%)',
                mountains: 'hsl(250, 40%, 12%)',
                trees: 'hsl(160, 100%, 40%)',
                trunks: 'hsl(230, 20%, 30%)',
                atmosphere: 'hsl(230, 80%, 12%)',
                accentA: 'hsl(120, 100%, 70%)',
                accentB: 'hsl(190, 100%, 55%)',
                uiBg: 'hsla(230, 40%, 10%, 0.95)',
                uiText: 'hsl(210, 20%, 95%)',
                uiPanel: 'hsla(120, 100%, 50%, 0.05)',
                uiHover: 'hsla(120, 100%, 50%, 0.15)',
                uiAccentMuted: 'hsla(120, 100%, 50%, 0.1)',
                uiBorder: 'hsla(120, 100%, 50%, 0.2)',
                accentA_H: 120,
                isDark: true
            },
            'SOCIAL_POP': {
                surface: 'hsl(80, 40%, 15%)',       // Rich Olive Anchor Ground
                grass: 'hsl(140, 100%, 45%)',       // Electric Pop Grass
                mountains: 'hsl(215, 15%, 45%)',    // Cool Slate Mountains
                trees: 'hsl(122, 100%, 50%)',       // Vibrant Tree Green
                berries: 'hsl(160, 100%, 40%)',     // Different Bush Green
                trunks: 'hsl(25, 45%, 28%)',        // Deep Brown Trunks
                atmosphere: 'hsla(205, 88%, 49%, 1.00)',  // Light Sky Blue
                accentA: 'hsl(0, 100%, 55%)',       // VIBRANT RED Headings
                accentB: 'hsl(180, 100%, 50%)',      // Energetic Cyan
                agentA: 'hsl(185, 100%, 45%)',      // Deep Cyan Agent
                agentB: 'hsl(280, 80%, 65%)',       // Vibrant Lavender Agent
                uiBg: 'hsla(220, 60%, 6%, 0.95)',   // Ultra-Dark Sidebar
                uiText: 'hsl(0, 0%, 100%)',
                uiPanel: 'hsla(220, 45%, 20%, 0.5)',
                uiHover: 'hsla(180, 100%, 50%, 0.15)',
                uiAccentMuted: 'hsla(180, 100%, 50%, 0.1)',
                uiBorder: 'hsla(0, 0%, 100%, 0.15)',
                accentA_H: 0,
                isDark: true
            }
        };

        this.activeTheme = 'SOCIAL_POP';
        this.listeners = [];
        
        // Global Uniforms for Shaders
        this.uniforms = {
            uSurfaceColor: { value: new THREE.Color() },
            uGrassColor: { value: new THREE.Color() },
            uMountainColor: { value: new THREE.Color() },
            uTreeColor: { value: new THREE.Color() },
            uBerryColor: { value: new THREE.Color() },
            uTrunkColor: { value: new THREE.Color() },
            uAtmosphereColor: { value: new THREE.Color() },
            uAgentA: { value: new THREE.Color() },
            uAgentB: { value: new THREE.Color() },
            uAccentA: { value: new THREE.Color() },
            uAccentB: { value: new THREE.Color() },
            uTime: { value: 0 }
        };

        this._applyInitialTheme();
    }

    onThemeChange(callback) {
        this.listeners.push(callback);
    }

    setTheme(id) {
        if (!this.themes[id]) return;
        this.activeTheme = id;
        const theme = this.themes[id];

        // 1. Update Uniforms (Three.js)
        this.uniforms.uSurfaceColor.value.set(theme.surface);
        this.uniforms.uGrassColor.value.set(theme.grass);
        this.uniforms.uMountainColor.value.set(theme.mountains);
        this.uniforms.uTreeColor.value.set(theme.trees);
        this.uniforms.uBerryColor.value.set(theme.berries || theme.trees);
        this.uniforms.uTrunkColor.value.set(theme.trunks);
        this.uniforms.uAtmosphereColor.value.set(theme.atmosphere);
        this.uniforms.uAgentA.value.set(theme.agentA);
        this.uniforms.uAgentB.value.set(theme.agentB);
        this.uniforms.uAccentA.value.set(theme.accentA);
        this.uniforms.uAccentB.value.set(theme.accentB);

        // 2. Update CSS Variables (DOM)
        const root = document.documentElement;
        root.style.setProperty('--theme-surface', theme.surface);
        root.style.setProperty('--theme-grass', theme.grass);
        root.style.setProperty('--theme-mountains', theme.mountains);
        root.style.setProperty('--theme-trees', theme.trees);
        root.style.setProperty('--theme-berries', theme.berries || theme.trees);
        root.style.setProperty('--theme-trunks', theme.trunks);
        root.style.setProperty('--theme-atmosphere', theme.atmosphere);
        root.style.setProperty('--theme-agent-a', theme.agentA);
        root.style.setProperty('--theme-agent-b', theme.agentB);
        root.style.setProperty('--theme-accent-a', theme.accentA);
        root.style.setProperty('--theme-accent-b', theme.accentB);
        root.style.setProperty('--theme-ui-bg', theme.uiBg);
        root.style.setProperty('--theme-ui-text', theme.uiText);
        root.style.setProperty('--theme-ui-panel', theme.uiPanel);
        root.style.setProperty('--theme-ui-hover', theme.uiHover);
        root.style.setProperty('--theme-ui-accent-muted', theme.uiAccentMuted);
        root.style.setProperty('--theme-ui-border-muted', theme.uiBorder);
        root.style.setProperty('--theme-accent-a-h', theme.accentA_H);
        root.setAttribute('data-theme', theme.isDark ? 'dark' : 'light');

        // 3. Notify Listeners
        this.listeners.forEach(cb => cb(id, theme));

        console.log(`[ThemeManager] Swapped to: ${id}`);
        console.log(`[ThemeManager] Trees: ${theme.trees}, Berries: ${theme.berries || theme.trees}`);
    }

    _applyInitialTheme() {
        // Apply immediately for defaults
        this.setTheme(this.activeTheme);
        // And again on next tick to ensure DOM is ready for transitions
        setTimeout(() => this.setTheme(this.activeTheme), 10);
    }

    get(key) {
        return this.themes[this.activeTheme][key];
    }
}

const themeManager = new ThemeManager();
window.themeManager = themeManager;
export default themeManager;
