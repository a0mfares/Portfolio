# Ahmed Mohamed Ahmed — Portfolio (React + Vite)

A cyberpunk 3D portfolio powered by Three.js, React 18, and Vite 5.

## 📁 Project Structure

```
portfolio-react/
├── public/
│   └── Assets/          ← ⚠️ PUT YOUR ASSETS FOLDER HERE
├── src/
│   ├── App.jsx           Main application component
│   ├── index.css         Global styles (all CSS variables, animations)
│   ├── main.jsx          React entry point
│   ├── components/
│   │   ├── ThreeCanvas.jsx     Three.js canvas wrapper
│   │   ├── IntroOverlay.jsx    Loading + typing intro sequence
│   │   ├── HoloScene.jsx       Split-column panel overlay + parallax
│   │   ├── HoloContainer.jsx   Individual cyberpunk HUD panel
│   │   ├── ProjectAsset.jsx    Project card content renderer
│   │   └── UIControls.jsx      Back btn / theme toggle / instructions
│   ├── hooks/
│   │   └── useThreeScene.js    All Three.js logic (renderer, islands, camera)
│   └── data/
│       └── islandPanels.js     Static island data + CSV parser
├── index.html
├── package.json
└── vite.config.js
```

## 🚀 Getting Started

### 1. Copy Your Assets

Copy your entire `Assets/` folder into the `public/` directory:

```
public/
└── Assets/
    ├── bg.png
    ├── light bg.png
    ├── fav.png
    ├── middle.glb
    ├── Floadting Island 1.glb
    ├── floating Island 3.glb
    ├── floating island 2.glb
    ├── floating Island 4.glb
    ├── floating Island 5.glb
    ├── floating Island 6.glb
    ├── Data.csv
    └── notification.mp3
```

> **Important:** Asset paths are case-sensitive. Make sure filenames match exactly.

### 2. Install Dependencies

```bash
npm install
```

### 3. Run Development Server

```bash
npm run dev
```

Open [http://localhost:5173](http://localhost:5173) in your browser.

### 4. Build for Production

```bash
npm run build
```

Output goes to the `dist/` folder. You can then copy your `Assets/` folder into `dist/Assets/` and deploy.

---

## 🎨 Customizing Content

### Personal Info (Center Island — Island 0)
Edit `src/data/islandPanels.js` → `STATIC_ISLAND_PANELS[0]`

### Experience & Leadership (Island 6)
Edit `src/data/islandPanels.js` → `STATIC_ISLAND_PANELS[6]`

### Projects (Islands 1–5)
Keep using `public/Assets/Data.csv` with columns:
```
project name, description, date, tech stack, preview, link, island
```
- `island` must be 1–5
- `preview` can be a path like `Assets/previews/myproject.png` or `null`
- `link` can be a URL or `null`

---

## 📱 Responsive Design

The React version adds improvements over the original:
- **Fluid typography** using `clamp()` throughout
- **Mobile layout**: panels stack vertically on screens < 700px
- **Touch support**: tap islands to focus, touch-action optimized
- **dvh / safe area** awareness via `viewport-fit=cover`
- **Custom scrollbars** on panel content areas
- **Landscape mobile** handled with dedicated media query

---

## ⚡ Performance

- Three.js is **code-split** into its own chunk via Vite
- Pixel ratio capped at 1.5×
- RAF loop throttled during intro typing phase
- `will-change: transform, opacity` on animated panels
- Lazy image loading on project previews
- `backdrop-filter` only on panel elements (not full-screen)
