# P9/P10 local repair assets

Both plates were produced with the built-in image tool using the unchanged `public/assets/eason-room-hero-desktop-v2.webp` as the edit target. Only required crops are shipped. Visible scene objects remain sampled from the original artwork.

## Cat-only background

- Full generated source: `design-sources/cat-occlusion-p9.png` (1672×941).
- Runtime crop: `public/assets/cat-occlusion-p9.webp` (292×140, source x1380/y430, 13,220 bytes).
- Used only behind the cat edge; preserves the holder, wall shadow and book top absent from the previous broader clean plate.

Exact prompt:

Use case: precise-object-edit. Image 1 is edit target. Make a precisely registered 1672x941 background plate. REMOVE ONLY THE SLEEPING CAT on far right, including fur, ears and paws (x1450-1672 y450-570). Reconstruct the tiny wall area and green book top it was covering. Preserve EVERYTHING ELSE pixel-for-pixel as closely as possible. In particular keep the narrow brass plant holder immediately LEFT of the cat (x1420-1453 y493-525) complete and unchanged. Keep the hanging plant/stem above this holder unchanged. Keep the existing short horizontal dark shadow on the wall to the LEFT of cat at x1450-1488 y480-488 unchanged and continue it naturally behind where the cat was, do NOT erase or recolor this shadow. Preserve corkboard, paper picture, wall color and texture, all three large books underneath cat at exact original coordinates. Preserve moon lamp, laptop, phone, robot, Java cup, all scenery and other items EXACTLY unchanged. This is object removal only, not redesign. DO NOT move any object, change crop, scale, camera, lighting, color grading. Only formerly cat-covered pixels need reconstruction.

## Steam-free background

- Full generated source: `design-sources/steam-clean-p10.png` (1672×941).
- Runtime crop: `public/assets/steam-clean-p10.webp` (90×88, source x530/y470, 3,162 bytes).
- Used to estimate the steam light contribution. The renderer transfers this contribution to the mug's near texture and subtracts it from the mid texture; it does not move a rectangle of book pixels.

Exact prompt:

Use case: precise-object-edit. Edit target is attached original 1672x941 room illustration. REMOVE ONLY THE TRANSLUCENT WHITE STEAM rising above the Java coffee mug (roughly source x535-605, y480-554). Reconstruct the SAME existing dark and gray horizontal book spines seen behind the steam, with original edges, perspective and brightness. Do NOT remove or move the mug, its rim, coffee surface, handle, coaster, book stack, figurine, plant, laptop or ANY other object. Pixel-aligned clean plate: exact source dimensions, crop, camera, colors, brightness, geometry and lighting. Preserve the dark book covers and all spine edges at their original y coordinates. Only remove the white steam wisps; no changes at all outside this tiny region. No added objects or redesign.

## Rejected experiment

A generated four-object silhouette mask was evaluated and rejected because the shapes were not sufficiently registered to the source. It is not a runtime asset and was moved to `/private/tmp/local-object-mattes-p9-rejected.png`. The final renderer uses checked source-coordinate contours, not that mask.
