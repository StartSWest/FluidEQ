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
 *
 * Additional permission under GNU GPL version 3 section 7 — scenes.
 * A scene is a program in the OpenGL ES Shading Language written to be run by
 * FluidEQ through its scene contract: the declarations, entry point and
 * wrapper FluidEQ supplies around a function named `sceneColour`, together
 * with any artwork and metadata distributed with it. As a special exception,
 * the combination of a scene with that contract, when run by FluidEQ, does not
 * require the scene to be licensed under this License; you may license your
 * scene under terms of your choice. This permission does not apply to FluidEQ
 * itself or to any other part of it, and does not permit you to distribute
 * FluidEQ, or a modified version of it, under any licence other than this one.
 */

/**
 * Bumped when a uniform is added, removed or changes meaning. 8 added the
 * music's time, the drums, the song's shape, stereo, the singing voice, the
 * pointer, taps and the viewer's camera.
 */
export const SCENE_CONTRACT_VERSION = 8;

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

/**
 * `uTap.z` stops counting here, and "no tap yet" reads as this old: a ripple
 * sixty seconds on is long gone, and a scene needs no larger number to know
 * that nothing is happening.
 */
export const SCENE_TAP_AGE_LIMIT_S = 60;

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
// Spectrum: u = 0 is 20 Hz, u = 1 is 20 kHz, log-uniform. Red channel, 0..1.
uniform sampler2D uSpectrum;
// Contract 5: the same calibrated spectrum, eased with 180 ms attack and
// 420 ms release half-lives. Independent of the immediate musical accents.
uniform sampler2D uSpectrumSlow;
// Contract 6: occasional qualified musical accent (envelope, event serial).
// New events require a beat onset with bass/mid energy and 4.8–7.2 s separation.
uniform vec2 uMusicAccent;
// Contract 7: a flywheel the music winds, in turns, kept inside one turn so
// it can be read straight as an angle. Every kick and every loud passage adds
// to how fast it goes, it coasts down when they stop, and it is capped. A
// scene is given the music of this frame alone, so it cannot build a speed up
// itself: a hit in a shader is a nudge that fades, never a chorus carrying
// the picture along. y is how fast it is going, in turns a second, so a scene
// can answer its own speed - softening what it flashes as it runs, which is
// what keeps a bright picture under the brightness limiter.
uniform vec2 uMusicRun;
// Waveform envelope: u spans the last window end to end. Red channel, 0..1.
uniform sampler2D uWaveform;
// Contract 2: signed colour atlas, bottom-left origin, premultiplied RGBA.
uniform sampler2D uArtwork;
// Contract 3: normalized panel coordinates (left, right, floor, ceiling).
// Spectrum 0..1 maps exactly to these positions on the live right-hand axis.
// Includes plot gutters and the live curve's height/position transform.
uniform vec4 uSpectrumRect;
// Contract 8: the music's time. x beat phase, 0 on a beat rising evenly to 1
// where the next is expected; y bar phase, the same over a bar of four; z the
// tempo in beats a minute, 0 until heard; w how sure it is, 0..1.
uniform vec4 uRhythm;
// Contract 8: the drums, each 1 at its hit and falling away: x kick, y snare,
// z hats.
uniform vec3 uDrums;
// Contract 8: the song's shape. x how intense this part is against the rest
// of the song, y building towards something, z a drop landing (1, falling),
// w how many drops so far.
uniform vec4 uSong;
// Contract 8: x where the music leans, -1 left to 1 right; y how wide it is,
// 0 for mono to 1.
uniform vec2 uStereo;
// Contract 8: the singing voice. x how open a singer's mouth is now, 0..1,
// syllable by syllable; y the note being sung, 0 at 80 Hz to 1 at 1 kHz on a
// log scale, held between notes; z how sure it is that a voice is singing.
uniform vec3 uVoice;
// Contract 8: the pointer over the panel. xy where, in uv; z held down, 0..1;
// w over the panel, 0..1, fading after it leaves.
uniform vec4 uPointer;
// Contract 8: the last tap. xy where, in uv; z seconds since, up to
// ${SCENE_TAP_AGE_LIMIT_S}; w how many so far.
uniform vec4 uTap;
// Contract 8: the viewer's camera, turned by dragging within pack.json's
// camera limits. x yaw and y pitch in radians, z zoom (1 as authored).
uniform vec3 uCamera;
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

/**
 * The pack's `sceneColour` with every declaration it may use, and no `main()`:
 * what a 3D world finishes its picture around, with the shader as its sky
 * (`renderer/graph/world/worldComposite.ts`). Without the version line,
 * which the 3D renderer writes itself.
 */
export const assembleSceneFunctions = (
  pack: IScenePack,
): IAssembledFragment => {
  const params = pack.params
    .map((param) => `uniform float ${uniformNameForParam(param.id)};`)
    .join('\n');
  const bare = PREAMBLE_HEAD.replace(/^#version 300 es\n/, '');
  const head = params ? `${bare}${params}\n` : bare;
  return {
    source: `${head}${pack.source}\n`,
    sourceLineOffset: head.split('\n').length - 1,
  };
};
