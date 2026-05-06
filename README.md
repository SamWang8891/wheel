# 幸運轉盤 ｜ Midnight Carnival

A weighted-random spin wheel with an editorial, late-night-carnival aesthetic. Type your options, press **SPIN**, watch fate decide.

Built with React 19 + Vite. No backend, no tracking — everything lives in `localStorage`.

## Features

- **Custom options** — add, edit, remove; up to 32 chars each
- **Realistic spin** — 5–7 revolutions with a cubic-bezier ease, plus per-slice tick sound synced to the visual rotation
- **Confetti + win chime** when the pointer lands
- **Persistent state** — options and the last 20 results survive reloads
- **Remove-winner-after-pick** toggle (great for raffles / draw-without-replacement)
- **Mute toggle** for the WebAudio tick + win sounds
- **Shuffle / Reset** helpers; defaults to `YES` / `NO`
- **PWA-ready** — manifest, icons, theme color, mobile-web-app meta
- **Traditional Chinese (繁體中文) UI**

## Run it

```bash
npm install
npm run dev      # http://localhost:5173
npm run build    # production build → dist/
npm run preview  # serve the built bundle
```

Requires Node 18+.

## Project layout

```
src/
  main.jsx      entry
  App.jsx       app shell, spin logic, history, modal, confetti
  Wheel.jsx     SVG wheel renderer
  styles.css    all styling
public/         icons + webmanifest
```

## How the spin works

`startSpin` in `src/App.jsx` picks the winning index up front, computes a target rotation that lands that slice under the pointer (with mild in-slice jitter), and adds 5–7 full turns for drama. A `requestAnimationFrame` loop samples the same `cubic-bezier(0.18, 0.86, 0.24, 1)` curve the CSS transform uses, so the JS-tracked angle stays in lockstep with the visual — that's what lets the tick fire exactly on each border crossing.

## License

See [LICENSE](./LICENSE).
