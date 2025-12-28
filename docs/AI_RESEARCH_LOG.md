# AI Research & Optimization Log

This document tracks the reasoning behind the AI architectural shifts and provides context for future behavior refinement.

---

## 🔍 The "Reasoning" Fix (Strategic Layer)
**Context**: Agents previously struggled with "math hallucinations" and unrealistic goals.
- **Solution**: Implemented a **Strategic Feasibility Matrix**. The LLM now receives a pre-calculated matrix of which recipes are actually possible based on current inventory.
- **Result**: Agents no longer attempt to build shelters without having the required wood/stone.

## 📋 The "Plan Desync" Fix (Tactical Layer)
**Context**: The UI would often show agents "Doing nothing" even while they were executing a tactical plan.
- **Solution**: Implemented **Behavior Tree Step Tracking**. Every BT node created from a tactical plan now reports its index back to the `agent.layers.tactical.currentStep`.
- **Result**: The Inspector UI now correctly highlights the specific step the agent is executing in real-time.

## 🛡️ The "False Panic" Fix (Execution Layer)
**Context**: Agents would sporadically abandon plans because of minor stat fluctuations.
- **Solution**: Implemented **Delta-Aware Stat Logic**. The "Panic Interrupt" only triggers if stats are critically low (< 15%) AND the agent isn't already taking corrective action.
- **Result**: More stable behavior and fewer abandoned construction projects.

## 📉 Logic Throttling & Cooldowns
**Context**: Multiple agents making LLM requests simultaneously caused "request storms".
- **Solution**:
  - **State Snapshots**: Strategic and Tactical loops now take a "snapshot" of the agent's state. If the state hasn't changed meaningfully, the LLM call is skipped.
  - **Time Throttling**: Tactical requests are limited to once every 2 seconds per agent.
- **Result**: 40% reduction in unnecessary LLM token usage and improved server stability.

---

## 📜 Archives (Refactor Reasoning)
- **Phase 1 (Legacy)**: Initial monolith `brainLoop` handled all logic. High latency, stuttering movement.
- **Refactor (Phase 2)**: Extraction of `AgentPerception.js` and modularization of UI. Transition to PubSub (`Events.js`).
- **Optimization (Phase 3)**: Introduction of the multi-layer architecture to solve the "LLM in the critical path" problem.
