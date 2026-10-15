# Findings

## Repository
- Project root: `/Users/eason/Desktop/EasonDev-Workspace/eason-dev`.
- React 19 + TypeScript + Vite 8; GSAP 3.15 is already installed.
- `RoomScene.tsx` owns the entire scene, transitions, hotspots, player, and navigation. The safest integration is one import/state gate plus an overlay sibling near the end of the Room root.
- `RoomScene.tsx` and `styles.css` already contain unrelated uncommitted edits (navigation/mobile coordinate/About changes). Do not alter their existing hunks beyond the smallest welcome integration/CSS append.
- The Room root is a viewport-filling section; the top bar is at z-index 40, so the welcome overlay must sit above it and own pointer input while mounted.

## Reference research
- Paper Shaders is an Apache-2.0 monorepo with a vanilla WebGL core and React wrappers. Its intended use includes masking canvas shaders with text; it emphasizes lightweight canvas rendering, broad device support, and explicitly advises pinning 0.0.x dependencies.
- The current package exports `ShaderMount` and effect components such as `MeshGradient`; the React wrapper drives the underlying canvas/WebGL mount.
- Search evidence for the Gitee project identifies its implementation as deliberately pure CSS: its author avoided WebGL/SVG-filter complexity and targeted a performance/visual-quality balance.
- Direct page opening through the web connector failed for Gitee, the GitHub source folder, and the Paper docs URL. Next approach: inspect source via temporary shallow clones/raw repository access.
- Gitee shallow clone succeeded. Its `CSS水滴` effect uses an asymmetric organic `border-radius`, `backdrop-filter: blur(4px)`, opposing inset light/dark shadows, a cast shadow, and two small white pseudo-element highlights. Its pulse animation only changes width/height.
- Its `纯CSS液态玻璃` effect builds glass from: a very low-alpha white fill, 2px backdrop blur, subtle border, layered inset bevel highlights/shadows, a blurred diagonal highlight overlay, and an interior blurred outline. These are the reusable visual traits; the demo's heavy `contrast(3)` parent and button-specific sizing are not appropriate for a full-screen veil.
- Paper Shaders exposes a React `MeshGradient` over its WebGL `ShaderMount`, with `colors`, `distortion`, `swirl`, and `speed` controls. Using a small canvas only inside a text mask matches the library's intended localized use and avoids rendering the whole room.

## Decisions
- Keep the welcome as an independently mounted overlay above the existing Room DOM.
- Use the project's own typography and make the animated gold title the sole visual focal point.
- Prefer the Gitee project's CSS/backdrop-filter strategy for glass and droplets instead of introducing a second full-scene renderer.
- Adapt the droplet recipe into four sparse fixed shapes with GSAP translating them downward; keep their expensive backdrop blur small and turn it off under reduced motion/mobile fallback as needed.
- Use an exactly pinned `@paper-design/shaders-react` package for the title only if package compatibility/build checks pass; unmounting the component will release the WebGL canvas.
- npm reports `@paper-design/shaders-react@0.0.81` with peer support for React 18 or 19. It is installed with an exact version pin.
- Installed source confirms the React wrapper disposes its vanilla `ShaderMount` during effect cleanup. This satisfies the renderer shutdown requirement when the welcome component unmounts.
- Browser QA: the first visit mounts the modal overlay and focuses it; after completion, the overlay unmounts. Reloading the same origin does not replay it and restores the Room hotspots/navigation to the accessibility tree. No browser warnings/errors were logged.
- Mobile post-animation and desktop overlay screenshots showed no Room image shift or viewport seam. The glass remained translucent enough to keep the Room readable.
- The welcome component is lazy-loaded and controlled by application-root memory state, so it plays once per full page load without storage-backed persistence or internal-navigation replays.
