// Shared GLSL ES 3.00 math helpers: PCG hashes (because sin() hashes look terrible on Intel GPUs),
// explicit floats everywhere, NaN guards, and linear HDR -> AgX -> sRGB -> dither output.

export const GLSL3_COMMON_AND_HASH = /* glsl */ `
const float PI  = 3.14159265358979;
const float TAU = 6.28318530717959;

float saturate(float x) { return clamp(x, 0.0, 1.0); }
vec3 saturate(vec3 x) { return clamp(x, 0.0, 1.0); }
float dot2(vec2 v) { return dot(v, v); }

mat2 rot2(float a) {
  vec2 cs = normalize(vec2(cos(a), sin(a)));
  return mat2(cs.x, cs.y, -cs.y, cs.x);
}

float cubicPulse(float c, float w, float x) {
  x = abs(x - c);
  if (x > w) return 0.0;
  x /= max(w, 1e-6);
  return 1.0 - x * x * (3.0 - 2.0 * x);
}

uint pcgHash(uint v) {
  uint state = v * 747796405u + 2891336453u;
  uint word = ((state >> ((state >> 28u) + 4u)) ^ state) * 277803737u;
  return (word >> 22u) ^ word;
}

uvec3 pcg3d(uvec3 v) {
  v = v * 1664525u + 1013904223u;
  v.x += v.y * v.z;
  v.y += v.z * v.x;
  v.z += v.x * v.y;
  v ^= v >> 16u;
  v.x += v.y * v.z;
  v.y += v.z * v.x;
  v.z += v.x * v.y;
  return v;
}

float uintToUnit(uint h) { return float(h >> 8u) * (1.0 / 16777216.0); }
vec2 uintToUnit(uvec2 h) { return vec2(h >> 8u) * (1.0 / 16777216.0); }
vec3 uintToUnit(uvec3 h) { return vec3(h >> 8u) * (1.0 / 16777216.0); }

float hash12(vec2 p) {
  uvec2 q = uvec2(ivec2(floor(p)));
  return uintToUnit(pcgHash(q.x + pcgHash(q.y)));
}

vec2 hash22(vec2 p) {
  ivec2 q = ivec2(floor(p));
  return uintToUnit(pcg3d(uvec3(q.x, q.y, 0x2545u))).xy;
}

vec3 hash33(vec3 p) {
  return uintToUnit(pcg3d(uvec3(ivec3(floor(p)))));
}
`;

export const GLSL3_NOISE = /* glsl */ `
vec2 quinticFade(vec2 f) { return f * f * f * (f * (f * 6.0 - 15.0) + 10.0); }
vec3 quinticFade(vec3 f) { return f * f * f * (f * (f * 6.0 - 15.0) + 10.0); }

vec2 latticeGradient(vec2 cell) {
  uvec2 q = uvec2(ivec2(floor(cell)));
  uint h = pcgHash(q.x + pcgHash(q.y)) & 7u;
  if (h == 0u) return vec2(1.0, 0.0);
  if (h == 1u) return vec2(-1.0, 0.0);
  if (h == 2u) return vec2(0.0, 1.0);
  if (h == 3u) return vec2(0.0, -1.0);
  if (h == 4u) return vec2(0.70710678, 0.70710678);
  if (h == 5u) return vec2(-0.70710678, 0.70710678);
  if (h == 6u) return vec2(0.70710678, -0.70710678);
  return vec2(-0.70710678, -0.70710678);
}

float gradientNoise(vec2 p) {
  vec2 i = floor(p), f = fract(p);
  vec2 u = quinticFade(f);
  float va = dot(latticeGradient(i), f);
  float vb = dot(latticeGradient(i + vec2(1.0, 0.0)), f - vec2(1.0, 0.0));
  float vc = dot(latticeGradient(i + vec2(0.0, 1.0)), f - vec2(0.0, 1.0));
  float vd = dot(latticeGradient(i + vec2(1.0, 1.0)), f - vec2(1.0, 1.0));
  return mix(mix(va, vb, u.x), mix(vc, vd, u.x), u.y);
}

float latticeGradDot(vec3 cell, vec3 corner, vec3 f) {
  vec3 g = hash33(cell + corner) * 2.0 - 1.0;
  return dot(g, f - corner);
}

float gradientNoise(vec3 p) {
  vec3 i = floor(p), f = fract(p);
  vec3 u = quinticFade(f);
  return mix(
    mix(mix(latticeGradDot(i, vec3(0.0, 0.0, 0.0), f), latticeGradDot(i, vec3(1.0, 0.0, 0.0), f), u.x),
        mix(latticeGradDot(i, vec3(0.0, 1.0, 0.0), f), latticeGradDot(i, vec3(1.0, 1.0, 0.0), f), u.x), u.y),
    mix(mix(latticeGradDot(i, vec3(0.0, 0.0, 1.0), f), latticeGradDot(i, vec3(1.0, 0.0, 1.0), f), u.x),
        mix(latticeGradDot(i, vec3(0.0, 1.0, 1.0), f), latticeGradDot(i, vec3(1.0, 1.0, 1.0), f), u.x), u.y),
    u.z
  );
}

float fbm(vec2 p, int octaves) {
  const mat2 octaveRotation = mat2(0.8, 0.6, -0.6, 0.8);
  float sum = 0.0, amp = 1.0, norm = 0.0;
  for (int i = 0; i < 6; i++) {
    if (i >= octaves) break;
    sum += amp * gradientNoise(p);
    norm += amp;
    amp *= 0.5;
    p = 2.01 * (octaveRotation * p) + vec2(17.13, -3.71);
  }
  return 1.4 * sum / max(norm, 1e-6);
}

float fbm(vec3 p, int octaves) {
  const mat3 octaveRotation = mat3(
     0.00,  0.80,  0.60,
    -0.80,  0.36, -0.48,
    -0.60, -0.48,  0.64
  );
  float sum = 0.0, amp = 1.0, norm = 0.0;
  for (int i = 0; i < 5; i++) {
    if (i >= octaves) break;
    sum += amp * gradientNoise(p);
    norm += amp;
    amp *= 0.5;
    p = 2.01 * (octaveRotation * p) + vec3(17.13, -3.71, 5.29);
  }
  return sum / max(norm, 1e-6);
}

float ridgedFbm(vec2 p, int octaves) {
  const mat2 octaveRotation = mat2(0.8, 0.6, -0.6, 0.8);
  float sum = 0.0, amp = 0.5, weight = 1.0, norm = 0.0;
  for (int i = 0; i < 5; i++) {
    if (i >= octaves) break;
    float n = 1.0 - abs(gradientNoise(p) * 1.4);
    n *= n;
    sum += amp * n * weight;
    norm += amp;
    weight = clamp(n * 2.0, 0.0, 1.0);
    amp *= 0.5;
    p = 2.01 * (octaveRotation * p) + vec2(17.13, -3.71);
  }
  return sum / max(norm, 1e-6);
}

float turbulence3(vec3 p, int octaves) {
  const mat3 octaveRotation = mat3(
     0.00,  0.80,  0.60,
    -0.80,  0.36, -0.48,
    -0.60, -0.48,  0.64
  );
  float sum = 0.0, amp = 1.0, norm = 0.0;
  for (int i = 0; i < 5; i++) {
    if (i >= octaves) break;
    sum += amp * min(abs(gradientNoise(p)), 1.0);
    norm += amp;
    amp *= 0.5;
    p = 2.01 * (octaveRotation * p) + vec3(17.13, -3.71, 5.29);
  }
  return sum / max(norm, 1e-6);
}

float warpedFbm(vec2 p, float strength, int octaves, out vec2 q, out vec2 r) {
  int subOct = max(1, octaves - 1);
  q = vec2(fbm(p, subOct), fbm(p + vec2(3.1, 7.4), subOct));
  r = vec2(fbm(p + strength * q + vec2(9.7, 2.6), subOct),
           fbm(p + strength * q + vec2(6.3, 1.9), subOct));
  return fbm(p + strength * r, octaves);
}
`;

export const GLSL3_PATTERN = /* glsl */ `
float filteredGrid(vec2 p, vec2 w, float n) {
  w = max(w, vec2(1e-4));
  vec2 a = p + 0.5 * w;
  vec2 b = p - 0.5 * w;
  vec2 i = (floor(a) + min(fract(a) * n, 1.0) - floor(b) - min(fract(b) * n, 1.0)) / (n * w);
  return 1.0 - (1.0 - i.x) * (1.0 - i.y);
}

vec4 hexGrid(vec2 p) {
  const vec2 s = vec2(1.0, 1.7320508);
  vec2 a = mod(p, s) - 0.5 * s;
  vec2 b = mod(p - 0.5 * s, s) - 0.5 * s;
  vec2 local = (dot(a, a) < dot(b, b)) ? a : b;
  vec2 center = p - local;
  vec2 id = floor(vec2(center.x * 2.0, center.y * 1.1547005) + 0.5);
  return vec4(local, id);
}

float hexEdgeDistance(vec2 local) {
  vec2 a = abs(local);
  return 0.5 - max(a.x, dot(a, vec2(0.5, 0.8660254)));
}
`;

export const GLSL3_COLOR_AND_SHADING = /* glsl */ `
vec3 srgbToLinear(vec3 c) {
  c = max(c, 0.0);
  return mix(c / 12.92, pow((c + 0.055) / 1.055, vec3(2.4)), step(0.04045, c));
}

vec3 linearToSrgb(vec3 c) {
  c = max(c, 0.0);
  return mix(c * 12.92, 1.055 * pow(c, vec3(1.0 / 2.4)) - 0.055, step(0.0031308, c));
}

vec3 linearSrgbToOklab(vec3 c) {
  vec3 lms = c * mat3(0.4122214708, 0.5363325363, 0.0514459929,
                      0.2119034982, 0.6806995451, 0.1073969566,
                      0.0883024619, 0.2817188376, 0.6299787005);
  lms = sign(lms) * pow(abs(lms), vec3(1.0 / 3.0));
  return lms * mat3(0.2104542553, 0.7936177850, -0.0040720468,
                    1.9779984951, -2.4285922050, 0.4505937099,
                    0.0259040371, 0.7827717662, -0.8086757660);
}

vec3 oklabToLinearSrgb(vec3 lab) {
  vec3 lms = lab * mat3(1.0, 0.3963377774, 0.2158037573,
                        1.0, -0.1055613458, -0.0638541728,
                        1.0, -0.0894841775, -1.2914855480);
  lms = lms * lms * lms;
  return lms * mat3(4.0767416621, -3.3077115913, 0.2309699292,
                    -1.2684380046, 2.6097574011, -0.3413193965,
                    -0.0041960863, -0.7034186147, 1.7076147010);
}

vec3 mixOklab(vec3 a, vec3 b, float t) {
  return oklabToLinearSrgb(mix(linearSrgbToOklab(a), linearSrgbToOklab(b), t));
}

vec3 blackbody(float kelvin) {
  float T = clamp(kelvin, 1000.0, 15000.0);
  float u = (0.860117757 + 1.54118254e-4 * T + 1.28641212e-7 * T * T) / (1.0 + 8.42420235e-4 * T + 7.08145163e-7 * T * T);
  float v = (0.317398726 + 4.22806245e-5 * T + 4.20481691e-8 * T * T) / (1.0 - 2.89741816e-5 * T + 1.61456053e-7 * T * T);
  float x = 3.0 * u / max(2.0 * u - 8.0 * v + 4.0, 1e-6);
  float y = 2.0 * v / max(2.0 * u - 8.0 * v + 4.0, 1e-6);
  vec3 xyz = vec3(x / max(y, 1e-6), 1.0, (1.0 - x - y) / max(y, 1e-6));
  vec3 rgb = xyz * mat3( 3.2406, -1.5372, -0.4986,
                        -0.9689,  1.8758,  0.0415,
                         0.0557, -0.2040,  1.0570);
  rgb = max(rgb, 0.0);
  return rgb / max(max(rgb.r, rgb.g), max(rgb.b, 1e-6));
}

vec3 fresnelSchlick(float u, vec3 f0) {
  float m = clamp(1.0 - u, 0.0, 1.0);
  float m2 = m * m;
  return f0 + (1.0 - f0) * (m2 * m2 * m);
}

float rimLight(vec3 n, vec3 v, float power) {
  return pow(clamp(1.0 - max(dot(n, v), 0.0), 0.0, 1.0), power);
}
`;

export const GLSL3_POST_AND_TONEMAP = /* glsl */ `
float vignette(vec2 uv, float focal) {
  float f2 = focal * focal;
  float k = f2 / (f2 + dot(uv, uv));
  return k * k;
}

vec3 filmGrain(vec3 col, float amount, float n) {
  return col + amount * sqrt(max(col, 0.0)) * n;
}

vec3 ditherTPDF(vec2 fragCoord, int frame) {
  vec2 r = hash22(vec2(floor(fragCoord) + 7919.0 * float(frame % 1024)));
  return vec3((r.x + r.y - 1.0) / 255.0);
}

vec3 tonemapAgXPunchy(vec3 c) {
  const mat3 inset = mat3(0.842479062253094, 0.0423282422610123, 0.0423756549057051,
                          0.0784335999999992, 0.878468636469772, 0.0784336,
                          0.0792237451477643, 0.0791661274605434, 0.879142973793104);
  const mat3 outset = mat3( 1.19687900512017, -0.0528968517574562, -0.0529716355144438,
                           -0.0980208811401368, 1.15190312990417, -0.0980434501171241,
                           -0.0990297440797205, -0.0989611768448433, 1.15107367264116);
  const float minEv = -12.47393, maxEv = 4.026069;
  c = inset * max(c, 0.0);
  c = clamp((log2(max(c, 1e-10)) - minEv) / (maxEv - minEv), 0.0, 1.0);
  vec3 x2 = c * c, x4 = x2 * x2;
  c = 15.5 * x4 * x2 - 40.14 * x4 * c + 31.96 * x4 - 6.868 * x2 * c + 0.4298 * x2 + 0.1191 * c - 0.00232;
  c = pow(max(c, 0.0), vec3(1.22));
  float luma = dot(c, vec3(0.2126, 0.7152, 0.0722));
  c = luma + 1.24 * (c - luma);
  c = outset * c;
  return pow(max(c, 0.0), vec3(2.2));
}
`;
