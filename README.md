# Agent Map: The Lonely Pioneer Simulation

A modular, Three.js-powered survival simulation where autonomous agents operate using a **triple-layer AI architecture** powered by Large Language Models (LLMs) and Behavior Trees.

## 🚀 How it Works (The AI Brain)

The agents use a hierarchical intelligence system to bridge high-level reasoning with low-level execution:

1.  **Strategic Layer (LLM)**: Every 30 seconds, the agent evaluates its entire life (hunger, warmth, inventory, nearby threats). It decides on a long-term goal (e.g., "Build a Shelter to survive the night").
2.  **Tactical Layer (LLM)**: Once a goal is set, the Tactical layer breaks it down into a sequence of actionable steps (e.g., `["Move to Tree", "Gather Wood", "Construct Shelter"]`).
3.  **Immediate Layer (Behavior Tree)**: High-level steps are parsed into a **Behavior Tree (BT)**. This BT handles the frame-by-frame execution, pathfinding to targets, and physical interactions without needing constant LLM calls.

---

## 📁 Project Structure

### 🖥️ Client (src/)
The frontend is built with **Vanilla JS** and **Three.js**.

- **Core**
  - `core/Engine.js`: Handles rendering, lighting, camera, and the main animation loop.
  - `core/World.js`: Manages the spawning and state of all entities in the game world.

- **AI Layer**
  - `ai/AgentPerception.js`: Sterilizes the complex 3D world into a text-based format the LLM can understand.
  - `ai/BehaviorTree.js`: Contains the logic for Sequences, Selectors, and Action nodes (Move, Harvest, Eat, Build).
  - `ai/PlanExecutor.js`: Parses natural language plans from the LLM into executable BT node structures.
  - `main.js`: The main orchestrator that connects the engine, world, and AI loops.

- **Entities**
  - `entities/Agent.js`: Physical properties, stats (hunger/warmth), and movement logic for agents.
  - `entities/ResourceNode.js`: Logic for trees, rocks, and berry bushes.
  - `entities/Building.js`: Logic for structures like campfires and shelters.

- **Systems**
  - `systems/Events.js`: A PubSub system used to decouple game logic from UI updates.
  - `systems/Inventory.js`: Management of agent items and resource collection.

- **UI**
  - `ui/UIManager.js`: Central manager for HUD panels, the inspector, and log displays.
  - `ui/ThoughtBubble.js`: Handles the 3D CSS2D bubbles that display what agents are thinking.

### 🌐 Server (server/)
The backend manages communication with the LLM (e.g., Ollama).

- `server.js`: Express server providing endpoints for `/strategic`, `/tactical`, and `/decide`.
- `server/LLMService.js`: Encapsulates the API calls to the local/remote LLM.
- `server/PromptTemplates.js`: Contains the specialized prompts that give agents their survival "intuition."

---

## 🛠️ Setup & Running

1.  **Install Dependencies**:
    ```bash
    npm install
    ```

2.  **Start LLM (Ollama)**:
    Ensure you have [Ollama](https://ollama.ai/) running with your chosen model (default: `mistral` or `llama3`).

3.  **Run the Server**:
    ```bash
    node server.js
    ```

4.  **Run the Game**:
    ```bash
    npm run dev
    ```

5.  **Start Intelligence**:
    Once the page loads, click the **"Start AI"** button in the HUD to activate the agents.

## 🧠 Technology Stack
- **Frontend**: Three.js (3D), CSS2D (UI Overlays), Vanilla Javascript.
- **Backend**: Node.js, Express, Axios.
- **AI**: Ollama (Local LLM), Behavior Tree Pattern.
