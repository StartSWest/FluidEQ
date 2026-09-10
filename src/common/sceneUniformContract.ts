import type { IScenePack } from './scenePacks';

/**
 * What a scene shader is handed every frame, and the program it is wrapped in.
 *
 * Shared by the app and by the offline tool that signs packs, so the two
 * cannot drift: a pack is compiled against exactly this preamble on the author's
 * machine before it is signed, and against exactly this preamble in the app.
 *
 * THE PACK SUPPLIES A FUNCTION, NOT A PROGRAM. The app owns `#version`, the
 * precision, every uniform, the output and `main()`; the pack contributes only
 * `vec4 sceneColour(vec2 uv)`. So a pack cannot rename the output, cannot skip
 * the alpha clamp, cannot bypass the fade the app applies to what it returns —
 * and the line-number offset for a compile error is a constant to subtract
 * before logging, rather than something to work out per pack.
 */

/** Bumped when a uniform is added, removed or changes meaning. */
export const SCENE_CONTRACT_VERSION = 6;

/**
 * Texture widths. The 320 log-spaced spectrum points resample to 512 texels;
 * the 96 waveform samples to 128, so `u = 1` lands on the last sample rather
 * than clamp-repeating the edge.
 */
export const SPECTRUM_TEXELS = 512;
export const WAVEFORM_TEXELS = 128;

/**
 * `uTime` wraps here.
 *
 * A float32 at ten thousand seconds has spacing of about a millisecond, and a
 * 60 Hz motion built on it visibly stutters after a few hours. For an app that
 * lives in the notification area for weeks, hours is the normal case, not the
 * edge. An hour keeps every sub-second motion smooth, and no scene should care
 * where in the hour it is.
 */
export const SCENE_TIME_WRAP_S = 3600;

export const uniformNameForParam = (id: string): string => `uParam_${id}`;

/**
 * One triangle covering the viewport, positions from the vertex index.
 *
 * No buffer, no attribute, and — unlike a quad — no diagonal seam where two
 * triangles meet and every fragment along it is shaded twice.
 */
export const SCENE_VERTEX_SOURCE = `#version 300 es
out vec2 vUv;
void main() {
  vec2 corner = vec2((gl_VertexID << 1) & 2, gl_VertexID & 2);
  vUv = corner;
  gl_Position = vec4(corner * 2.0 - 1.0, 0.0, 1.0);
}
`;

const PREAMBLE_HEAD = `#version 300 es
precision highp float;
precision highp sampler2D;
// Seconds since the scene started, wrapped at ${SCENE_TIME_WRAP_S}. Advances only while audio plays.
uniform float uTime;
// The drawing buffer, in pixels.
uniform vec2 uResolution;
// Broadband level, 0..1, eased.
uniform float uLevel;
// 1 at a detected beat, falling to 0 as the flash ends.
uniform float uBeat;
// Bass, mid and treble energy, each 0..1.
uniform vec3 uBands;
// The app's accent colour, so a scene can honour the theme.
uniform vec3 uAccent;
// Multiplied into the result: the app's own fade across look changes.
uniform float uSceneFade;
// Spectrum: u = 0 is 16 Hz, u = 1 is 25 kHz, log-uniform. Red channel, 0..1.
uniform sampler2D uSpectrum;
// Contract 5: the same calibrated spectrum, eased with 180 ms attack and
// 420 ms release half-lives. Independent of the immediate musical accents.
uniform sampler2D uSpectrumSlow;
// Contract 6: occasional qualified musical accent (envelope, event serial).
// New events require a beat onset with bass/mid energy and 4.8–7.2 s separation.
uniform vec2 uMusicAccent;
// Waveform envelope: u spans the last window end to end. Red channel, 0..1.
uniform sampler2D uWaveform;
// Contract 2: signed colour atlas, bottom-left origin, premultiplied RGBA.
uniform sampler2D uArtwork;
// Contract 3: normalized panel coordinates (left, right, floor, ceiling).
// Spectrum 0..1 maps exactly to these positions on the live right-hand axis.
// Includes plot gutters and the live curve's height/position transform.
uniform vec4 uSpectrumRect;
in vec2 vUv;
out vec4 fragColor;
`;

const PREAMBLE_TAIL = `
void main() {
  fragColor = clamp(sceneColour(vUv), 0.0, 1.0) * uSceneFade;
}
`;

export interface IAssembledFragment {
  source: string;
  /**
   * Lines the app put ahead of the pack's own. Subtracted from a driver's
   * error line so the number points into what the author wrote.
   */
  sourceLineOffset: number;
}

/** The whole fragment program, with the pack's parameters declared as uniforms. */
export const assembleFragmentSource = (
  pack: IScenePack,
): IAssembledFragment => {
  const params = pack.params
    .map((param) => `uniform float ${uniformNameForParam(param.id)};`)
    .join('\n');
  const head = params ? `${PREAMBLE_HEAD}${params}\n` : PREAMBLE_HEAD;
  return {
    source: `${head}${pack.source}\n${PREAMBLE_TAIL}`,
    sourceLineOffset: head.split('\n').length - 1,
  };
};
