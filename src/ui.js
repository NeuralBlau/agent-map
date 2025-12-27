// UI Module
// DOM bindings, logging, and whisper system

import { API } from './config.js';

let currentWhisper = null;

export function getCurrentWhisper() {
    return currentWhisper;
}

export function addLog(text, type = 'system') {
    const logs = document.getElementById('brain-logs');
    if (!logs) return;
    const entry = document.createElement('div');
    entry.className = `log-entry ${type}`;
    entry.innerText = `[${new Date().toLocaleTimeString()}] ${text}`;
    logs.prepend(entry);
}

export function setupWhisper() {
    return () => {
        const input = document.getElementById('whisper-input');
        const msg = input.value.trim();
        if (msg) {
            currentWhisper = msg;
            addLog(`God whispers: "${msg}"`, 'system');
            input.value = '';
            // Clear whisper after timeout
            setTimeout(() => {
                if (currentWhisper === msg) currentWhisper = null;
            }, API.WHISPER_TIMEOUT);
        }
    };
}
