// Agent Names Configuration
// Customizable list of names for agents
// The game will randomly select from this list when spawning agents

export const AGENT_NAMES = [
    // Default human names
    'Ada',
    'Bruno',
    'Clara',
    'Dante',
    'Elena',
    'Felix',
    'Greta',
    'Hugo',
    'Iris',
    'Jonas',
    'Kira',
    'Leo',
    'Maya',
    'Niko',
    'Olive',
    'Pablo',
    'Quinn',
    'Rosa',
    'Sven',
    'Thea'
];

// Track which names have been used to avoid duplicates
let usedNames = [];

export function getRandomName() {
    const availableNames = AGENT_NAMES.filter(name => !usedNames.includes(name));

    if (availableNames.length === 0) {
        // All names used, reset and add a number suffix
        usedNames = [];
        const baseName = AGENT_NAMES[Math.floor(Math.random() * AGENT_NAMES.length)];
        return `${baseName}_${Math.floor(Math.random() * 100)}`;
    }

    const selectedName = availableNames[Math.floor(Math.random() * availableNames.length)];
    usedNames.push(selectedName);
    return selectedName;
}

export function resetUsedNames() {
    usedNames = [];
}

export function addCustomName(name) {
    if (!AGENT_NAMES.includes(name)) {
        AGENT_NAMES.push(name);
    }
}
