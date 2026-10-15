import { SOURCE_HEIGHT, SOURCE_WIDTH } from './depthPlanes'

export const WATER_TOWN_BOUNDS = { left: 719, top: 112, right: 1238, bottom: 461 }

// Source-space material mask, NOT a second copy of the illustration. The bank,
// bridge, boat and the little foreground shrub remain rigid inside the far pass.
export function makeWaterMask() {
  const mask = document.createElement('canvas')
  mask.width = SOURCE_WIDTH
  mask.height = SOURCE_HEIGHT
  const ctx = mask.getContext('2d')!
  const water = new Path2D('M822 363L876 346L926 329L978 315L1015 305L1036 292L1155 292L1182 302L1238 304V461H1098L1100 445L1084 432L1067 421L1052 435L1040 452H822Z')
  const boat = new Path2D('M1047 333L1062 328L1094 337L1093 308L1134 291L1170 289L1189 299L1192 344L1204 352L1194 371L1175 381L1110 377L1063 366Z')
  ctx.fillStyle = '#fff'
  ctx.fill(water)
  ctx.globalCompositeOperation = 'destination-out'
  ctx.fill(boat)
  // An inset feather keeps displacement and its derivative near zero at solid
  // contours. No RGB overlay, rectangle alpha edge, or boat silhouette motion.
  ctx.strokeStyle = '#000'
  ctx.lineWidth = 9
  ctx.stroke(water)
  ctx.stroke(boat)
  const soft = document.createElement('canvas')
  soft.width = SOURCE_WIDTH
  soft.height = SOURCE_HEIGHT
  const softCtx = soft.getContext('2d')!
  softCtx.filter = 'blur(3px)'
  softCtx.drawImage(mask, 0, 0)
  softCtx.filter = 'none'
  softCtx.globalCompositeOperation = 'destination-in'
  softCtx.fill(water)
  softCtx.globalCompositeOperation = 'destination-out'
  softCtx.fill(boat)
  return soft
}

export const waterTownShader = `
uniform sampler2D waterMask;

float townLight(vec2 p, vec2 center, vec2 radius) {
  vec2 q = (p - center) / radius;
  return exp(-dot(q, q) * 2.);
}

vec4 waterTown(vec2 coord, float t) {
  vec2 size = vec2(1672., 941.);
  vec2 p = coord * size;
  vec4 original = texture2D(plane, coord);
  if (p.x < 719. || p.x > 1238. || p.y < 112. || p.y > 461.) return original;
  float water = texture2D(waterMask, coord).a;
  float perspective = smoothstep(286., 455., p.y);
  // Incommensurate travelling waves with slow phase modulation: no loop reset,
  // whole-patch translation or independently moving reflection overlay.
  float wandering = sin(p.x * .011 + t * .127) + .55 * sin(p.x * .027 - t * .083);
  float swell = sin(p.y * .076 - t * .61 + .62 * wandering);
  float ripple = sin(p.y * .205 + p.x * .017 - t * 1.17 + .72 * swell);
  float fine = sin(p.y * .47 - p.x * .031 + t * .79 + .35 * wandering);
  // Three to four source pixels at the nearest water is enough to read at
  // room scale while remaining smaller than the painted reflection strokes.
  vec2 flow = vec2(2.85 * swell + 1.42 * ripple + .62 * fine,
    .58 * ripple + .27 * fine);
  flow *= water * (.34 + .66 * perspective);
  vec4 moved = texture2D(plane, coord + flow / size);
  // Preserve original coverage: only far-plane RGB is refracted. Existing
  // room/desk passes then provide their usual physical occlusion.
  vec3 color = mix(original.rgb, moved.rgb, water);
  float warm = smoothstep(.045, .29, color.r - color.b);
  float broken = .58 + .42 * sin(p.x * .083 + p.y * .027 + t * .29 + wandering);
  float crest = sin(p.y * .218 - t * 1.21 + .48 * swell) * broken;
  // The base water breathes only a few percent. Existing warm reflection
  // strokes carry the clearer variation, so motion reads as reflected light
  // rather than a translucent effect laid on top of the illustration.
  color *= 1. + water * (.034 * crest + warm * (.118 * crest + .03 * fine));
  float lights = townLight(p, vec2(834.,140.),vec2(12.,20.))
    + townLight(p,vec2(865.,224.),vec2(15.,24.))
    + townLight(p,vec2(931.,239.),vec2(14.,22.))
    + townLight(p,vec2(974.,175.),vec2(9.,16.))
    + townLight(p,vec2(947.,263.),vec2(9.,16.))
    + townLight(p,vec2(1005.,250.),vec2(12.,18.))
    + townLight(p,vec2(1230.,241.),vec2(11.,30.))
    + townLight(p,vec2(1137.,333.),vec2(9.,16.))
    + townLight(p,vec2(1186.,326.),vec2(8.,14.));
  float breath = .012 * sin(t * .47 + p.x * .067)
    + .007 * sin(t * .193 + p.x * .031 + p.y * .02);
  color *= 1. + min(lights, 1.) * warm * breath;
  return vec4(color, original.a);
}
`
