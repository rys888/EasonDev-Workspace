# Room Guide Welcome Animation

## Goal
Add a skippable 4–5 second welcome overlay that plays once per full application load using GSAP, while preserving the Room scene, hotspots, parallax, transitions, and all unrelated pages.

## Design direction
- Memorable element: warm-gold animated shader title.
- Supporting layers: quiet translucent liquid-glass veil and 3–5 sparse refractive droplets.
- Palette: antique gold `#D9B878`, candle gold `#F4D99A`, warm ivory `#F4EEE2`, smoke `rgba(17, 13, 10, .12)`, clear glass.
- Type: inherit the project's display/body typefaces so the welcome feels native to the Room.
- Layout: centered title and subtitle; no extra chrome or controls; entire overlay is the skip target.
- Motion: one cinematic sequence with restrained movement, not a collection of independent effects.

## Phases
1. [complete] Inspect repository constraints and current Room integration points.
2. [complete] Inspect reference implementations and select minimal techniques.
3. [complete] Implement the isolated welcome component and Room integration.
4. [complete] Verify interaction, reduced motion, responsive behavior, and cleanup.
5. [complete] Run build/tests and summarize implementation/dependencies.

## Constraints checklist
- Do not modify the Room scene, hotspot coordinates, parallax, accepted page transitions, or unrelated pages.
- Keep the glass as an independent overlay and limit the shader to the main title.
- Avoid unnecessary dependencies; unload animation/rendering resources when complete.
- Block Room interaction only while the overlay is mounted.

## Errors encountered
| Error | Attempt | Resolution |
|---|---:|---|
| Web connector could not open the Gitee tree, GitHub source folder, or Paper docs directly | 1 | Switch to temporary shallow clones/raw source inspection; keep search summaries as corroborating evidence. |
| Both shallow clones failed in the sandbox because DNS was blocked | 1 | Retried with approved network access. Gitee succeeded. |
| Paper Shaders shallow clone timed out after 75 seconds even with network access | 2 | Used GitHub's indexed source/docs plus package metadata; no blind code copying is needed because the public React API is documented. |
| `npm view` hung inside the network-restricted sandbox | 1 | Cancelled the command and reran with approved npm registry access. |
| First local Vite server start failed with `listen EPERM` in the sandbox | 1 | Restarted with approved local server access for browser QA. |
| First combined verification stopped at `git diff --check` because planning files had trailing blank lines | 1 | Removed the whitespace, separated the Fast Refresh helper into a utility module, and reran all checks successfully. |
