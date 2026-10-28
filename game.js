/**
 * PRISON ESCAPE: 3D Pixel Breakout
 * A 3D chasing typing game with voxel characters, jumping obstacles, combos & adrenaline power-up!
 */
import './styles.css';
import * as THREE from 'three';
import { CSS2DRenderer, CSS2DObject } from 'three/examples/jsm/renderers/CSS2DRenderer.js';

// --- Obstacle Word Bank (Action / Escape theme) ---
const WORD_BANK = [
  "JUMP", "DODGE", "LEAP", "VAULT", "SPRINT", "ESCAPE", "RUN", "DUCK",
  "SPEED", "RUSH", "FENCE", "CLIMB", "FREEDOM", "DASH", "BURST", "ALARM",
  "GUARD", "TUNNEL", "SHADOW", "BREAK", "CHARGE", "QUICK", "REFLEX", "HURDLE",
  "WIRE", "WALL", "SEARCH", "SIREN", "LOCK", "YARD", "GATE", "SNIPER"
];

// --- Game Constants ---
const INITIAL_COP_DISTANCE = 12.0; // Starting gap in meters
const MIN_COP_DISTANCE = 1.0;      // Busted threshold
const BASE_SPEED = 0.55;           // Normal running speed
const OBSTACLE_SPACING = 36;       // Distance between obstacles
const MAX_OBSTACLES = 4;           // Obstacles tracked ahead

// --- Global Engine Variables ---
let scene, camera, renderer, labelRenderer;
let prisonerGroup, copGroup;
let prisonerLimbs = {}, copLimbs = {};
let roadGrid, leftWall, rightWall, searchlights = [];
let copSirenLightRed, copSirenLightBlue;

// --- Gameplay State ---
let isPlaying = false;
let isAdrenalineActive = false;
let adrenalineTimer = 0;
let distanceEscaped = 0;
let copDistance = INITIAL_COP_DISTANCE;
let playerSpeed = BASE_SPEED;
let currentSpeed = BASE_SPEED;

// Jump & Stumble Animation State
let isJumping = false;
let jumpTimer = 0;
const JUMP_DURATION = 0.55; // seconds
let isStumbling = false;
let stumbleTimer = 0;

// Typing & Combos
let activeObstacles = [];
let targetObstacle = null;
let currentTypedText = "";
let comboCount = 0;
let maxCombo = 0;
let powerMeter = 0; // 0 to 100%

// Stats
let totalTypedChars = 0;
let correctTypedChars = 0;
let startTime = 0;
let lastFrameTime = performance.now();
let runCycle = 0;

// Web Audio API
let audioCtx = null;

// --- Initialize Engine ---
function init() {
  const container = document.getElementById("game-container");
  if (!container) return;
  container.innerHTML = "";

  // 1. Scene & Fog
  scene = new THREE.Scene();
  scene.background = new THREE.Color(0x04060d);
  scene.fog = new THREE.FogExp2(0x04060d, 0.018);

  // 2. Camera (Behind & Above Player, looking forward)
  camera = new THREE.PerspectiveCamera(65, window.innerWidth / window.innerHeight, 0.1, 800);
  camera.position.set(0, 3.8, 6.5);
  camera.lookAt(0, 1.8, -10);

  // 3. WebGL Renderer
  renderer = new THREE.WebGLRenderer({ antialias: true });
  renderer.setSize(window.innerWidth, window.innerHeight);
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  renderer.shadowMap.enabled = true;
  container.appendChild(renderer.domElement);

  // 4. CSS2D Renderer (HTML Labels for 3D Word Badges)
  labelRenderer = new CSS2DRenderer();
  labelRenderer.setSize(window.innerWidth, window.innerHeight);
  labelRenderer.domElement.style.position = 'absolute';
  labelRenderer.domElement.style.top = '0px';
  labelRenderer.domElement.style.left = '0px';
  labelRenderer.domElement.style.width = '100%';
  labelRenderer.domElement.style.height = '100%';
  labelRenderer.domElement.style.pointerEvents = 'none';
  labelRenderer.domElement.style.zIndex = '10';
  container.appendChild(labelRenderer.domElement);

  // 5. Lighting
  const ambientLight = new THREE.AmbientLight(0xffffff, 0.45);
  scene.add(ambientLight);

  const moonLight = new THREE.DirectionalLight(0x7799cc, 0.7);
  moonLight.position.set(20, 40, -30);
  scene.add(moonLight);

  // 6. Build 3D World (Prison yard, walls, searchlights)
  createPrisonEnvironment();

  // 7. Build Voxel Characters
  prisonerGroup = createPrisonerCharacter();
  copGroup = createCopCharacter();

  prisonerGroup.position.set(0, 0, 0);
  copGroup.position.set(0, 0, INITIAL_COP_DISTANCE);
  scene.add(prisonerGroup);
  scene.add(copGroup);

  // Event Listeners
  window.addEventListener("resize", onWindowResize);
  window.addEventListener("keydown", handleKeyDown);

  const startBtn = document.getElementById("start-btn");
  if (startBtn) {
    startBtn.addEventListener("click", startGame);
  }

  // Modal Close Button (preview live 3D yard)
  const modalCloseBtn = document.getElementById("modal-close-btn");
  if (modalCloseBtn) {
    modalCloseBtn.addEventListener("click", dismissModalToPreview);
  }

  // Backdrop click-outside to dismiss to preview
  const overlay = document.getElementById("overlay");
  if (overlay) {
    overlay.addEventListener("click", (e) => {
      if (e.target === overlay) {
        dismissModalToPreview();
      }
    });
  }

  // Floating Scene Preview FAB button (quick launch / reopen)
  const previewFab = document.getElementById("preview-fab");
  if (previewFab) {
    previewFab.addEventListener("click", startGame);
  }

  // Start Render Loop
  lastFrameTime = performance.now();
  animate();
}

// ==========================================
// 3D VOXEL MODELS & ENVIRONMENT
// ==========================================

/**
 * Creates pixelated / voxel prisoner in orange/white striped jumpsuit.
 */
function createPrisonerCharacter() {
  const group = new THREE.Group();

  // Material helpers (flatShading gives authentic pixelated/low-poly look)
  const skinMat = new THREE.MeshLambertMaterial({ color: 0xffcc99, flatShading: true });
  const hairMat = new THREE.MeshLambertMaterial({ color: 0x3a2211, flatShading: true });
  const orangeMat = new THREE.MeshLambertMaterial({ color: 0xff6600, flatShading: true });
  const whiteMat = new THREE.MeshLambertMaterial({ color: 0xeeeeee, flatShading: true });
  const shoeMat = new THREE.MeshLambertMaterial({ color: 0x222222, flatShading: true });

  // 1. Head
  const head = new THREE.Mesh(new THREE.BoxGeometry(0.55, 0.55, 0.55), skinMat);
  head.position.y = 1.9;
  group.add(head);

  // Hair
  const hair = new THREE.Mesh(new THREE.BoxGeometry(0.58, 0.22, 0.58), hairMat);
  hair.position.set(0, 2.12, 0);
  group.add(hair);

  // 2. Torso (Striped Prison Jumpsuit)
  const torsoGroup = new THREE.Group();
  torsoGroup.position.y = 1.25;

  const stripe1 = new THREE.Mesh(new THREE.BoxGeometry(0.7, 0.22, 0.4), orangeMat);
  stripe1.position.y = 0.24;
  const stripe2 = new THREE.Mesh(new THREE.BoxGeometry(0.7, 0.22, 0.4), whiteMat);
  stripe2.position.y = 0.02;
  const stripe3 = new THREE.Mesh(new THREE.BoxGeometry(0.7, 0.22, 0.4), orangeMat);
  stripe3.position.y = -0.2;

  torsoGroup.add(stripe1);
  torsoGroup.add(stripe2);
  torsoGroup.add(stripe3);
  group.add(torsoGroup);

  // 3. Arms (Pivot from shoulders)
  const armGeo = new THREE.BoxGeometry(0.2, 0.65, 0.22);

  const leftArmPivot = new THREE.Group();
  leftArmPivot.position.set(-0.48, 1.5, 0);
  const leftArm = new THREE.Mesh(armGeo, orangeMat);
  leftArm.position.y = -0.3;
  leftArmPivot.add(leftArm);
  group.add(leftArmPivot);

  const rightArmPivot = new THREE.Group();
  rightArmPivot.position.set(0.48, 1.5, 0);
  const rightArm = new THREE.Mesh(armGeo, orangeMat);
  rightArm.position.y = -0.3;
  rightArmPivot.add(rightArm);
  group.add(rightArmPivot);

  // 4. Legs (Pivot from hips)
  const legGeo = new THREE.BoxGeometry(0.25, 0.7, 0.25);

  const leftLegPivot = new THREE.Group();
  leftLegPivot.position.set(-0.2, 0.85, 0);
  const leftLeg = new THREE.Mesh(legGeo, whiteMat);
  leftLeg.position.y = -0.35;
  const leftShoe = new THREE.Mesh(new THREE.BoxGeometry(0.27, 0.16, 0.35), shoeMat);
  leftShoe.position.set(0, -0.65, -0.05);
  leftLegPivot.add(leftLeg);
  leftLegPivot.add(leftShoe);
  group.add(leftLegPivot);

  const rightLegPivot = new THREE.Group();
  rightLegPivot.position.set(0.2, 0.85, 0);
  const rightLeg = new THREE.Mesh(legGeo, orangeMat);
  rightLeg.position.y = -0.35;
  const rightShoe = new THREE.Mesh(new THREE.BoxGeometry(0.27, 0.16, 0.35), shoeMat);
  rightShoe.position.set(0, -0.65, -0.05);
  rightLegPivot.add(rightLeg);
  rightLegPivot.add(rightShoe);
  group.add(rightLegPivot);

  prisonerLimbs = {
    leftArmPivot,
    rightArmPivot,
    leftLegPivot,
    rightLegPivot,
    torsoGroup
  };

  return group;
}

/**
 * Creates pixelated / voxel police officer with flashing red/blue siren light!
 */
function createCopCharacter() {
  const group = new THREE.Group();

  const skinMat = new THREE.MeshLambertMaterial({ color: 0xeebb99, flatShading: true });
  const policeNavy = new THREE.MeshLambertMaterial({ color: 0x142850, flatShading: true });
  const darkPants = new THREE.MeshLambertMaterial({ color: 0x0c1b33, flatShading: true });
  const goldMat = new THREE.MeshLambertMaterial({ color: 0xffcc00, flatShading: true });
  const blackVisor = new THREE.MeshLambertMaterial({ color: 0x111111, flatShading: true });

  // 1. Head
  const head = new THREE.Mesh(new THREE.BoxGeometry(0.6, 0.6, 0.6), skinMat);
  head.position.y = 2.0;
  group.add(head);

  // Police Peaked Cap
  const capBase = new THREE.Mesh(new THREE.BoxGeometry(0.66, 0.25, 0.66), policeNavy);
  capBase.position.set(0, 2.32, 0);
  const capVisor = new THREE.Mesh(new THREE.BoxGeometry(0.68, 0.08, 0.3), blackVisor);
  capVisor.position.set(0, 2.22, -0.35);
  const badge = new THREE.Mesh(new THREE.BoxGeometry(0.14, 0.14, 0.05), goldMat);
  badge.position.set(0, 2.33, -0.34);

  group.add(capBase);
  group.add(capVisor);
  group.add(badge);

  // Flashing Police Beacon Sirens on Shoulder/Cap
  const redBeacon = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.12, 0.12), new THREE.MeshBasicMaterial({ color: 0xff0022 }));
  redBeacon.position.set(-0.25, 2.45, 0);
  const blueBeacon = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.12, 0.12), new THREE.MeshBasicMaterial({ color: 0x0066ff }));
  blueBeacon.position.set(0.25, 2.45, 0);
  group.add(redBeacon);
  group.add(blueBeacon);

  // Dynamic Point Lights for Red / Blue Siren Flashing
  copSirenLightRed = new THREE.PointLight(0xff0022, 2.5, 14);
  copSirenLightRed.position.set(-0.3, 2.6, 0);
  group.add(copSirenLightRed);

  copSirenLightBlue = new THREE.PointLight(0x0066ff, 2.5, 14);
  copSirenLightBlue.position.set(0.3, 2.6, 0);
  group.add(copSirenLightBlue);

  // 2. Torso
  const torso = new THREE.Mesh(new THREE.BoxGeometry(0.8, 0.8, 0.45), policeNavy);
  torso.position.y = 1.35;
  const chestBadge = new THREE.Mesh(new THREE.BoxGeometry(0.15, 0.18, 0.05), goldMat);
  chestBadge.position.set(0.2, 1.45, -0.24);
  const belt = new THREE.Mesh(new THREE.BoxGeometry(0.82, 0.15, 0.47), blackVisor);
  belt.position.y = 0.98;

  group.add(torso);
  group.add(chestBadge);
  group.add(belt);

  // 3. Arms
  const armGeo = new THREE.BoxGeometry(0.22, 0.7, 0.24);

  const leftArmPivot = new THREE.Group();
  leftArmPivot.position.set(-0.52, 1.6, 0);
  const leftArm = new THREE.Mesh(armGeo, policeNavy);
  leftArm.position.y = -0.35;
  // Baton in hand
  const baton = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.04, 0.7), blackVisor);
  baton.position.set(0, -0.65, -0.2);
  baton.rotation.x = Math.PI / 3;
  leftArmPivot.add(leftArm);
  leftArmPivot.add(baton);
  group.add(leftArmPivot);

  const rightArmPivot = new THREE.Group();
  rightArmPivot.position.set(0.52, 1.6, 0);
  const rightArm = new THREE.Mesh(armGeo, policeNavy);
  rightArm.position.y = -0.35;
  rightArmPivot.add(rightArm);
  group.add(rightArmPivot);

  // 4. Legs
  const legGeo = new THREE.BoxGeometry(0.28, 0.75, 0.28);

  const leftLegPivot = new THREE.Group();
  leftLegPivot.position.set(-0.22, 0.9, 0);
  const leftLeg = new THREE.Mesh(legGeo, darkPants);
  leftLeg.position.y = -0.38;
  const leftBoot = new THREE.Mesh(new THREE.BoxGeometry(0.3, 0.2, 0.38), blackVisor);
  leftBoot.position.set(0, -0.7, -0.05);
  leftLegPivot.add(leftLeg);
  leftLegPivot.add(leftBoot);
  group.add(leftLegPivot);

  const rightLegPivot = new THREE.Group();
  rightLegPivot.position.set(0.22, 0.9, 0);
  const rightLeg = new THREE.Mesh(legGeo, darkPants);
  rightLeg.position.y = -0.38;
  const rightBoot = new THREE.Mesh(new THREE.BoxGeometry(0.3, 0.2, 0.38), blackVisor);
  rightBoot.position.set(0, -0.7, -0.05);
  rightLegPivot.add(rightLeg);
  rightLegPivot.add(rightBoot);
  group.add(rightLegPivot);

  copLimbs = {
    leftArmPivot,
    rightArmPivot,
    leftLegPivot,
    rightLegPivot
  };

  return group;
}

/**
 * Creates the prison yard runaway: walls, runway road, watchtowers, searchlights.
 */
function createPrisonEnvironment() {
  // Road / Runway (Infinite scrolling grid)
  const gridHelper = new THREE.GridHelper(300, 60, 0xff7700, 0x1f2e4d);
  gridHelper.position.set(0, -0.01, -80);
  roadGrid = gridHelper;
  scene.add(roadGrid);

  // Ground Asphalt Plane
  const roadGeo = new THREE.PlaneGeometry(16, 400);
  const roadMat = new THREE.MeshLambertMaterial({ color: 0x090c14 });
  const roadMesh = new THREE.Mesh(roadGeo, roadMat);
  roadMesh.rotation.x = -Math.PI / 2;
  roadMesh.position.z = -100;
  scene.add(roadMesh);

  // Runway Curb Lights (Orange glowing strips on edges)
  const curbGeo = new THREE.BoxGeometry(0.4, 0.2, 400);
  const curbMat = new THREE.MeshBasicMaterial({ color: 0xff6600 });
  const leftCurb = new THREE.Mesh(curbGeo, curbMat);
  leftCurb.position.set(-6, 0.1, -100);
  const rightCurb = new THREE.Mesh(curbGeo, curbMat);
  rightCurb.position.set(6, 0.1, -100);
  scene.add(leftCurb);
  scene.add(rightCurb);

  // High Prison Concrete Walls (Left & Right)
  const wallGeo = new THREE.BoxGeometry(1.5, 9, 400);
  const wallMat = new THREE.MeshLambertMaterial({ color: 0x151b29, flatShading: true });

  leftWall = new THREE.Mesh(wallGeo, wallMat);
  leftWall.position.set(-7.5, 4.5, -100);
  rightWall = new THREE.Mesh(wallGeo, wallMat);
  rightWall.position.set(7.5, 4.5, -100);
  scene.add(leftWall);
  scene.add(rightWall);

  // Watchtower Sweeping Searchlights
  for (let i = 0; i < 2; i++) {
    const light = new THREE.SpotLight(0xaaccff, 4, 70, Math.PI / 7, 0.4);
    const side = i === 0 ? -1 : 1;
    light.position.set(side * 8, 8, -40 - i * 50);
    const target = new THREE.Object3D();
    target.position.set(0, 0, -40 - i * 50);
    scene.add(target);
    light.target = target;
    scene.add(light);
    searchlights.push({ light, target, baseZ: -40 - i * 50, side });
  }
}

/**
 * Creates a pixelated 3D Obstacle with an attached floating CSS2D word badge!
 */
function createObstacle(zPos, word) {
  const obstacleGroup = new THREE.Group();

  // Obstacle geometry: Voxel Barricade / Razor Wire Barrier
  const woodMat = new THREE.MeshLambertMaterial({ color: 0x4a2a16, flatShading: true });
  const hazardMat = new THREE.MeshLambertMaterial({ color: 0xffaa00, flatShading: true });
  const darkHazardMat = new THREE.MeshLambertMaterial({ color: 0x111111, flatShading: true });
  const spikeMat = new THREE.MeshLambertMaterial({ color: 0x99aacc, flatShading: true });

  // Heavy Barrier Cross Beams
  const baseBeam = new THREE.Mesh(new THREE.BoxGeometry(5.2, 0.4, 0.5), woodMat);
  baseBeam.position.y = 0.25;
  const topBeam = new THREE.Mesh(new THREE.BoxGeometry(5.2, 0.4, 0.5), woodMat);
  topBeam.position.y = 1.05;

  // Hazard striped center plate
  const hazardPlate1 = new THREE.Mesh(new THREE.BoxGeometry(1.6, 0.6, 0.55), hazardMat);
  hazardPlate1.position.set(-1.2, 0.65, 0);
  const hazardPlate2 = new THREE.Mesh(new THREE.BoxGeometry(1.6, 0.6, 0.55), darkHazardMat);
  hazardPlate2.position.set(0.4, 0.65, 0);

  // Spikes protruding up
  for (let s = -2.2; s <= 2.2; s += 0.8) {
    const spike = new THREE.Mesh(new THREE.ConeGeometry(0.12, 0.5, 4), spikeMat);
    spike.position.set(s, 1.45, 0);
    obstacleGroup.add(spike);
  }

  obstacleGroup.add(baseBeam);
  obstacleGroup.add(topBeam);
  obstacleGroup.add(hazardPlate1);
  obstacleGroup.add(hazardPlate2);

  obstacleGroup.position.set(0, 0, zPos);
  scene.add(obstacleGroup);

  // Floating HTML Word Badge (via CSS2DRenderer)
  const badgeElem = document.createElement("div");
  badgeElem.className = "word-badge";
  badgeElem.innerHTML = `<span class="typed"></span><span class="untyped">${word}</span>`;

  const labelObj = new CSS2DObject(badgeElem);
  labelObj.position.set(0, 2.5, 0);
  obstacleGroup.add(labelObj);

  return {
    group: obstacleGroup,
    badgeElem: badgeElem,
    word: word,
    zPos: zPos,
    cleared: false
  };
}

// ==========================================
// SOUND SYNTHESIZER (Web Audio API)
// ==========================================
function playSfx(type) {
  try {
    if (!audioCtx) audioCtx = new (window.AudioContext || window.webkitAudioContext)();
    if (audioCtx.state === "suspended") audioCtx.resume();

    const now = audioCtx.currentTime;
    const osc = audioCtx.createOscillator();
    const gain = audioCtx.createGain();
    osc.connect(gain);
    gain.connect(audioCtx.destination);

    if (type === "key") {
      // Crisp mechanical key click
      osc.type = "sine";
      osc.frequency.setValueAtTime(600, now);
      osc.frequency.exponentialRampToValueAtTime(1100, now + 0.04);
      gain.gain.setValueAtTime(0.12, now);
      gain.gain.linearRampToValueAtTime(0.001, now + 0.04);
      osc.start(now);
      osc.stop(now + 0.04);
    } else if (type === "jump") {
      // Upbeat vault jump chime (low to high sweep)
      osc.type = "triangle";
      osc.frequency.setValueAtTime(320, now);
      osc.frequency.exponentialRampToValueAtTime(880, now + 0.18);
      gain.gain.setValueAtTime(0.25, now);
      gain.gain.linearRampToValueAtTime(0.001, now + 0.22);
      osc.start(now);
      osc.stop(now + 0.22);
    } else if (type === "stumble") {
      // Low crunch error/stumble thud
      osc.type = "sawtooth";
      osc.frequency.setValueAtTime(140, now);
      osc.frequency.linearRampToValueAtTime(45, now + 0.25);
      gain.gain.setValueAtTime(0.3, now);
      gain.gain.linearRampToValueAtTime(0.001, now + 0.25);
      osc.start(now);
      osc.stop(now + 0.25);
    } else if (type === "error") {
      // Typo buzzer
      osc.type = "sawtooth";
      osc.frequency.setValueAtTime(180, now);
      osc.frequency.linearRampToValueAtTime(110, now + 0.1);
      gain.gain.setValueAtTime(0.18, now);
      gain.gain.linearRampToValueAtTime(0.001, now + 0.1);
      osc.start(now);
      osc.stop(now + 0.1);
    } else if (type === "powerup") {
      // Adrenaline surge arpeggio
      const notes = [523.25, 659.25, 783.99, 1046.5]; // C5, E5, G5, C6
      notes.forEach((freq, idx) => {
        const subOsc = audioCtx.createOscillator();
        const subGain = audioCtx.createGain();
        subOsc.type = "triangle";
        subOsc.frequency.setValueAtTime(freq, now + idx * 0.07);
        subGain.gain.setValueAtTime(0.2, now + idx * 0.07);
        subGain.gain.linearRampToValueAtTime(0.001, now + idx * 0.07 + 0.15);
        subOsc.connect(subGain);
        subGain.connect(audioCtx.destination);
        subOsc.start(now + idx * 0.07);
        subOsc.stop(now + idx * 0.07 + 0.15);
      });
    } else if (type === "busted") {
      // Doom drop siren
      osc.type = "sawtooth";
      osc.frequency.setValueAtTime(350, now);
      osc.frequency.exponentialRampToValueAtTime(80, now + 0.6);
      gain.gain.setValueAtTime(0.4, now);
      gain.gain.linearRampToValueAtTime(0.001, now + 0.6);
      osc.start(now);
      osc.stop(now + 0.6);
    }
  } catch (err) {}
}

// ==========================================
// GAMEPLAY INPUT & TYPING LOGIC
// ==========================================

function handleKeyDown(e) {
  // When not currently playing (on modal or preview state)
  if (!isPlaying) {
    if (e.code === "Enter" || e.code === "NumpadEnter") {
      e.preventDefault();
      startGame();
      return;
    }
    if (e.code === "Space") {
      e.preventDefault();
      startGame();
      return;
    }
    if (e.code === "Escape") {
      e.preventDefault();
      toggleModalPreview();
      return;
    }
    return;
  }

  // SPACE key triggers Adrenaline Power-Up if gauge is full (100%)
  if (e.code === "Space") {
    e.preventDefault();
    if (powerMeter >= 100 && !isAdrenalineActive) {
      activateAdrenalineBoost();
    }
    return;
  }

  const key = e.key.toUpperCase();
  if (key.length !== 1 || key < "A" || key > "Z") return;

  totalTypedChars++;

  // Identify active target obstacle
  if (!targetObstacle && activeObstacles.length > 0) {
    targetObstacle = activeObstacles[0];
  }

  if (!targetObstacle) return;

  const nextCharIndex = currentTypedText.length;

  if (targetObstacle.word[nextCharIndex] === key) {
    // Correct letter!
    currentTypedText += key;
    correctTypedChars++;
    playSfx("key");
    updateObstacleBadgeUI(targetObstacle);
    updateActivePromptHUD(targetObstacle);

    // Check if whole word is completed
    if (currentTypedText === targetObstacle.word) {
      onWordCompletedSuccessfully(targetObstacle);
    }
  } else {
    // Typo!
    playSfx("error");
    // Minor stumble penalty
    onTypoMistake();
  }

  updateHUDStats();
}

/**
 * Called when player successfully types the obstacle's word.
 */
function onWordCompletedSuccessfully(obstacle) {
  obstacle.cleared = true;
  playSfx("jump");

  // 1. Trigger acrobatic vault jump!
  triggerPlayerJump();

  // 2. Increment Combo
  comboCount++;
  maxCombo = Math.max(maxCombo, comboCount);

  // 3. Charge Adrenaline Power Meter (combos charge faster!)
  const chargeGain = 16 + Math.min(25, comboCount * 3);
  powerMeter = Math.min(100, powerMeter + chargeGain);

  // 4. Increase gap from policeman (reward for quick reflexes!)
  copDistance = Math.min(20, copDistance + 2.2);

  // Visual feedback on combo box
  const comboBox = document.getElementById("combo-box");
  if (comboBox) {
    comboBox.classList.remove("combo-active");
    void comboBox.offsetWidth; // trigger reflow
    comboBox.classList.add("combo-active");
  }

  // Clear current target so next obstacle takes over
  targetObstacle = null;
  currentTypedText = "";

  // Reset prompt HUD
  updateActivePromptHUD(null);
}

/**
 * Called when player makes a typo mistake.
 */
function onTypoMistake() {
  // Reset combo streak
  if (comboCount > 0) {
    comboCount = 0;
  }
}

/**
 * Triggers the player vaulting/jumping over the obstacle.
 */
function triggerPlayerJump() {
  isJumping = true;
  jumpTimer = 0;
}

/**
 * Activates Adrenaline Overdrive power-up.
 */
function activateAdrenalineBoost() {
  isAdrenalineActive = true;
  adrenalineTimer = 5.0; // 5 seconds of hyper sprint
  powerMeter = 0;
  playSfx("powerup");

  // Speed lines overlay
  const speedLines = document.getElementById("speed-lines");
  if (speedLines) speedLines.classList.add("active");

  const powerBox = document.getElementById("power-box");
  if (powerBox) powerBox.classList.remove("ready");

  // Cop falls significantly behind
  copDistance = Math.min(24, copDistance + 6.0);
}

/**
 * Called when player fails to type word in time and crashes into the obstacle!
 */
function onObstacleCollision(obstacle) {
  playSfx("stumble");
  isStumbling = true;
  stumbleTimer = 0.45;

  // Combo reset
  comboCount = 0;

  // Stumble penalty: cop surges forward!
  copDistance = Math.max(0.5, copDistance - 3.8);

  // Red flash on prisoner torso
  if (prisonerLimbs.torsoGroup) {
    prisonerLimbs.torsoGroup.position.x = 0.2;
    setTimeout(() => {
      if (prisonerLimbs.torsoGroup) prisonerLimbs.torsoGroup.position.x = 0;
    }, 120);
  }

  // Clear target
  if (targetObstacle === obstacle) {
    targetObstacle = null;
    currentTypedText = "";
    updateActivePromptHUD(null);
  }
}

// ==========================================
// MODAL PREVIEW & BACKDROP TOGGLES
// ==========================================

function dismissModalToPreview() {
  const overlay = document.getElementById("overlay");
  const previewFab = document.getElementById("preview-fab");
  if (overlay) {
    overlay.classList.add("dismissed");
    overlay.style.display = "none";
  }
  if (previewFab) {
    previewFab.style.display = "flex";
  }
}

function reopenModal() {
  const overlay = document.getElementById("overlay");
  const previewFab = document.getElementById("preview-fab");
  if (previewFab) {
    previewFab.style.display = "none";
  }
  if (overlay) {
    overlay.classList.remove("dismissed");
    overlay.style.display = "flex";
  }
}

function toggleModalPreview() {
  const overlay = document.getElementById("overlay");
  if (overlay && (overlay.classList.contains("dismissed") || overlay.style.display === "none")) {
    reopenModal();
  } else {
    dismissModalToPreview();
  }
}

// ==========================================
// GAME LOOP & PROCEDURAL UPDATES
// ==========================================

function startGame() {
  const overlay = document.getElementById("overlay");
  if (overlay) {
    overlay.style.display = "none";
    overlay.classList.remove("dismissed");
  }
  const previewFab = document.getElementById("preview-fab");
  if (previewFab) {
    previewFab.style.display = "none";
  }

  // Resume Web Audio
  try {
    if (!audioCtx) audioCtx = new (window.AudioContext || window.webkitAudioContext)();
    if (audioCtx.state === "suspended") audioCtx.resume();
  } catch (err) {}

  // Reset Game State
  isPlaying = true;
  isAdrenalineActive = false;
  adrenalineTimer = 0;
  distanceEscaped = 0;
  copDistance = INITIAL_COP_DISTANCE;
  playerSpeed = BASE_SPEED;
  currentSpeed = BASE_SPEED;

  isJumping = false;
  jumpTimer = 0;
  isStumbling = false;
  stumbleTimer = 0;

  comboCount = 0;
  maxCombo = 0;
  powerMeter = 0;
  totalTypedChars = 0;
  correctTypedChars = 0;
  startTime = Date.now();
  targetObstacle = null;
  currentTypedText = "";

  // Reset Prisoner & Cop Positions
  prisonerGroup.position.set(0, 0, 0);
  copGroup.position.set(0, 0, INITIAL_COP_DISTANCE);

  // Clean old obstacles
  activeObstacles.forEach(obs => {
    scene.remove(obs.group);
    if (obs.badgeElem && obs.badgeElem.parentNode) {
      obs.badgeElem.remove();
    }
  });
  activeObstacles = [];

  // Spawn initial set of obstacles ahead
  for (let i = 1; i <= MAX_OBSTACLES; i++) {
    spawnNewObstacle(-i * OBSTACLE_SPACING);
  }

  updateActivePromptHUD(activeObstacles[0]);
  updateHUDStats();
}

function spawnNewObstacle(zPos) {
  const word = WORD_BANK[Math.floor(Math.random() * WORD_BANK.length)];
  const obstacle = createObstacle(zPos, word);
  activeObstacles.push(obstacle);
}

function animate() {
  requestAnimationFrame(animate);

  const now = performance.now();
  const delta = Math.min((now - lastFrameTime) / 1000, 0.1);
  lastFrameTime = now;

  if (isPlaying) {
    // 1. Handle Adrenaline Boost Countdown
    if (isAdrenalineActive) {
      adrenalineTimer -= delta;
      currentSpeed = BASE_SPEED * 1.7; // 70% faster!
      if (adrenalineTimer <= 0) {
        isAdrenalineActive = false;
        const speedLines = document.getElementById("speed-lines");
        if (speedLines) speedLines.classList.remove("active");
      }
    } else if (isStumbling) {
      stumbleTimer -= delta;
      currentSpeed = BASE_SPEED * 0.45; // Slow down on stumble
      if (stumbleTimer <= 0) {
        isStumbling = false;
      }
    } else {
      // Normal running speed increases gently over distance
      playerSpeed = BASE_SPEED + Math.min(0.35, (distanceEscaped / 1000) * 0.15);
      currentSpeed = playerSpeed;
    }

    // 2. Advance Distance
    distanceEscaped += currentSpeed * 2.8;

    // 3. Move Runway Grid & Road to simulate infinite forward motion
    roadGrid.position.z = (distanceEscaped % 5) - 80;

    // 4. Cop Chase Dynamics
    // The cop constantly tries to catch up at a dynamic pursuit rate
    const copPursuitFactor = (0.75 + Math.min(0.4, distanceEscaped * 0.0003)) * delta;
    if (!isAdrenalineActive) {
      copDistance -= copPursuitFactor;
    }
    // Cop clamp & positioning relative to prisoner (Z = 0)
    copGroup.position.z = Math.max(0.5, copDistance);
    copGroup.position.x = Math.sin(now * 0.003) * 0.35; // Cop weaves slightly

    // Flashing Cop Siren Lights
    const flashPhase = Math.floor(now * 0.008) % 2;
    if (copSirenLightRed && copSirenLightBlue) {
      copSirenLightRed.intensity = flashPhase === 0 ? 3.5 : 0.1;
      copSirenLightBlue.intensity = flashPhase === 1 ? 3.5 : 0.1;
    }

    // Siren Alert Vignette on HUD when cop is close (< 5.5m)
    const sirenFlashElem = document.getElementById("siren-flash");
    const dangerBox = document.getElementById("danger-box");
    if (copDistance < 5.5) {
      if (sirenFlashElem) sirenFlashElem.classList.add("active");
      if (dangerBox) dangerBox.classList.add("danger-close");
    } else {
      if (sirenFlashElem) sirenFlashElem.classList.remove("active");
      if (dangerBox) dangerBox.classList.remove("danger-close");
    }

    // 5. Check Game Over Condition (Cop caught prisoner)
    if (copDistance <= MIN_COP_DISTANCE) {
      onGameOver();
      return;
    }

    // 6. Character Animations (Run Cycle & Jumps)
    runCycle += delta * (currentSpeed * 18);
    updateCharacterAnimations(runCycle, delta);

    // 7. Move Obstacles toward the player
    activeObstacles.forEach(obs => {
      obs.group.position.z += currentSpeed * 2.8;

      // Auto-jump if Adrenaline is active and obstacle is close
      if (isAdrenalineActive && !obs.cleared && obs.group.position.z > -4 && obs.group.position.z < 2) {
        obs.cleared = true;
        triggerPlayerJump();
        playSfx("jump");
      }

      // Collision Detection: If obstacle reaches player (z > 0) without being cleared
      if (!obs.cleared && obs.group.position.z > 0 && obs.group.position.z < 3.5) {
        obs.cleared = true; // prevent multi-collisions
        onObstacleCollision(obs);
      }
    });

    // 8. Update Target Obstacle & Clean passed obstacles
    // Remove obstacles that have passed behind the cop (z > 15)
    const passedObstacles = activeObstacles.filter(obs => obs.group.position.z > 15);
    if (passedObstacles.length > 0) {
      passedObstacles.forEach(obs => {
        scene.remove(obs.group);
        if (obs.badgeElem && obs.badgeElem.parentNode) {
          obs.badgeElem.remove();
        }
      });
      activeObstacles = activeObstacles.filter(obs => !passedObstacles.includes(obs));
    }

    // Maintain 4 obstacles ahead
    while (activeObstacles.length < MAX_OBSTACLES) {
      const furthestZ = activeObstacles.length > 0
        ? Math.min(...activeObstacles.map(o => o.group.position.z))
        : -OBSTACLE_SPACING;
      spawnNewObstacle(furthestZ - OBSTACLE_SPACING);
    }

    // Update active target (closest obstacle in front of player with z < 2)
    const upcoming = activeObstacles
      .filter(o => o.group.position.z < 2 && !o.cleared)
      .sort((a, b) => b.group.position.z - a.group.position.z);

    if (upcoming.length > 0) {
      if (targetObstacle !== upcoming[0]) {
        targetObstacle = upcoming[0];
        currentTypedText = "";
        // Highlight active badge in 3D
        activeObstacles.forEach(o => o.badgeElem.classList.remove("locked-on"));
        targetObstacle.badgeElem.classList.add("locked-on");
      }
    }

    updateActivePromptHUD(targetObstacle);

    // 9. Sweeping Watchtower Searchlights
    searchlights.forEach((sl, idx) => {
      const sweepX = Math.sin(now * 0.0015 + idx * Math.PI) * 5;
      sl.target.position.x = sweepX;
    });

    // 10. Update HUD & Power Bar
    updateHUDStats();
  }

  // Render Scene & HTML 3D Labels
  if (renderer && scene && camera) {
    renderer.render(scene, camera);
  }
  if (labelRenderer && scene && camera) {
    labelRenderer.render(scene, camera);
  }
}

/**
 * Animates prisoner running/jumping and cop chasing limbs.
 */
function updateCharacterAnimations(cycle, delta) {
  // --- Prisoner Animation ---
  if (isJumping) {
    jumpTimer += delta;
    const progress = Math.min(1, jumpTimer / JUMP_DURATION);
    // Parabolic jump arc: up to 2.4m high!
    const jumpY = Math.sin(progress * Math.PI) * 2.4;
    prisonerGroup.position.y = jumpY;

    // Tuck legs and raise arms during jump
    if (prisonerLimbs.leftLegPivot) prisonerLimbs.leftLegPivot.rotation.x = -Math.PI / 3;
    if (prisonerLimbs.rightLegPivot) prisonerLimbs.rightLegPivot.rotation.x = -Math.PI / 4;
    if (prisonerLimbs.leftArmPivot) prisonerLimbs.leftArmPivot.rotation.x = Math.PI / 3;
    if (prisonerLimbs.rightArmPivot) prisonerLimbs.rightArmPivot.rotation.x = Math.PI / 3;

    if (progress >= 1) {
      isJumping = false;
      prisonerGroup.position.y = 0;
    }
  } else {
    prisonerGroup.position.y = 0;
    // Running limb swing
    const swing = Math.sin(cycle);
    if (prisonerLimbs.leftArmPivot) prisonerLimbs.leftArmPivot.rotation.x = swing * 0.9;
    if (prisonerLimbs.rightArmPivot) prisonerLimbs.rightArmPivot.rotation.x = -swing * 0.9;
    if (prisonerLimbs.leftLegPivot) prisonerLimbs.leftLegPivot.rotation.x = -swing * 0.95;
    if (prisonerLimbs.rightLegPivot) prisonerLimbs.rightLegPivot.rotation.x = swing * 0.95;
  }

  // --- Cop Animation ---
  const copSwing = Math.sin(cycle * 1.1);
  if (copLimbs.leftArmPivot) copLimbs.leftArmPivot.rotation.x = copSwing * 1.1;
  if (copLimbs.rightArmPivot) copLimbs.rightArmPivot.rotation.x = -copSwing * 1.1;
  if (copLimbs.leftLegPivot) copLimbs.leftLegPivot.rotation.x = -copSwing * 1.1;
  if (copLimbs.rightLegPivot) copLimbs.rightLegPivot.rotation.x = copSwing * 1.1;
}

// ==========================================
// HUD & UI UPDATES
// ==========================================

function updateObstacleBadgeUI(obstacle) {
  if (!obstacle || !obstacle.badgeElem) return;
  const typedPart = obstacle.word.substring(0, currentTypedText.length);
  const untypedPart = obstacle.word.substring(currentTypedText.length);
  obstacle.badgeElem.innerHTML = `<span class="typed">${typedPart}</span><span class="untyped">${untypedPart}</span>`;
}

function updateActivePromptHUD(obstacle) {
  const typedSpan = document.getElementById("prompt-typed");
  const untypedSpan = document.getElementById("prompt-untyped");
  if (!typedSpan || !untypedSpan) return;

  if (obstacle && !obstacle.cleared) {
    const typed = obstacle.word.substring(0, currentTypedText.length);
    const untyped = obstacle.word.substring(currentTypedText.length);
    typedSpan.innerText = typed;
    untypedSpan.innerText = untyped;
  } else {
    typedSpan.innerText = "";
    untypedSpan.innerText = "CLEAR!";
  }
}

function updateHUDStats() {
  const elapsedMinutes = (Date.now() - startTime) / 60000 || 0.001;
  const wpm = Math.round((correctTypedChars / 5) / elapsedMinutes);
  const accuracy = totalTypedChars > 0 ? Math.round((correctTypedChars / totalTypedChars) * 100) : 100;

  const statDist = document.getElementById("stat-dist");
  const statGap = document.getElementById("stat-gap");
  const statCombo = document.getElementById("stat-combo");
  const statWpm = document.getElementById("stat-wpm");
  const statAcc = document.getElementById("stat-acc");

  if (statDist) statDist.innerHTML = `${Math.floor(distanceEscaped)} <small>M</small>`;
  if (statGap) statGap.innerHTML = `${copDistance.toFixed(1)} <small>M</small>`;
  if (statCombo) statCombo.innerHTML = `${comboCount}<small>x</small>`;
  if (statWpm) statWpm.innerText = isNaN(wpm) ? 0 : wpm;
  if (statAcc) statAcc.innerText = `${accuracy}%`;

  // Adrenaline Power Bar
  const powerFill = document.getElementById("power-fill");
  const powerBox = document.getElementById("power-box");
  if (powerFill) powerFill.style.width = `${powerMeter}%`;

  if (powerBox) {
    if (powerMeter >= 100 && !isAdrenalineActive) {
      powerBox.classList.add("ready");
    } else {
      powerBox.classList.remove("ready");
    }
  }
}

// ==========================================
// GAME OVER
// ==========================================

function onGameOver() {
  isPlaying = false;
  playSfx("busted");

  const elapsedMinutes = (Date.now() - startTime) / 60000 || 0.001;
  const wpm = Math.round((correctTypedChars / 5) / elapsedMinutes);
  const accuracy = totalTypedChars > 0 ? Math.round((correctTypedChars / totalTypedChars) * 100) : 100;

  const overlay = document.getElementById("overlay");
  const menuTitle = document.getElementById("menu-title");
  const menuSubtitle = document.getElementById("menu-subtitle");
  const menuDesc = document.getElementById("menu-desc");
  const startInstructions = document.getElementById("start-instructions");
  const scoreSummary = document.getElementById("score-summary");
  const startBtnText = document.getElementById("start-btn-text");
  const statusPillText = document.getElementById("status-pill-text");
  const summaryRank = document.getElementById("summary-rank");
  const previewFab = document.getElementById("preview-fab");

  if (previewFab) previewFab.style.display = "none";
  if (statusPillText) statusPillText.innerText = "INMATE APPREHENDED";
  if (menuTitle) menuTitle.innerText = "BUSTED!";
  if (menuSubtitle) menuSubtitle.innerText = "THE WARDEN TACKLED YOU!";
  if (menuDesc) menuDesc.innerHTML = "You slowed down and the guard closed in. Train your accuracy to keep your distance!";

  // Switch from instructions to Score Summary
  if (startInstructions) startInstructions.style.display = "none";

  // Calculate Rank grade
  let rank = "RANK C";
  if (distanceEscaped >= 750 && accuracy >= 90) {
    rank = "RANK S";
  } else if (distanceEscaped >= 450 && accuracy >= 80) {
    rank = "RANK A";
  } else if (distanceEscaped >= 200) {
    rank = "RANK B";
  }
  if (summaryRank) summaryRank.innerText = rank;

  if (scoreSummary) {
    scoreSummary.style.display = "flex";
    const sumDist = document.getElementById("sum-dist");
    const sumCombo = document.getElementById("sum-combo");
    const sumWpm = document.getElementById("sum-wpm");
    const sumAcc = document.getElementById("sum-acc");
    if (sumDist) sumDist.innerText = `${Math.floor(distanceEscaped)}m`;
    if (sumCombo) sumCombo.innerText = `${maxCombo}x`;
    if (sumWpm) sumWpm.innerText = `${wpm} WPM`;
    if (sumAcc) sumAcc.innerText = `${accuracy}%`;
  }

  if (startBtnText) startBtnText.innerText = "BREAK OUT AGAIN";
  if (overlay) {
    overlay.classList.remove("dismissed");
    overlay.style.display = "flex";
  }
}

function onWindowResize() {
  if (!camera || !renderer || !labelRenderer) return;
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
  labelRenderer.setSize(window.innerWidth, window.innerHeight);
}

// Start Engine on DOM Load
if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", init);
} else {
  init();
}
