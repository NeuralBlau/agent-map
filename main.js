import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls';
// (Tween.js removed for reliable custom movement)

// Scene setup
const scene = new THREE.Scene();
scene.background = new THREE.Color(0x0a0a0a);
scene.fog = new THREE.Fog(0x0a0a0a, 10, 50);

const camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000);
camera.position.set(15, 15, 15);

const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.setPixelRatio(window.devicePixelRatio);
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
document.getElementById('app').appendChild(renderer.domElement);

// Controls
const controls = new OrbitControls(camera, renderer.domElement);
controls.enableDamping = true;
controls.dampingFactor = 0.05;

// Lighting
const ambientLight = new THREE.AmbientLight(0xffffff, 0.4);
scene.add(ambientLight);

const directionalLight = new THREE.DirectionalLight(0xa0ff90, 1.2);
directionalLight.position.set(5, 15, 5);
directionalLight.castShadow = true;
directionalLight.shadow.mapSize.width = 2048;
directionalLight.shadow.mapSize.height = 2048;
scene.add(directionalLight);

// Ground
const groundGeometry = new THREE.PlaneGeometry(100, 100);
const groundMaterial = new THREE.MeshStandardMaterial({
  color: 0x1a1a1a,
  roughness: 0.8,
  metalness: 0.2
});
const ground = new THREE.Mesh(groundGeometry, groundMaterial);
ground.rotation.x = -Math.PI / 2;
ground.receiveShadow = true;
scene.add(ground);

const grid = new THREE.GridHelper(40, 40, 0x444444, 0x222222);
scene.add(grid);

// Environment Deco
function createTree(x, z) {
  const tree = new THREE.Group();
  const trunkGeo = new THREE.CylinderGeometry(0.2, 0.2, 1);
  const trunkMat = new THREE.MeshStandardMaterial({ color: 0x4d2902 });
  const trunk = new THREE.Mesh(trunkGeo, trunkMat);
  trunk.position.y = 0.5;
  trunk.castShadow = true;
  tree.add(trunk);

  const leavesGeo = new THREE.DodecahedronGeometry(0.8);
  const leavesMat = new THREE.MeshStandardMaterial({ color: 0x1a4d1a });
  const leaves = new THREE.Mesh(leavesGeo, leavesMat);
  leaves.position.y = 1.3;
  leaves.castShadow = true;
  tree.add(leaves);

  tree.position.set(x, 0, z);
  scene.add(tree);
}

function createRock(x, z) {
  const rockGeo = new THREE.IcosahedronGeometry(0.4, 0);
  const rockMat = new THREE.MeshStandardMaterial({ color: 0x444444 });
  const rock = new THREE.Mesh(rockGeo, rockMat);
  rock.scale.set(Math.random() + 0.5, Math.random() + 0.5, Math.random() + 0.5);
  rock.position.set(x, 0.2, z);
  rock.rotation.set(Math.random(), Math.random(), Math.random());
  rock.castShadow = true;
  scene.add(rock);
}

for (let i = 0; i < 15; i++) {
  createTree(Math.random() * 40 - 20, Math.random() * 40 - 20);
  createRock(Math.random() * 40 - 20, Math.random() * 40 - 20);
}

// Agents
const agents = [];
let currentWhisper = null; // Global whisper to be consumed by agents
function createAgent(name, color, startPos) {
  const agentGroup = new THREE.Group();
  const body = new THREE.Mesh(
    new THREE.BoxGeometry(1, 1, 1),
    new THREE.MeshStandardMaterial({ color: color, emissive: color, emissiveIntensity: 0.2 })
  );
  body.position.y = 0.5;
  body.castShadow = true;
  agentGroup.add(body);

  const eyeGeo = new THREE.BoxGeometry(0.2, 0.2, 0.1);
  const eyeMat = new THREE.MeshBasicMaterial({ color: 0x000000 });
  const e1 = new THREE.Mesh(eyeGeo, eyeMat); e1.position.set(0.25, 0.7, 0.5);
  const e2 = new THREE.Mesh(eyeGeo, eyeMat); e2.position.set(-0.25, 0.7, 0.5);
  agentGroup.add(e1, e2);

  agentGroup.position.copy(startPos);
  scene.add(agentGroup);
  return {
    name,
    group: agentGroup,
    isThinking: false,
    targetPos: startPos.clone(),
    moveSpeed: 0.15,
    state: 'IDLE', // IDLE, MOVING, THINKING
    hunger: 100,
    hungerBar: createHungerBar(agentGroup),
    eatingSeed: null, // Temporary ref for shrink animation
    lastActionTime: Date.now(),
    stuckTimer: 0 // Guard against freezing
  };
}

function createHungerBar(parent) {
  const geo = new THREE.PlaneGeometry(1, 0.1);
  const mat = new THREE.MeshBasicMaterial({ color: 0x00ff00, side: THREE.DoubleSide });
  const bar = new THREE.Mesh(geo, mat);
  bar.position.y = 1.5;
  parent.add(bar);
  return bar;
}

agents.push(createAgent('Pioneer', 0xa0ff90, new THREE.Vector3(2, 0, 2)));
agents.push(createAgent('Settler', 0x90a0ff, new THREE.Vector3(-2, 0, -2)));

// Seeds
const seeds = [];
function createSeed(id, x, z) {
  const seed = new THREE.Mesh(
    new THREE.IcosahedronGeometry(0.3, 0),
    new THREE.MeshStandardMaterial({ color: 0xffd700, emissive: 0xffd700, emissiveIntensity: 0.5 })
  );
  seed.position.set(x, 0.3, z);
  seed.castShadow = true;
  seed.userData = { id };
  scene.add(seed);
  seeds.push(seed);
}

createSeed('seed_01', 8, 8);
createSeed('seed_02', -10, 5);
createSeed('seed_03', 4, -12);
createSeed('seed_04', -5, -5);

// Rendering / Animation
function animate() {
  requestAnimationFrame(animate);
  const now = Date.now();

  // Smooth Movement for Agents
  agents.forEach(agent => {
    const pos = agent.group.position;
    const target = agent.targetPos;
    const dist = pos.distanceTo(target);

    // 0. Stuck Watchdog: If in MOVING state for too long (>15s), force IDLE
    if (agent.state === 'MOVING') {
      agent.stuckTimer += 0.016; // Approx 60fps
      if (agent.stuckTimer > 15) {
        console.warn(`[Watchdog] ${agent.name} was stuck. Forcing IDLE.`);
        agent.state = 'IDLE';
        agent.stuckTimer = 0;
        setTimeout(() => brainLoop(agent), 500);
      }
    } else {
      agent.stuckTimer = 0;
    }

    // 1. Movement & Rotation Logic
    if (dist > 0.1) {
      agent.state = 'MOVING';
      // Smooth lookAt (Interpolated)
      const lookTarget = new THREE.Vector3(target.x, pos.y, target.z);
      const currentRotation = agent.group.quaternion.clone();
      agent.group.lookAt(lookTarget);
      const targetRotation = agent.group.quaternion.clone();
      agent.group.quaternion.copy(currentRotation);
      agent.group.quaternion.slerp(targetRotation, 0.1);

      // Move toward
      const direction = new THREE.Vector3().subVectors(target, pos).normalize();
      pos.add(direction.multiplyScalar(agent.moveSpeed));
    } else {
      if (agent.state === 'MOVING') {
        pos.copy(target);
        agent.state = 'IDLE';
        console.log(`[Movement] ${agent.name} reached target.`);
        // Reactive Trigger: Think when you finish moving
        setTimeout(() => brainLoop(agent), 500);
      }
    }

    // 2. Idle Animation (Breath/Bob)
    if (agent.state === 'IDLE' || agent.state === 'THINKING') {
      const bob = Math.sin(now * 0.003) * 0.05;
      agent.group.children[0].position.y = 0.5 + bob;

      // Thinking indicator (Subtle scale pulse)
      if (agent.state === 'THINKING') {
        const pulse = 1 + Math.sin(now * 0.01) * 0.05;
        agent.group.scale.set(pulse, pulse, pulse);
      } else {
        agent.group.scale.set(1, 1, 1);
      }
    }

    // 3. Metabolism & Hunger (Decay)
    if (now % 3000 < 20) { // Approx every 3s
      agent.hunger = Math.max(0, agent.hunger - 1.5);
      const hRatio = agent.hunger / 100;
      agent.hungerBar.scale.x = hRatio;
      agent.hungerBar.material.color.setHSL(hRatio * 0.3, 1, 0.5); // Green to Red

      if (agent.hunger < 20) agent.moveSpeed = 0.08; // Starving slows down
      else agent.moveSpeed = 0.15;
    }

    // 4. Eating Animation (Shrink & Pull)
    if (agent.eatingSeed) {
      const seed = agent.eatingSeed;
      seed.scale.multiplyScalar(0.9);
      seed.position.lerp(new THREE.Vector3(0, 0.5, 0), 0.1);
      if (seed.scale.x < 0.05) {
        agent.group.remove(seed);
        agent.eatingSeed = null;
        agent.hunger = Math.min(100, agent.hunger + 30);
        console.log(`[Metabolism] ${agent.name} fully absorbed seed.`);
      }
    }
  });

  // 5. Seed Respawn System
  if (seeds.filter(s => s.parent === scene).length < 3 && Math.random() < 0.01) {
    const x = (Math.random() - 0.5) * 30;
    const z = (Math.random() - 0.5) * 30;
    createSeed(`seed_gen_${Date.now()}`, x, z);
    addLog(`A new golden seed has emerged in the wild.`, 'system');
  }

  // Subtle float for seeds
  seeds.forEach(s => {
    if (s.parent === scene) {
      s.position.y = 0.3 + Math.sin(Date.now() * 0.002 + s.position.x) * 0.1;
      s.rotation.y += 0.01;
    }
  });

  controls.update();
  renderer.render(scene, camera);
}

window.addEventListener('resize', () => {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
});

// Logs
function addLog(text, type = 'system') {
  const logs = document.getElementById('brain-logs');
  if (!logs) return;
  const entry = document.createElement('div');
  entry.className = `log-entry ${type}`;
  entry.innerText = `[${new Date().toLocaleTimeString()}] ${text}`;
  logs.prepend(entry);
}

// AI Infrastructure
const AGENT_CONFIG = {
  decisionInterval: 5000,
  interactionDistance: 2.0 // Slightly more forgiving distance
};

function serializeWorldState(subject) {
  const state = {
    agent: {
      name: subject.name,
      position: [subject.group.position.x, 0, subject.group.position.z],
      hunger: subject.hunger.toFixed(0)
    },
    others: agents.filter(a => a !== subject).map(a => ({ name: a.name, position: [a.group.position.x, 0, a.group.position.z] })),
    objects: seeds.filter(s => s.parent === scene).map(s => ({
      id: s.userData.id,
      type: 'seed',
      position: [s.position.x, 0, s.position.z],
      dist: subject.group.position.distanceTo(s.position).toFixed(2)
    }))
  };

  if (currentWhisper) {
    state.god_whisper = currentWhisper;
  }

  return state;
}

function executeAction(agent, decision) {
  const { action, target, targetId, thought } = decision;
  addLog(`${agent.name}: ${thought}`, 'llm');

  if (action === 'MOVE_TO' && target) {
    const targetVec = (Array.isArray(target))
      ? new THREE.Vector3(target[0], 0, target[2])
      : new THREE.Vector3(target.x || 0, 0, target.z || 0);
    moveAgent(agent, targetVec);
  } else if (action === 'PICK_UP') {
    pickUp(agent, targetId || target);
    // After picking up, we always transition to a state that triggers brainLoop
  } else if (action === 'WAIT') {
    const duration = decision.duration || 3000;
    setTimeout(() => brainLoop(agent), duration);
  } else {
    // Unknown action, fallback
    setTimeout(() => brainLoop(agent), 1000);
  }
}

function moveAgent(agent, targetPos) {
  agent.targetPos.copy(targetPos);
  console.log(`[Movement] ${agent.name} target set:`, targetPos);
}

function pickUp(agent, targetId) {
  const seed = seeds.find(s => s.userData.id === targetId && s.parent === scene);
  if (!seed) {
    addLog(`${agent.name}: Target seed ${targetId} is gone.`, 'system');
    setTimeout(() => brainLoop(agent), 500);
    return;
  }

  const dist = agent.group.position.distanceTo(seed.position);
  if (dist < AGENT_CONFIG.interactionDistance) {
    scene.remove(seed);
    agent.group.add(seed);
    seed.position.set(0, 1.2, 0);
    seed.rotation.set(0, 0, 0);
    agent.eatingSeed = seed;
    agent.state = 'EATING';
    addLog(`${agent.name} is consuming ${targetId}...`, 'system');

    // Auto-transition to IDLE after a short delay to trigger next thought
    setTimeout(() => {
      agent.state = 'IDLE';
      brainLoop(agent);
    }, 500);
  } else {
    addLog(`${agent.name} is too far from ${targetId}. Moving closer.`, 'system');
    moveAgent(agent, new THREE.Vector3(seed.position.x, 0, seed.position.z));
  }
}

async function brainLoop(agent) {
  if (agent.state === 'THINKING' || agent.isThinking) return;
  agent.state = 'THINKING';
  agent.isThinking = true;
  try {
    const state = serializeWorldState(agent);
    const res = await fetch('http://localhost:3000/decide', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ state, agentName: agent.name })
    });
    const decision = await res.json();
    executeAction(agent, decision);
  } catch (e) {
    console.error(e);
    agent.state = 'IDLE';
  }
  finally {
    agent.isThinking = false;
    // Do not set IDLE here if we already triggered a MOVE
  }
}

window.game = {
  addLog,
  scene,
  agents,
  seeds,
  testMove: () => {
    addLog('Manual movement test initiated.', 'system');
    agents.forEach(a => {
      const target = new THREE.Vector3(
        (Math.random() - 0.5) * 20,
        0,
        (Math.random() - 0.5) * 20
      );
      moveAgent(a, target);
    });
  },
  startAI: () => {
    addLog('Universal Intelligence activated. Survival protocols online.', 'system');
    agents.forEach((a) => {
      brainLoop(a);
      setInterval(() => {
        if (a.state === 'IDLE') brainLoop(a);
      }, 5000);
    });
  },
  whisper: () => {
    const input = document.getElementById('whisper-input');
    const msg = input.value.trim();
    if (msg) {
      currentWhisper = msg;
      addLog(`God whispers: "${msg}"`, 'system');
      input.value = '';
      // Clear whisper after 30 seconds so agents have more time to process
      setTimeout(() => { if (currentWhisper === msg) currentWhisper = null; }, 30000);
    }
  }
};

animate();
addLog('Vast world initialized. Multiple explorers standing by.', 'system');
addLog('Type window.game.startAI() to begin.', 'system');
