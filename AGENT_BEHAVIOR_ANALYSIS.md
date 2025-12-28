# Agent Behavior Analysis

## Iteration 2: System Re-architecture (Phase 1-3)

**Session**: Round 4 (Logs: `session_2025-12-28_13-07-11.log`)
**Changes Active**: Execution Locking, Perception Pre-calc, Notepad Dedupe.

### Key Findings

#### 1. Persistent Hallucination (The "Lying" Problem)

Despite "Perception Cortex" strictly generating `CAN_BUILD_CAMPFIRE: NO (Missing: 9 Wood)`, the Strategic Layer **blatantly ignores** this.

- **Evidence**:
  - [14:07:13] Thea: "Feasibility calculation confirms I have the required materials (31 Wood)." -> **Reality**: Inventory {}, Readiness: `NO`.
  - [14:09:57] Rosa: "The feasibility calculation confirms I have enough wood... I have 17 wood." -> **Reality**: Inventory { Wood: 1 }.
- **Diagnosis**: The LLM is hallucinating numbers (`31`, `17`) that appear nowhere in the prompt. It seems to be treating the "reasoning" field as a creative writing exercise rather than a logic check.

#### 2. Tactical Competence (The "Manager is Smarter")

While the Strategic Layer lies, the **Tactical Layer** actually attempts to solve the problem.

- **Evidence**:
  - [14:08:56] Thea (Strategic) falsely claims "most urgent" despite missing resources.
  - [14:08:56] Thea (Tactical) sees she has 6 Wood (needs 10), and generates a plan: `HARVEST tree -> HARVEST tree -> ... -> BUILD campfire`.
- **Insight**: The Tactical layer, when given a "Building Goal", successfully infers it must gather ingredients first. This suggests we might not need the Strategic Layer to be perfect at math if the Tactical Layer can patch the gaps.

#### 3. Idle Time (Logic Hole Confirmed)

- **Observation**: Agents sit idle for ~75 seconds after finishing a plan.
- **Root Cause**: `strategicLoop` logic flaw in `main.js`.
  - Code: `if (previousGoal !== result.goal) { tacticalLoop(agent); }`
  - Scenario: Agent puts out a plan to GATHER_WOOD. Agent gathers wood. Plan finishes. `strategicLoop` runs. LLM says "GATHER_WOOD" (again).
  - Result: Goal is "Unchanged", so `tacticalLoop` is **NOT** called. Agent has no plan (`behaviorTree is null`).
  - The fallback loop in `animate` calls `strategicLoop` again, but it hits the "Snapshot Cooldown" (10s) and returns early.
  - **Fix**: Modify `strategicLoop` to trigger `tacticalLoop` if goal changes **OR** if `agent.behaviorTree` is null.

### Recommendation for Iteration 3

1.  **Prompt Aggression**: The Strategic Prompt needs to be adversarial. "DO NOT SAY YOU HAVE MATERIALS IF 'NO'".
2.  **Fix Logic Hole**: Apply the "Force Tactical" fix in `main.js`.
3.  **Debug Idle**: (Resolved by logic fix).

---

## Iteration 3: Logic Hardening & Stabilized Execution (Phase 4)

**Session**: Round 5 (Logs: `session_2025-12-28_13-26-31.log`)
**Changes Active**: Locked Execution, Pre-calc Math, Dedupe, **Crash Fixes**, **Adversarial Prompts**.

### Status Overview

- **Stability**: **FIXED**. The system no longer crashes (`PlanExecutor` & `ResourceNode` bugs resolved).
- **Idle Bug**: **FIXED**. Agents transition immediately from execution to planning.
- **Cognition**: **CRITICAL FAILURES REMAIN**.

### Critical Behavioral Findings

#### 1. The "Stat Blindness" Delusion

Agents are completely misinterpreting their own physiological state, leading to suicidal prioritization.

- **Evidence**:
  - [14:28:18] **Thea**: Hunger is `0` (Dying). Health is `99`.
  - **Reasoning**: "My stats are good... Prioritizing shelter [long term]."
  - **Result**: The agent ignores food/campfire to gather stone while starving to death.
- **Diagnosis**: The LLM treats "Hunger: 0" as "Zero Hunger" (Satiated) or simply ignores the semantic meaning of the number. The prompt needs to explicitly label stats as "CRITICAL/SAFE".

#### 2. Resource Hoarding & Looping

Agents act like "wood gathering machines," ignoring their actual requirement (Stone) and accumulating endless Wood.

- **Evidence**:
  - [14:28:49] **Sven**: Inventory has **18 Wood**. Needs **3 Stone** for Campfire.
  - **Plan**: `HARVEST tree_7` (x8 times).
  - **Reasoning**: "I have 18 wood... calculation confirms I can build."
- **Diagnosis**: The "Tactical Layer" seems to default to "Gather Wood" when confused or stressed, creating a loop. The "Have/Need" logic is inverted or ignored.

#### 3. Hallucination Persists (Adversarial Prompts Failed)

Despite Prompts saying "DO NOT LIE," agents continue to fabricate inventory levels.

- **Evidence**:
  - [14:26:33] **Sven**: Inventory `{}` (Empty). Perception: `CAN_BUILD: NO`.
  - **Reasoning**: "I currently have enough wood (10)."
- **Diagnosis**: The LLM's "internal narrative" (I am a survivor who is prepared) overrides the "external data" (Inventory: 0).

#### 4. Tactical Insanity (Repetitive Planning)

- **Evidence**: Sven's plan at [14:28:49] consists of "HARVEST tree_7" repeated **8 times** in a single list.
- **Diagnosis**: This looks like LLM generation collapse or failure to penalize repeated actions in the prompt.

### Recommendations for Phase 5 (Cognitive Calibration)

1.  **Semantic Stat Tags**: don't just send "Hunger: 0". Send "Hunger: 0 (DYING)" or "Hunger: 100 (FULL)". The LLM needs qualitative labels.
2.  **Inventory Injection in Prompt**: The "System Prompt" needs to force the LLM to _repeat_ its inventory before reasoning. "I have X wood. I need Y wood."
3.  **Tactical Constraints**: Add post-processing to the tactical planner to merge duplicates or cap repetitions (e.g., max 1 harvest instance per target per plan).
4.  **Simplify Prompts**: The prompts might be _too_ complex, causing the model (Gemma 4b?) to lose coherence. We might need to strip back the "Persona" fluff and focus on "Robot Logic".
