// Source-pixel coordinates: the emission stays inside the accepted mug opening.
// Advection samples an unbounded noise field; no lifetime or keyframe resets.
export const steamShader = `
float steamHash(vec2 p) {
  return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453);
}
float steamNoise(vec2 p) {
  vec2 cell = floor(p), f = fract(p);
  f = f * f * (3. - 2. * f);
  return mix(mix(steamHash(cell), steamHash(cell + vec2(1., 0.)), f.x),
             mix(steamHash(cell + vec2(0., 1.)), steamHash(cell + vec2(1.)), f.x), f.y);
}
float steamFbm(vec2 p) {
  float value = 0., weight = .53;
  for (int i = 0; i < 4; i++) {
    value += weight * steamNoise(p);
    p = mat2(1.6, 1.2, -1.2, 1.6) * p + vec2(13.7, 8.3);
    weight *= .48;
  }
  return value;
}
float steamPlume(vec2 p, float seconds, float originX, float phase, float lean, float strength) {
  float height = (551. - p.y) / 125.;
  if (height <= 0. || height >= 1. || p.x < 500. || p.x > 660.) return 0.;
  // Negative time in height-space transports density UP away from the cup.
  float flow = height * 3.1 - seconds * .28 + phase;
  float wind = (steamFbm(vec2(height * 2.6 + phase, seconds * .12 + phase)) - .5)
             * (8. + 58. * height) + lean * height;
  // Start as two fine convection threads at the liquid, then let them mingle
  // and broaden above the rim. A wide base reads as a pasted horizontal band.
  float width = 7. + 28. * height;
  float across = (p.x - originX - wind * smoothstep(0., .22, height)) / width;
  vec2 field = vec2(across * 1.5, flow);
  vec2 curl = vec2(steamFbm(field + vec2(phase, seconds * .035)),
                   steamFbm(field + vec2(8.2 + phase, -seconds * .047))) - .5;
  float density = steamFbm(field + curl * 2.8);
  float filaments = steamFbm(field * vec2(3.2, 1.4) + curl * 3.5 + vec2(19. + phase));
  float envelope = exp(-across * across * 1.5)
                 * smoothstep(0., .13, height) * (1. - smoothstep(.42, 1., height));
  float supply = .78 + .32 * steamNoise(vec2(seconds * .19 + phase, 4.7 + phase));
  return envelope * supply * smoothstep(.2, .76, density) * (.5 + filaments) * strength;
}
vec3 coffeeSteam(vec2 p, float seconds) {
  float mainMist = steamPlume(p, seconds, 581., 0., 0., 1.);
  // A softer, independently evolving source fills the marked left half.
  // Its slight left lean prevents the two sources from forming one thick stem.
  float leftMist = steamPlume(p, seconds * .94, 553., 11.6, -9., .58);
  float mist = mainMist + leftMist * (1. - clamp(mainMist * .7, 0., .7));
  // Light-only premultiplied contribution, like P10's extracted translucent steam.
  return vec3(.72, .70, .67) * mist * .46;
}
`;

export const STEAM_BOUNDS = { left: 500, top: 425, right: 660, bottom: 552 } as const
