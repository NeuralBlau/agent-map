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

---

## Iteration 4: The "Cultist" & The Phantom Builder (Phase 5)

**Session**: Round 6 (Logs: `session_2025-12-28_14-13-52.log`)
**Changes Active**: Semantic Stat Tags likely active (e.g. "CAN_BUILD_CAMPFIRE: NO (Missing: MISSING 10)"), but behavior suggests deeper issues.

### Critical Behavioral Findings

#### 1. The "Cultist" Behavior (Over-Adherence to Notepad)

Agents have swung from "Stat Blindness" to "Fanatical Obedience". They acknowledge they are dying but refuse to deviate from the "Strategic Priority" set in their Notepad/Memories.

- **Evidence**:
  - [15:16:04] **Jonas**: "Health is DYING... The Knowledge Base explicitly states that 'Shelter is the ONLY thing that matters.'... Delaying this will lead to death." -> **Action**: Continues gathering wood for Shelter.
  - [15:15:31] **Ada**: "Hunger is DYING... Campfire is top priority." (Correct identification, but fails to execute).
- **Diagnosis**: The prompt likely instructs the agent to "Always follow the Notepad/Memories". When the Notepad says "Shelter is the ONLY priority," the agent interprets this literally, overriding basic survival logic (eating/heating) even when acknowledging death is imminent.

#### 2. Cost-Inventory Conflation (The "Matching" Hallucination)

Agents confuse "Missing Amount" with "Required Amount" or "Current Inventory".

- **Evidence**:
  - [15:15:30] **Ada**: Inventory: `{ wood: 5, stone: 3 }`. Readiness: `CAN_BUILD_CAMPFIRE: NO (Missing: 5)`.
  - **Reasoning**: "Feasibility calculation confirms I have the required materials (**5 wood**, 2 stone)."
- **Diagnosis**: The agent sees "Missing: 5" and "Inventory: 5" and hallucinates that the _Cost_ is 5, leading to a false positive "I can build" state. It resolves the cognitive dissonance of "NO" readiness by changing the math in its head to make "YES" true.

#### 3. The "Phantom Build" (Execution Silent Failure)

Agents repeatedly plan to `BUILD` but the action has no effect.

- **Evidence**:
  - [15:14:52] **Ada**: Inventory `{Wood: 5, Stone: 3}`. Plan: `[BUILD campfire]`.
  - [15:14:58] **Ada**: Inventory `{Wood: 5, Stone: 3}`. Still planning to build.
  - The inventory is not consumed, the state does not change.
- **Diagnosis**: The `BUILD` action is likely failing silently in the backend (e.g., due to specific location requirements, distance checks, or invalid arguments) and not reporting the failure to the agent's context, causing a loop of "Plan Build -> Fail -> Plan Build".

### Recommendations for Phase 6 (Priority & Execution Fixes)

1.  **Survival Override**: The System Prompt must explicitly state: "IF Stats are DYING, YOU MUST IGNORE THE NOTEPAD AND SURVIVE."
2.  **Explicit Cost vs. Missing**: The `buildingReadiness` string is confusing the model. Change format to: `Campfire (Cost: 10w, 3s | Have: 5w, 3s | MISSING: 5w)`.
3.  **Action Feedback**: The agent needs to know _why_ an action failed. If `BUILD` fails, the next tick's Context must include `ActionResult: FAILED (Reason: No valid location nearby)`.
4.  **Backend Debug**: Investigate `Build` action. Does it require a target location? Is it target-less? Why does it fail silently?
5.  **Disable/Reset Notepad**: Temporarily disable or clear the Notepad injection to break the "Cultist" feedback loop and force agents to rely on immediate sensor data (Stats/Perception) for survival.

## Iteration 5: The "Survival Instinct" & Persistent Ghosts (Phase 6 Analysis)

**Session**: Round 7 (Logs: `session_2025-12-29_07-54-51.log`)
**Changes Active**: Dead Code Removal (actions.js), Notepad Deletion, Explicit Cost Strings (`YES (Cost: 10w...)`), Strategic Failure Context.

### Status Overview

- **Stability**: **EXCELLENT**. No crashes. System runs smoothly without `actions.js`.
- **Hallucination (Inventory)**: **SOLVED**. Explicit strings (`Have: 30w`) seem to have stopped agents from lying about materials.
- **Prioritization**: **FAILED**. Agents still choose complex solutions (Build) over immediate ones (Eat) when dying.

### Critical Behavioral Findings

#### 1. The "Ghost Resource" Paralysis

Agents get stuck trying to harvest resources that no longer exist.

- **Observation**: User noted agents trying to harvest "tree X" that was already depleted.
- **Diagnosis**: The **Tactical Plan** is a static list (`["HARVEST tree_1", "HARVEST tree_1"]`). If `tree_1` is depleted during step 1 (or by another agent), step 2 fails.
- **Fix**: The `BehaviorTree`'s `MoveToNode` and `HarvestNode` must re-validate the target's existence _before_ executing. If invalid, they should fail fast (or repath to nearest of type).

#### 2. The "Campfire Obsession" (Redundant Building)

Agents build a campfire, then immediately plan to build _another_ one.

- **Evidence**: Agents standing next to a campfire still goal `BUILD_CAMPFIRE`.
- **Diagnosis**:
  1.  **Readiness Signal**: `buildingReadiness` says `CAN_BUILD_CAMPFIRE: YES`. The LLM interprets "YES" as "I SHOULD".
  2.  **Blindness**: The Prompt mentions "Nearby Campfires: 1", but the "Sanity Check" rule says "If CAN_BUILD is YES, you SHOULD goal to BUILD". This instruction overrides the context of already having one.
- **Fix**: Update `buildingReadiness` to say `SKIP (Already Built Nearby)` if a structure exists within range, OR update Prompt rules to "Only build if NONE nearby".

#### 3. Priority Misalignment (The "Starving Builder")

Agents prioritize Warmth (Building) over Hunger (Eating) even when Starving.

- **Evidence**:
  - [09:06:16] **Thea**: Hunger `0` (DYING). Warmth `40` (WARN).
  - **Goal**: `BUILD_CAMPFIRE`.
  - **Reasoning**: "I am dying from warmth <40... fastest way to restore."
- **Diagnosis**:
  - The LLM (Gemma 4b) conflates "Warning" (Warmth) with "Critical" (Hunger).
  - It views "Building" as a high-value action that solves problems, whereas "Eating" is mundane.
  - The Prompt's "Survival Override" was not strong enough to break this "Builder" persona.
- **Conclusion**: Small models struggle with multi-variable utility calculus. We need a hierarchy of needs that _forces_ the decision before the LLM even "thinks" (e.g., Code-based override for Critical Hunger), or a smarter model.

### Recommendations for Iteration 6

1.  **Runtime Target Validation**: Modify `BehaviorTree` nodes to check `findTarget()` result. If null, verify if `resourceNodes` has a replacement or return `FAILURE` immediately.
2.  **Smart Readiness**: Change `CAN_BUILD_CAMPFIRE` to `NO (Already Built Nearby)` if `nearbyBuildings > 0`. Don't tempt the LLM.
3.  **Hard-Coded Survival Reflex**: If `Hunger < 10`, force the `Strategic Goal` to `SURVIVE` / `GATHER_FOOD` via code in `server.js` before even calling the LLM? (Or make the Prompt's "System Instructions" extremely aggressive: "IF HUNGER < 10, YOU ARE BANNED FROM BUILDING").

## Iteration 6: The Berry Paradox & The Warmth Trap (Phase 7 Analysis)

**Session**: Round 8 (Logs: `session_2025-12-29_08-37-23.log`)
**Changes Active**: Global Perception, Lizard Brain, Strict Movement.

### Status Overview

- **Stability**: **EXCELLENT**. No crashes.
- **Survival**: **IMPROVED**. Agents eat when dying (Lizard Brain works).
- **Logic**: **FLAWED**. Critical hallucinations regarding item interaction and stat effects.

### Critical Behavioral Findings

#### 1. The "Berry Telekinesis" (Missing Harvest Step)

Agents plan to eat berries they don't have.

- **Observation**: Tactical Plan: `["MOVE_TO berry_31", "EAT berry_31"]`.
- **Result**: Agent moves to bush, then tries to eat. `Action EAT failed: Item berry not in inventory`.
- **Diagnosis**: The LLM assumes `MOVE_TO` an interactable implies "picking it up" or that it can eat directly from the bush (like a grazing animal). It skips the explicit `HARVEST` step.
- **Fix**:
  - **Prompt Engineering**: Explicitly instruct: "You CANNOT eat from the ground. You must HARVEST first."
  - **Behavior Tree Correction**: Update `EatNode` to check `CanConsume`. If item missing but `IsNear(source)`, trigger a sub-routine or fail with specific message "HARVEST FIRST".

#### 2. The "Warmth Trap" (Campfire Hunger Hallucination)

Agents think Campfires cure Hunger.

- **Observation**:
  - **Kira**: "My Hunger is WARN (62)... Primary goal is to build a campfire."
- **Diagnosis**:
  - **Association**: The model associates "Campfire" with "Cooking" -> "Food" -> "Hunger".
  - **Missing Feature**: We have no cooking logic, so the campfire _only_ provides warmth. The agent is planning for a feature that doesn't exist.
- **Fix**:
  - **Prompt Clarity**: Explicitly state in World Rules: "CAMPFIRES DO NOT PROVIDE FOOD. THEY ONLY PROVIDE WARMTH."
  - **Remove Distractions**: Ensure no "Meat" or "Cooking" references exist in prompts/recipes.

#### 3. Inefficient Gluttony (The "Grazer" Syndrome)

Agents walk to berries to eat them, even if they have berries in their pocket.

- **Observation**: Agent has 3 berries. Sees a bush 10m away. Plan: `MOVE_TO bush`, `EAT`.
- **Diagnosis**: The LLM perceives the "Berry Bush" as the _source_ of the `EAT` action, ignoring the abstract inventory.
- **Fix**:
  - **Logic**: If `Goal == EAT` and `Inventory > 0`, the Tactical Plan should probably be `["EAT"]` (Instant), not `MOVE_TO`.
  - This requires the Tactical Prompt to remind the agent: "CHECK INVENTORY FIRST. If you have food, just EAT it. Do not walk."

### Recommendations for Iteration 7

1.  **Prompt Hardening**: "HARVEST before EAT", "CAMPFIRE != FOOD", "CHECK INVENTORY".
2.  **Smart Eat Node**: Modify `EatNode` to be smarter (optional) or rely on Prompt Instructions.
3.  **Code Cleanup**: Verify `recipes` or `items` don't mention cooked meat to stop the cooking hallucination.
