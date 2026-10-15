// Source coordinates in the accepted 1672 × 941 illustration. Bounds include
// the full compact support plus a margin, so partial redraws have no seams.
export const INDOOR_REGIONS = [
  { bounds: { left: 80, top: 70, right: 390, bottom: 455 }, depth: 'mid' },
  { bounds: { left: 520, top: 250, right: 720, bottom: 415 }, depth: 'mid' },
  { bounds: { left: 1480, top: 0, right: 1672, bottom: 285 }, depth: 'mid' },
  { bounds: { left: 1150, top: 390, right: 1672, bottom: 840 }, depth: 'near' },
  { bounds: { left: 1220, top: 380, right: 1490, bottom: 660 }, depth: 'mid' },
] as const

export const indoorAmbientShader = `
// Compact C1 falloff: value AND slope vanish before each redraw boundary.
float indoorWeight(vec2 p, vec2 center, vec2 radius) {
  vec2 q = (p - center) / radius;
  float w = max(0., 1. - dot(q, q));
  return w * w;
}

vec2 leafMotion(vec2 p, vec2 center, vec2 radius, float phase, float t) {
  vec2 q = (p - center) / radius;
  // Give the leaf a readable moving core instead of attenuating almost all
  // of it to subpixel motion. Both value and slope still vanish at the edge.
  float w = 1. - smoothstep(.08, 1., dot(q, q));
  float breeze = sin(t * .69 + phase + .38 * sin(t * .173 + phase));
  float drift = .65 * sin(t * 1.07 + phase * 2.3);
  float strength = .85 + .15 * sin(t * .127 + phase);
  return w * strength * vec2(3.5 * breeze + drift, 1.25 * sin(t * .57 + phase));
}

float earFlick(float t) {
  // One brief, smoothly eased twitch in each long interval, with a varying
  // onset and strength. Exactly zero at interval boundaries; no clock jump.
  float interval = floor(t / 17.);
  float seed = fract(sin(interval * 127.1 + 8.3) * 43758.5453);
  float local = mod(t, 17.) - (3. + 7. * seed);
  float outward = smoothstep(0., .24, local) * (1. - smoothstep(.32, .9, local));
  float settle = smoothstep(.65, .95, local) * (1. - smoothstep(.95, 1.55, local));
  return (outward - .23 * settle) * (.8 + .2 * seed);
}

vec2 indoorUV(vec2 coord, float t, float nearPlane) {
  vec2 p = coord * vec2(1672., 941.);
  vec2 delta = vec2(0.);
  if (nearPlane > .5) {
    // The resting paws/book contact stays fixed. Expand the upper torso only;
    // sample RGBA together so the existing clean plate fills the moving edge.
    float torso = smoothstep(1545., 1585., p.x);
    float base = 1. - smoothstep(508., 550., p.y);
    float top = smoothstep(430., 452., p.y);
    float phase = t * 1.47 + .22 * sin(t * .21);
    float inhale = pow(.5 + .5 * sin(phase), 1.45);
    delta.y = 4.8 * inhale * torso * base * top;
    // Flex just the left ear tip around its stationary root, not the face.
    float ear = indoorWeight(p, vec2(1493., 462.), vec2(23., 27.));
    delta += ear * earFlick(t) * vec2(3.2, -.9);
  } else {
    // Individual leaf clusters, with fixed stems/pot and unequal phases.
    delta += leafMotion(p, vec2(578.,296.), vec2(33.,22.), .2, t);
    delta += leafMotion(p, vec2(674.,291.), vec2(31.,21.), 1.7, t);
    delta += leafMotion(p, vec2(591.,353.), vec2(27.,30.), 3.1, t);
    delta += leafMotion(p, vec2(635.,375.), vec2(25.,29.), 4.8, t);
    delta += leafMotion(p, vec2(273.,178.), vec2(24.,28.), 2.4, t);
    delta += leafMotion(p, vec2(322.,219.), vec2(26.,28.), 5.6, t);
  }
  return coord + delta / vec2(1672., 941.);
}

vec4 indoorLight(vec4 color, vec2 coord, float t, float nearPlane) {
  vec2 p = coord * vec2(1672., 941.);
  float lamp = .045 * sin(t * .51 + .4 * sin(t * .137))
    + .015 * sin(t * .89 + 1.8);
  float moon = .050 * sin(t * .43 + 1.2 + .35 * sin(t * .113))
    + .018 * sin(t * .73 + 2.7);
  float change = 0.;
  if (nearPlane < .5) {
    change += lamp * indoorWeight(p, vec2(197.,244.), vec2(108.,165.));
    change += lamp * .8 * indoorWeight(p, vec2(280.,290.), vec2(100.,155.));
    change += moon * .5 * indoorWeight(p, vec2(1350.,520.), vec2(120.,130.));
    change += lamp * .7 * indoorWeight(p, vec2(1650.,120.), vec2(155.,155.));
  } else {
    change += moon * indoorWeight(p, vec2(1350.,524.), vec2(100.,119.));
    change += moon * .85 * indoorWeight(p, vec2(1355.,686.), vec2(190.,145.));
  }
  // Preserve painted hue, coverage and warm/cool balance. No additive halo.
  color.rgb *= 1. + change;
  return color;
}
`
