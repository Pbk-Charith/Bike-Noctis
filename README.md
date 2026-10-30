# NOCTIS — Pure Electric Precision

> A premium, minimal, single-page scrollytelling website for **NOCTIS**, an ultra-high performance electric vehicle brand. Mood: a city in total blackout at night where the vehicle's light is the only light in the world. Quiet, expensive, precise.

---

## ⚡ Architecture & Tech Stack

- **Pure Vanilla Stack**: Built with standard **HTML5**, **CSS3**, and **Vanilla JavaScript (ES6+)**. No frameworks, no bundlers, no external JS/CSS dependencies.
- **Scroll-Scrubbed Canvas Sequences**: Image sequences are continuously scrubbed and drawn directly onto `<canvas>` elements scaled by `devicePixelRatio` (capped at 2) with a smooth lerp animation loop (no `<img>` swapping, no `<video>`).
- **Responsive Frame Delivery**: 
  - Desktop viewports (≥ 768px): 1600px WebP sequences (quality 78)
  - Mobile viewports (< 768px): 960px WebP sequences (quality 72)
- **Zero-Dependency Serving**: Designed to run immediately with any static file server (e.g. VS Code Live Server, Python `http.server`, or Node `serve`).

---

## 🎨 Design System & Strict Style Tokens

- `--asphalt`: `#07080A` (Deep page background)
- `--graphite`: `#121418` (Surface shade)
- `--fog`: `#8A8F98` (Muted metadata / labels)
- `--bone`: `#EDEAE4` (Primary text)
- `--xenon`: `#CFE3FF` (Headlight / accent highlight)
- `--taillight`: `#E1251B` (Subtle telemetry tick & accent)
- `--hairline`: `rgba(237, 234, 228, 0.12)` (Precision 1px dividers)
- **Typography**:
  - Display: `Archivo` variable font (width 125%, weights 300/400, uppercase)
  - Body: `Inter` 400
  - HUD: `JetBrains Mono` 400
- **Strict Aesthetic**: Flat solid colors and 1px hairlines only. No gradients, no glassmorphism, no blurs, no drop shadows, and no rounded cards.

---

## 🚀 Key Features

1. **Priority Preloader**: Preloads Hero frames 1–40 with a center-expanding xenon line counter (000% → 100%) before smoothly revealing the site; background worker loads remaining hero and dismantle frames.
2. **Pinned Scrollytelling Stages**:
   - **Hero (`600vh`)**: 595-frame joined sequence across 4 narrative chapters, live telemetry HUD (speed `000` → `118 KM/H`, distance `0.0` → `4.2 KM`), and seamless fade-to-black.
   - **Dismantle (`350vh`)**: 199-frame sequence showing the full vehicle deconstructing into its monocoque, battery pack, axial-flux motor, and single-line LED signature with interactive callouts.
3. **Word-by-Word Statement Reveal**: Scroll-interpolated opacity illumination for the core engineering philosophy.
4. **Lineup Accordion**: 5 vehicle models (`GT-E`, `S`, `X`, `R`, `ONE`) in an interactive vertical accordion with 80ms debounced hover, 6% slide-in motion, 4 solid color finish swatches, and keyboard navigation.
5. **Custom Headlight Cursor**: Solid xenon dot inside a 28px ring that morphs into a 44x2px light bar with contextual mono badges (`VIEW`, `OPEN`, `CONFIGURE`, `RESERVE`) and a 120ms brightening flash on click.
6. **Procedural Film Grain**: Offscreen noise tile shifted at ~8fps with zero layout or repaint penalties.
7. **Accessibility & Reduced Motion**: Full fallback support for `prefers-reduced-motion` displaying static frame representations and native system cursors.

---

## 🛠 Local Setup

Clone the repository and launch with any local static server:

```bash
git clone https://github.com/Pbk-Charith/Bike-Noctis.git
cd Bike-Noctis
```

Run with Node:
```bash
npx serve .
```

Or run with Python:
```bash
python -m http.server 3000
```

Open `http://localhost:3000` in your browser.

