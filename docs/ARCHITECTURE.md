# System Architecture - Agent Map

This document outlines the core technical architecture of the Lonely Pioneer simulation, covering the AI cognitive stack, entity systems, and world mechanics.

---

## 🧠 AI Cognitive Stack (The 3-Layer System)

To balance high-level reasoning with fluid, frame-by-frame execution, the agents operate on a three-tier intelligence architecture:

### 1. Strategic Layer (Long-Term Reasoning)
- **Engine**: LLM (Strategic Prompt)
- **Interval**: ~30-60 seconds or on major events.
- **Responsibility**: Analyzes high-level survival stats, inventory, and social standing. It sets the agent's current high-level "Goal" (e.g., `BUILD_SHELTER`, `GATHER_FOOD`).
- **Memory Bindings**: Reads and writes to the agent's persistent `notepad.md`.

### 2. Tactical Layer (Short-Term Planning)
- **Engine**: LLM (Tactical Prompt)
- **Interval**: Triggered by goal changes or plan completion/failure.
- **Responsibility**: Breaks a Strategic Goal into 3-5 concrete steps (e.g., `["Move to Tree", "Gather Wood", "Repeat"]`). 
- **Output**: Generates a natural language plan that is parsed into a Behavior Tree.

### 3. Execution Layer (Immediate Action)
- **Engine**: Behavior Tree (BT)
- **Interval**: Every frame.
- **Responsibility**: Handles smooth movement, pathfinding, and action execution (Harvesting, Building, Eating) without LLM latency.
- **Fail-safes**: Includes "Panic Interrupts" (e.g., if hunger < 15%, abandon plan and find food).

---

## 🎒 Entity & Survival Systems

### Stats & Decay
- **Hunger**: Decays steadily. Restored by eating berries or meat.
- **Warmth**: Decays based on environment. Restored by campfires and shelters.
- **Health**: Decreases if hunger or warmth reaches 0. 

### Inventory & Resources
- **Inventory**: Agents have limited slots (defined in `config.js`).
- **Resources**: 
  - `Tree`: Provides wood.
  - `Rock`: Provides stone.
  - `Bush`: Provides berries.
- **Respawning**: Resources deplete after harvest and respawn after a set duration.

### Crafting & Buildings
- **Recipes**: Defined in `src/systems/Crafting.js`.
- **Structures**: 
  - `Campfire`: Provides an area-of-effect warmth bonus.
  - `Shelter`: Provides a passive warmth bonus to the owner.

---

## 📡 Memory & Persistence

### The Notepad System
Each agent has a personal `agents/[agent_id]_notepad.md` file. This is the agent's "long-term memory".
- **Observations**: Trust levels and notes about other agents.
- **Preferences**: Personal quirks or favored location.
- **Memories**: Key events (e.g., "Day 2: Leo shared wood with me").
- **God's Whispers**: Direct instructions received from the player.

---

## 🛠️ Technical Design Decisions

- **Events (PubSub)**: Uses `src/systems/Events.js` to decouple game logic (like an agent eating) from UI updates (the HUD updating).
- **UIManager**: Centralized DOM management in `src/ui/UIManager.js` to prevent spaghetti code in the core loop.
- **Engine/World Separation**: `src/core/Engine.js` handles Three.js rendering while `src/core/World.js` manages entity logic.
