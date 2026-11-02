// Written by .erb/scripts/generate-sound-hops-fixture.ts from
// src/renderer/graph/sceneFlashGuardGpu.ts. Do not edit; regenerate.
#pragma once

namespace feq::scene::flash {

inline constexpr const char* kVertexSource = R"glsl(#version 300 es
out vec2 vUv;
void main() {
  vec2 corner = vec2((gl_VertexID << 1) & 2, gl_VertexID & 2);
  vUv = corner;
  gl_Position = vec4(corner * 2.0 - 1.0, 0.0, 1.0);
}
)glsl";
inline constexpr const char* kStateSource = R"glsl(#version 300 es
precision highp float;
uniform sampler2D uCurrent;
uniform sampler2D uLastFrame;
uniform sampler2D uState;
uniform float uDecay;
/** Seconds this frame took, for the gap between turns. */
uniform float uElapsed;
/** What the flashing flag is multiplied by over this frame. */
uniform float uFlashDecay;
in vec2 vUv;
out vec4 state;

vec3 lightOf(vec3 colour) {
  return pow(max(colour, vec3(0.0)), vec3(2.2));
}

float lumaOfLight(vec3 light) {
  return dot(light, vec3(0.2126, 0.7152, 0.0722));
}

// Saturated red: red light well above both green and blue.
float rednessOfLight(vec3 light) {
  return max(0.0, light.r - max(light.g, light.b));
}

float luma(vec3 colour) {
  return lumaOfLight(lightOf(colour));
}

float redness(vec3 colour) {
  return rednessOfLight(lightOf(colour));
}

float flashTravel(float last, float swing, float decay) {
  float carried = last * swing < 0.0 ? swing : last * decay + swing;
  return abs(swing) >= 0.100
    ? sign(swing)
    : clamp(carried, -1.0, 1.0);
}

void main() {
  vec3 now = textureLod(uCurrent, vUv, 1.0).rgb;
  vec3 before = textureLod(uLastFrame, vUv, 1.0).rgb;
  float lumaSwing = luma(now) - luma(before);
  float redSwing = redness(now) - redness(before);
  float swing = abs(redSwing) > abs(lumaSwing) ? redSwing : lumaSwing;
  vec4 old = textureLod(uState, vUv, 0.0);
  float lastSwing = old.g * 2.0 - 1.0;
  // Travel — see FLASH_PRESSURE_MEMORY_SOURCE, whose text this is.
  float remembered = flashTravel(lastSwing, swing, uDecay);
  // A TURN of that travel, not a swing: a flash is a pair of changes, and
  // counting changes counts a square wave twice a cycle against a ramp's
  // once. See flashStep, which is this.
  // A RISE, not either end of the pair: one of these a flash, evenly spaced
  // for a strobe and for a ramp that snaps back alike. See FLASH_PERIOD_S.
  float opposing = remembered > 0.0
    && lastSwing <= -0.100 ? 1.0 : 0.0;
  // Red counts the seconds SINCE the last turn, and the gap this turn closes
  // is everything since it, this frame included. Counting up rather than
  // decaying down is what lets eight bits hold it at any frame rate: a second
  // over 255 steps is 3.9 ms, and the number this has to resolve is a sixth
  // of a second. See flashStep for why the level it replaced could not.
  float gap = min(1.0, old.r + uElapsed);
  float tooSoon = opposing
    * (gap < 0.325333 ? 1.0 : 0.0);
  float sinceTurn = opposing > 0.5 ? 0.0 : gap;
  // Blue is whether this spot is flashing, kept apart from the gap so its
  // mips are the share of an area that is. Set outright by a turn that came
  // too soon and only smoothed on the way down, which is what a level built
  // up over turns could never be.
  // Holds while the pixel is still inside a period of its last rise, and
  // falls only once a whole one has gone by without one. Decaying between
  // rises let 3.75, 4 and 5 a second through in the dip — see flashStep.
  float held = gap < 0.333333
    ? old.b
    : old.b * uFlashDecay;
  float flashing = max(held, tooSoon);
  // Alpha is unused.
  state = vec4(sinceTurn, remembered * 0.5 + 0.5, flashing, 0.0);
}
)glsl";
inline constexpr const char* kCalmSource = R"glsl(#version 300 es
precision highp float;
uniform sampler2D uCurrent;
uniform sampler2D uCalm;
uniform float uLod;
uniform float uAllowance;
uniform float uFirst;
in vec2 vUv;
out vec4 calmOut;

vec3 lightOf(vec3 colour) {
  return pow(max(colour, vec3(0.0)), vec3(2.2));
}

float lumaOfLight(vec3 light) {
  return dot(light, vec3(0.2126, 0.7152, 0.0722));
}

// Saturated red: red light well above both green and blue.
float rednessOfLight(vec3 light) {
  return max(0.0, light.r - max(light.g, light.b));
}

float luma(vec3 colour) {
  return lumaOfLight(lightOf(colour));
}

float redness(vec3 colour) {
  return rednessOfLight(lightOf(colour));
}

void main() {
  vec3 region = lightOf(textureLod(uCurrent, vUv, uLod).rgb);
  if (uFirst > 0.5) {
    calmOut = vec4(region, 1.0);
    return;
  }
  vec3 was = texture(uCalm, vUv).rgb;
  float change = max(
    abs(lumaOfLight(region) - lumaOfLight(was)),
    abs(rednessOfLight(region) - rednessOfLight(was)));
  calmOut = vec4(
    was + (region - was) * (change > uAllowance ? uAllowance / change : 1.0),
    1.0);
}
)glsl";
inline constexpr const char* kCompositeSource = R"glsl(#version 300 es
precision highp float;
uniform sampler2D uCurrent;
uniform sampler2D uCalm;
uniform sampler2D uState;
uniform float uAreaLod;
in vec2 vUv;
out vec4 fragColor;

vec3 lightOf(vec3 colour) {
  return pow(max(colour, vec3(0.0)), vec3(2.2));
}

float lumaOfLight(vec3 light) {
  return dot(light, vec3(0.2126, 0.7152, 0.0722));
}

// Saturated red: red light well above both green and blue.
float rednessOfLight(vec3 light) {
  return max(0.0, light.r - max(light.g, light.b));
}

float luma(vec3 colour) {
  return lumaOfLight(lightOf(colour));
}

float redness(vec3 colour) {
  return rednessOfLight(lightOf(colour));
}

void main() {
  vec4 current = texture(uCurrent, vUv);
  // How much of this pixel is flashing: its flag (FLAG_LOD), weighed by how
  // much of the area around it is flashing too (FLASH_AREA_START).
  vec2 reach = 0.5 * pow(2.0, uAreaLod) / vec2(textureSize(uState, 0));
  float area = 0.25 * (
      textureLod(uState, vUv + vec2(-reach.x, -reach.y), uAreaLod).b
    + textureLod(uState, vUv + vec2( reach.x, -reach.y), uAreaLod).b
    + textureLod(uState, vUv + vec2(-reach.x,  reach.y), uAreaLod).b
    + textureLod(uState, vUv + vec2( reach.x,  reach.y), uAreaLod).b);
  float flashing = textureLod(uState, vUv, 2.0).b
    * smoothstep(0.20, 0.35, area);
  // Nothing flashing here: exactly what the scene drew.
  if (flashing <= 0.0) {
    fragColor = current;
    return;
  }
  float calmed = flashing * flashing * flashing;
  vec3 light = mix(lightOf(current.rgb), texture(uCalm, vUv).rgb, calmed);
  fragColor = vec4(pow(light, vec3(1.0 / 2.2)), current.a);
}
)glsl";

inline constexpr double kLimitPerSecond = 0.28;
inline constexpr double kMaxFrameMs = 100.0;
inline constexpr double kCalmTexels = 64.0;
inline constexpr double kRestSinceTurn = 1.0;
inline constexpr double kRestFlashing = 0.0;
inline constexpr double kFlashingMemoryS = 0.5;
inline constexpr double kTravelSeconds = 4.0;
inline constexpr double kAreaWindow = 4.0;

}  // namespace feq::scene::flash
