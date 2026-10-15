// All contours use the accepted 1672 × 941 illustration's pixel coordinates.
// They must never be stretched independently of the illustration's cover crop.
export const SOURCE_WIDTH = 1672
export const SOURCE_HEIGHT = 941

const opening = new Path2D('M719 0H1238V461H719Z')
const laptop = new Path2D('M710 370 Q700 370 698 382 L681 600 L634 659 Q631 669 637 674 L1090 674 Q1097 672 1093 660 L1059 601 L1055 381 Q1055 370 1043 370Z')
const desk = new Path2D('M0 755 L192 755 L304 662 L492 601 L681 600 L1057 601 L1138 589 L1280 596 L1380 609 L1672 663 V941 H0Z')
// The marked tabletop wedge rises behind the mug handle to source y=589.
// It and the table visible through the handle belong to the same near plane.
const leftDeskCorner = new Path2D('M445 612L475 599L496 589H539V620H445Z')
const cup = new Path2D('M538 553C538 541 626 541 626 551L624 638C622 651 548 657 539 638L537 630C516 637 499 619 499 594C499 573 506 560 521 563Q530 563 538 568Z M536 577C524 567 508 569 506 591C504 610 518 630 536 617Z')
const phone = new Path2D('M1133 639L1136 624L1143 618L1165 496Q1167 486 1178 487L1231 491Q1243 493 1239 503L1227 571L1233 572L1245 620L1255 626L1252 647L1188 655Z')
const rightBooks = new Path2D('M1347 659L1358 622L1370 616L1372 590L1370 545L1427 532L1453 529Q1449 519 1458 507L1469 495L1487 482L1487 461Q1487 456 1493 460L1512 471L1522 465L1540 461L1556 462L1568 464L1578 454L1600 449L1622 449L1640 451L1655 455L1672 462V941H1347Z')
const moon = new Path2D('M1290 578C1249 525 1302 457 1355 463C1418 468 1436 540 1394 577L1407 581L1407 608L1280 610L1278 589Z')
const robot = new Path2D('M1089 510Q1109 508 1129 510L1130 535L1132 536L1133 541L1130 545L1127 545L1124 550L1134 565L1141 565L1144 573L1149 585Q1150 591 1145 593L1143 600L1145 605L1143 608L1125 612L1081 611L1080 608L1080 603L1071 600L1070 594L1078 583L1081 575L1080 568L1084 563L1088 564L1098 548Q1091 548 1090 544L1087 544L1086 538L1088 535Z')

// Only these four reported boundaries receive a clean-background guard.
const localRepairs = [[491, 536, 146, 122], [1063, 502, 93, 117], [1216, 483, 45, 151], [1408, 440, 264, 99]]

// Only foliage silhouetted against the opening needs a matte. The left side
// of the plant already lies entirely within the room plane.
const foliageRegion = new Path2D('M692 252L714 245L730 268L734 287L751 315L770 321L791 342L831 343L842 368L692 413Z')

export function makeDepthPlanes(image: HTMLImageElement, plate: HTMLImageElement, catPlate: HTMLImageElement, steamPlate: HTMLImageElement, animatedSteam = false) {
  const canvas = document.createElement('canvas')
  canvas.width = SOURCE_WIDTH
  canvas.height = SOURCE_HEIGHT
  const ctx = canvas.getContext('2d', { willReadFrequently: true })!
  ctx.drawImage(image, 0, 0, SOURCE_WIDTH, SOURCE_HEIGHT)
  const pixels = ctx.getImageData(0, 0, SOURCE_WIDTH, SOURCE_HEIGHT).data
  ctx.drawImage(plate, 0, 0, SOURCE_WIDTH, SOURCE_HEIGHT)
  const hiddenPixels = ctx.getImageData(0, 0, SOURCE_WIDTH, SOURCE_HEIGHT).data
  // The local cat plate preserves the holder, shadow and book top that the
  // earlier whole-desk plate removed. Only hidden cat-edge samples use it.
  ctx.clearRect(0, 0, SOURCE_WIDTH, SOURCE_HEIGHT)
  ctx.drawImage(catPlate, 1380, 430, 292, 140)
  const catPixels = ctx.getImageData(0, 0, SOURCE_WIDTH, SOURCE_HEIGHT).data
  ctx.clearRect(0, 0, SOURCE_WIDTH, SOURCE_HEIGHT)
  ctx.drawImage(steamPlate, 530, 470, 90, 88)
  const steamBackground = ctx.getImageData(530, 470, 90, 88).data
  ctx.fillStyle = '#808080'
  ctx.fillRect(0, 0, SOURCE_WIDTH, SOURCE_HEIGHT)
  ctx.fillStyle = '#000000'
  ctx.fill(opening)
  ctx.fillStyle = '#ffffff'
  for (const path of [laptop, desk, leftDeskCorner, cup, phone, rightBooks, moon, robot]) {
    ctx.fill(path, 'evenodd')
    ctx.strokeStyle = '#ffffff'
    ctx.lineWidth = 1.5
    ctx.stroke(path)
  }
  const depthPixels = ctx.getImageData(0, 0, SOURCE_WIDTH, SOURCE_HEIGHT).data
  const count = SOURCE_WIDTH * SOURCE_HEIGHT
  const ownership = new Uint8Array(count)

  for (let y = 0; y < SOURCE_HEIGHT; y++) {
    for (let x = 0; x < SOURCE_WIDTH; x++) {
      const i = y * SOURCE_WIDTH + x
      // Widely spaced codes prevent 8-bit antialias rounding on overlapping
      // paths from turning a foreground pixel into a different depth plane.
      const code = depthPixels[i * 4]
      let plane = code > 192 ? 2 : code > 64 ? 1 : 0
      if (plane === 0 && x >= 692 && x <= 842 && y >= 245 && y <= 413 && ctx.isPointInPath(foliageRegion, x + 0.5, y + 0.5)) {
        const r = pixels[i * 4], g = pixels[i * 4 + 1], b = pixels[i * 4 + 2]
        // Warm green indoor leaves, including their dark silhouette, versus
        // blue stone/water behind. This is constrained to the plant silhouette.
        if (g > b * 1.12 && r > b * 0.78) plane = 1
      }
      ownership[i] = plane
    }
  }

  // Steam is translucent light over the books, not an opaque image cutout.
  // Transfer its positive light contribution from the mid texture into the
  // SAME near texture as the mug (RGB contribution with zero occlusion alpha).
  // Their sum at neutral remains the original source pixel exactly.
  const steamLight = new Uint8Array(90 * 88 * 4)
  for (let y = animatedSteam ? 470 : 472; y < (animatedSteam ? 558 : 557); y++) {
    for (let x = animatedSteam ? 530 : 532; x < (animatedSteam ? 620 : 618); x++) {
      const i = y * SOURCE_WIDTH + x
      // Static P10 extraction belongs only to the book/mid plane. Animated
      // steam also needs the clean cup-top pixels from the same plate; leaving
      // the baked highlight in that near-plane strip creates a second plume
      // base exactly where the procedural mist meets the coffee surface.
      if (animatedSteam ? ownership[i] === 0 : ownership[i] !== 1) continue
      const s = ((y - 470) * 90 + x - 530) * 4
      if (animatedSteam) {
        // Restore one continuous steam-free plate across the books, liquid and
        // rim. RGB changes only inside this tiny feathered ROI; depth ownership,
        // alpha and the accepted cup silhouette remain exactly unchanged.
        const edge = Math.max(0, Math.min(1, (x - 530) / 2, (620 - x) / 2, (y - 470) / 3, (558 - y) / 2))
        const blend = edge * edge * (3 - 2 * edge)
        for (let c = 0; c < 3; c++) {
          pixels[i * 4 + c] = Math.round(pixels[i * 4 + c] * (1 - blend) + steamBackground[s + c] * blend)
        }
        continue
      }
      // Suppress single-pixel book grain mismatch in the clean-plate estimate;
      // steam changes smoothly, whereas spine lettering is high-frequency.
      const differences = [0, 1, 2].map(c => {
        let difference = 0
        for (let dy = -1; dy <= 1; dy++) {
          for (let dx = -1; dx <= 1; dx++) {
            difference += pixels[(i + dy * SOURCE_WIDTH + dx) * 4 + c] - steamBackground[s + (dy * 90 + dx) * 4 + c]
          }
        }
        return difference / 9
      })
      const minimum = Math.min(...differences)
      const coherence = Math.max(0, Math.min(1, minimum / 5))
      const feather = Math.min(1, (x - 532) / 6, (618 - x) / 6, (y - 472) / 6)
      for (let c = 0; c < 3; c++) {
        const light = Math.min(pixels[i * 4 + c], Math.round(Math.max(0, differences[c]) * coherence * feather))
        steamLight[s + c] = light
        pixels[i * 4 + c] -= light
      }
    }
  }

  const local = new Uint8Array(count)
  for (const [region, [left, top, width, height]] of localRepairs.entries()) {
    for (let y = top; y < top + height; y++) local.fill(region + 1, y * SOURCE_WIDTH + left, y * SOURCE_WIDTH + left + width)
  }
  // A classified edge can still contain antialiased foreground RGB. Those
  // pixels must not seed the background repair, or the fill stretches a gold
  // bezel/fur/cup highlight into a second stationary silhouette.
  const guard = new Uint8Array(count)
  const edgeRepair = new Uint8Array(count)
  for (let i = 0; i < count; i++) {
    if (!local[i] || ownership[i] !== 2) continue
    const x = i % SOURCE_WIDTH, y = Math.floor(i / SOURCE_WIDTH)
    const radius = local[i] === 4 ? 10 : 4
    for (let dy = -radius; dy <= radius; dy++) {
      for (let dx = -radius; dx <= radius; dx++) {
        if (dx * dx + dy * dy > radius * radius || x + dx < 0 || x + dx >= SOURCE_WIDTH || y + dy < 0 || y + dy >= SOURCE_HEIGHT) continue
        const j = i + dy * SOURCE_WIDTH + dx
        if (local[j] === 4 && x + dx >= 1418 && x + dx <= 1454 && y + dy >= 490 && y + dy <= 527) continue
        if (local[j] && ownership[j] === 1) {
          guard[j] = 1
          if (dx * dx + dy * dy <= 4) edgeRepair[j] = 1
        }
      }
    }
  }

  // Pull background samples only into pixels hidden by a closer plane.
  // 32 source pixels exceed maximum relative travel at the smallest desktop
  // cover scale. This removes duplicate silhouettes rather than blending them.
  return [0, 1, 2].map((plane) => {
    const rgba = new Uint8Array(count * 4)
    const nearest = new Int32Array(count).fill(-1)
    const distance = new Uint8Array(count)
    const queue = new Int32Array(count)
    let head = 0, tail = 0
    for (let i = 0; i < count; i++) {
      if (ownership[i] === plane && !(plane === 1 && guard[i])) {
        nearest[i] = i
        queue[tail++] = i
      }
    }
    while (head < tail) {
      const i = queue[head++]
      if (distance[i] >= 32 || plane === 2) continue
      const x = i % SOURCE_WIDTH
      const neighbors = [x > 0 ? i - 1 : -1, x < SOURCE_WIDTH - 1 ? i + 1 : -1, i - SOURCE_WIDTH, i + SOURCE_WIDTH]
      for (const j of neighbors) {
        if (j < 0 || j >= count || nearest[j] !== -1 || ownership[j] < plane || (ownership[j] === plane && !(plane === 1 && guard[j]))) continue
        nearest[j] = nearest[i]
        distance[j] = distance[i] + 1
        queue[tail++] = j
      }
    }
    for (let i = 0; i < count; i++) {
      const source = nearest[i]
      const x = i % SOURCE_WIDTH, y = Math.floor(i / SOURCE_WIDTH)
      if (plane === 2 && ownership[i] !== 2 && x >= 530 && x < 620 && y >= 470 && y < 558) {
        // Animated mode replaces only the P10 light contribution; the clean
        // book background, mug contour and all occlusion repairs are unchanged.
        if (animatedSteam) continue
        const s = ((y - 470) * 90 + x - 530) * 4
        rgba[i * 4] = steamLight[s]
        rgba[i * 4 + 1] = steamLight[s + 1]
        rgba[i * 4 + 2] = steamLight[s + 2]
        // alpha=0: add only the wisps, never move/occlude the book rectangle.
        continue
      }
      if (source < 0) continue
      const inOpening = x >= 719 && x < 1238 && y < 461
      const hidden = ownership[i] !== plane || (plane === 1 && edgeRepair[i] === 1)
      // There is no wall behind the laptop inside the outdoor opening.
      // Putting a dilated room layer here would stamp a new rectangular seam.
      if (plane === 1 && hidden && inOpening) continue
      // These small indoor disocclusions need the actual adjacent book/wall
      // texture. The generated plate changes those surfaces and creates a
      // visible color outline even when the foreground matte is registered.
      const usePlate = hidden && !local[i] && (plane === 0 ? inOpening : true)
      const data = usePlate ? hiddenPixels : pixels
      let sample = usePlate || !hidden ? i : source
      // Horizontal room/desk lines must continue at their original height.
      // Unconstrained nearest-neighbor fill can drag a molding, book edge or
      // holder vertically and produce the reported stepped background cuts.
      if (plane === 1 && hidden && (local[i] === 2 || local[i] === 3)) {
        let found = false
        for (let step = 1; step <= 96 && !found; step++) {
          for (const candidateX of [x - step, x + step]) {
            if (candidateX < 0 || candidateX >= SOURCE_WIDTH) continue
            const candidate = y * SOURCE_WIDTH + candidateX
            if (ownership[candidate] !== 1 || guard[candidate]) continue
            sample = candidate
            found = true
            break
          }
        }
      }
      rgba[i * 4] = data[sample * 4]
      rgba[i * 4 + 1] = data[sample * 4 + 1]
      rgba[i * 4 + 2] = data[sample * 4 + 2]
      if (plane === 1 && hidden && local[i] === 4) {
        for (let channel = 0; channel < 3; channel++) {
          rgba[i * 4 + channel] = catPixels[i * 4 + channel]
        }
      }
      rgba[i * 4 + 3] = 255
    }
    return rgba
  })
}
