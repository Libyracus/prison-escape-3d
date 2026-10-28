# 🚨 PRISON ESCAPE: 3D Pixel Breakout

An adrenaline-pumping 3D voxel typing pursuit game built with **Three.js**, **Vite**, and procedural **Web Audio API**.

![Prison Break Preview](https://img.shields.io/badge/Status-Playable-brightgreen)
![Three.js](https://img.shields.io/badge/Three.js-r160-orange)
![Vite](https://img.shields.io/badge/Vite-5.0-646CFF)
![License](https://img.shields.io/badge/License-MIT-blue)

---

## 🎮 Gameplay & Story

You are an inmate in a high-security prison yard breaking for freedom! A relentless police officer is right on your heels. As procedural barricades and razor wire hurdles approach, you must quickly and accurately type the matching action words to **vault cleanly over obstacles**.

Stumbling slows you down and lets the officer close the gap. String together flawless word sequences to trigger speed combos, charge up your adrenaline overdrive meter, and trigger hyper-sprint auto-vaults!

---

## ⚡ Key Features

- **Custom 3D Voxel Engine**:
  - Animated voxel prisoner (with swinging limbs and dynamic jump arcs).
  - Voxel police officer with peaked cap, baton, and dual red/blue flashing siren point lights.
  - Infinite procedural asphalt runway with side walls, curb illumination, and sweeping watchtower spotlights.
- **Dynamic 3D Typing Mechanics**:
  - Procedural obstacle hurdles with floating HTML word badges rendered via Three.js `CSS2DRenderer`.
  - Letter-by-letter visual feedback and bottom HUD prompt display.
- **Combo & Adrenaline Overdrive System**:
  - Build combo multipliers that widen the gap between you and the pursuing officer.
  - Charging the power meter to 100% unlocks the **Adrenaline Boost** (`[SPACE]`) — granting warp speed, camera speed lines, and automatic obstacle clearance.
- **Synthesized Retro Audio (Web Audio API)**:
  - Real-time procedural audio synthesis: mechanical keystroke clicks, upward jump sweeps, error buzzers, stumble thuds, power-up arpeggios, and alarm sirens. No external audio files needed!
- **Modern Glassmorphic UI/UX**:
  - Translucent frosted glass modal with subtle ambient glow and fluid responsiveness (`clamp()`, `rem`).
  - Scannable visual cards for mechanics and visual keyboard badges.
  - Post-run breakout report featuring performance rank (`RANK S / A / B / C`), distance escaped, max combo, WPM, and accuracy metrics.

---

## 🕹️ Controls

| Key | Action |
| :--- | :--- |
| **`A` – `Z`** | Type obstacle letters to leap hurdles |
| **`SPACE`** | Activate Adrenaline Overdrive (when gauge is at 100%) / Quick Start |
| **`ENTER`** | Start / Restart Game |
| **`ESC`** | Toggle Modal Preview / Yard View |

---

## 🚀 Getting Started

### Prerequisites

- [Node.js](https://nodejs.org/) (v16 or higher recommended)
- `npm` or `yarn`

### Installation

1. Clone this repository:
   ```bash
   git clone https://github.com/Libyracus/prison-escape-3d.git
   cd prison-escape-3d
   ```

2. Install dependencies:
   ```bash
   npm install
   ```

3. Start local development server:
   ```bash
   npm run dev
   ```

4. Build for production:
   ```bash
   npm run build
   ```

5. Preview production build:
   ```bash
   npm run preview
   ```

---

## 🛠️ Built With

- **[Three.js](https://threejs.org/)** – 3D WebGL rendering, lighting, materials, and scene graph
- **[CSS2DRenderer](https://threejs.org/docs/#examples/en/renderers/CSS2DRenderer)** – Floating 3D HTML labels for typing badges
- **[Vite](https://vitejs.dev/)** – Next generation frontend tooling & bundler
- **Web Audio API** – Procedural synthesizer sound effects

---

## 📜 License

This project is licensed under the MIT License.

