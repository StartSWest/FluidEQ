import type { IScenePack } from 'common/scenePacks';
import { getEaseFactor } from 'common/smoothing';
import {
  assembleFragmentSource,
  SPECTRUM_TEXELS,
  uniformNameForParam,
  WAVEFORM_TEXELS,
} from 'common/sceneUniformContract';
import { SCENE_CONTEXT_ATTRIBUTES } from './sceneHealth';
import { linkSceneProgram } from './sceneCompile';
import compileWorldScene from './sceneWorldLoader';

/**
 * The GL side of a scene: one program, audio textures, optional artwork, one triangle.
 *
 * Deliberately no library. The whole surface is a fullscreen fragment shader
 * with a dozen uniforms, and a wrapper would be the largest new dependency in
 * the tree for a hundred lines of setup this file does once.
 *
 * NOT UNIT-TESTED, by decision. jsdom answers null for every context, and a
 * fake `WebGL2RenderingContext` would test the fake. Everything on either side
 * of this file is tested; this file is verified by looking at the window.
 */

export interface ISceneFrame {
  timeSeconds: number;
  deltaMs?: number;
  level: number;
  beat: number;
  bands: readonly [number, number, number];
  /**
   * The big musical moment as the listener heard it: its envelope 0..1 and
   * the number of the moment, for a scene that wants a fresh seed each time.
   * Derived here from beats once, which made it a beat every five seconds
   * rather than a moment.
   */
  musicAccent: readonly [number, number];
  /** The flywheel the music winds: turns (inside one), and turns a second. */
  musicRun: readonly [number, number];
  accent: readonly [number, number, number];
  fade: number;
  spectrum: Uint8Array;
  spectrumRect?: readonly [number, number, number, number];
  waveform: Uint8Array;
  params: Readonly<Record<string, number>>;
}

export interface ISceneProgram {
  /** Upload this frame's measurement and draw one triangle. */
  draw(frame: ISceneFrame, width: number, height: number): void;
  isSettled(): boolean;
  /**
   * The musical accent's envelope as the scene last received it, 0..1. It is
   * derived here, not in the frame, so the Studio's meter reads it from here.
   */
  musicAccent(): number;
  dispose(): void;
}

export type TSceneCompileResult =
  | {
      ok: true;
      program: ISceneProgram;
      /**
       * What a 3D world left out and why — a model it could not read, or the
       * whole world when it fell back to its shader — for the scene's author.
       */
      notes?: string[];
    }
  | { ok: false; log: string };

export const createSceneContext = (
  canvas: HTMLCanvasElement | OffscreenCanvas,
): WebGL2RenderingContext | null => {
  try {
    return canvas.getContext(
      'webgl2',
      SCENE_CONTEXT_ATTRIBUTES,
    ) as WebGL2RenderingContext | null;
  } catch {
    return null;
  }
};

const createDataTexture = (
  gl: WebGL2RenderingContext,
  width: number,
): WebGLTexture | null => {
  const texture = gl.createTexture();
  if (!texture) {
    return null;
  }
  gl.bindTexture(gl.TEXTURE_2D, texture);
  // A row width that is not a multiple of four otherwise reads adjacent
  // memory as padding, silently. Both widths here happen to be, but the
  // assumption should not be load-bearing.
  gl.pixelStorei(gl.UNPACK_ALIGNMENT, 1);
  gl.texImage2D(
    gl.TEXTURE_2D,
    0,
    gl.R8,
    width,
    1,
    0,
    gl.RED,
    gl.UNSIGNED_BYTE,
    null,
  );
  // LINEAR without mipmaps. `LINEAR_MIPMAP_*` on a texture with one level is
  // "incomplete" and samples pure black — the classic silent WebGL failure.
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
  return texture;
};

const compileShaderScene = async (
  gl: WebGL2RenderingContext,
  pack: IScenePack,
  artwork?: ImageBitmap,
  signal?: AbortSignal,
): Promise<TSceneCompileResult> => {
  if (pack.artwork && !artwork) {
    return { ok: false, log: 'scene artwork was not decoded' };
  }
  const { source, sourceLineOffset } = assembleFragmentSource(pack);

  const linked = await linkSceneProgram(gl, source, sourceLineOffset, signal);
  if (!linked.ok) {
    return linked;
  }
  const { program } = linked;

  const spectrumTexture = createDataTexture(gl, SPECTRUM_TEXELS);
  const waveformTexture = createDataTexture(gl, WAVEFORM_TEXELS);
  const slowLocation = gl.getUniformLocation(program, 'uSpectrumSlow');
  const slowTexture = slowLocation
    ? createDataTexture(gl, SPECTRUM_TEXELS)
    : null;
  if (!spectrumTexture || !waveformTexture || (slowLocation && !slowTexture)) {
    gl.deleteTexture(spectrumTexture);
    gl.deleteTexture(waveformTexture);
    gl.deleteTexture(slowTexture);
    gl.deleteProgram(program);
    return { ok: false, log: 'could not create textures' };
  }

  const artworkTexture = artwork ? gl.createTexture() : null;
  if (artwork && !artworkTexture) {
    gl.deleteTexture(spectrumTexture);
    gl.deleteTexture(waveformTexture);
    gl.deleteTexture(slowTexture);
    gl.deleteProgram(program);
    return { ok: false, log: 'could not create artwork texture' };
  }
  if (artwork && artworkTexture) {
    gl.bindTexture(gl.TEXTURE_2D, artworkTexture);
    gl.texImage2D(
      gl.TEXTURE_2D,
      0,
      gl.RGBA,
      gl.RGBA,
      gl.UNSIGNED_BYTE,
      artwork,
    );
    gl.texParameteri(
      gl.TEXTURE_2D,
      gl.TEXTURE_MIN_FILTER,
      gl.LINEAR_MIPMAP_LINEAR,
    );
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    gl.generateMipmap(gl.TEXTURE_2D);
  }

  const location = (name: string) => gl.getUniformLocation(program, name);
  const uniforms = {
    time: location('uTime'),
    resolution: location('uResolution'),
    level: location('uLevel'),
    beat: location('uBeat'),
    musicAccent: location('uMusicAccent'),
    musicRun: location('uMusicRun'),
    bands: location('uBands'),
    accent: location('uAccent'),
    fade: location('uSceneFade'),
    spectrum: location('uSpectrum'),
    spectrumRect: location('uSpectrumRect'),
    waveform: location('uWaveform'),
    artwork: location('uArtwork'),
  };
  const paramLocations = pack.params.map((param) => ({
    id: param.id,
    location: location(uniformNameForParam(param.id)),
    fallback: param.value,
  }));

  // A vertex array is required in WebGL2 even with no attributes bound.
  const vao = gl.createVertexArray();
  const slowValues = new Float32Array(SPECTRUM_TEXELS);
  const slowBytes = new Uint8Array(SPECTRUM_TEXELS);
  let previousTime: number | undefined;
  let settled = true;
  // What the scene was last given, for the runner's own checks.
  let lastAccent = 0;

  return {
    ok: true,
    program: {
      draw: (frame, width, height) => {
        gl.viewport(0, 0, width, height);
        gl.useProgram(program);
        gl.bindVertexArray(vao);

        [lastAccent] = frame.musicAccent;
        if (uniforms.musicAccent) {
          gl.uniform2f(
            uniforms.musicAccent,
            frame.musicAccent[0],
            frame.musicAccent[1],
          );
        }
        if (uniforms.musicRun) {
          gl.uniform2f(uniforms.musicRun, frame.musicRun[0], frame.musicRun[1]);
        }

        gl.activeTexture(gl.TEXTURE0);
        gl.bindTexture(gl.TEXTURE_2D, spectrumTexture);
        // `texSubImage2D`, never `texImage2D`: reallocating two textures sixty
        // times a second is what would make this approach expensive.
        gl.texSubImage2D(
          gl.TEXTURE_2D,
          0,
          0,
          0,
          SPECTRUM_TEXELS,
          1,
          gl.RED,
          gl.UNSIGNED_BYTE,
          frame.spectrum,
        );
        gl.uniform1i(uniforms.spectrum, 0);

        if (slowTexture) {
          // Raw analyser updates arrive in steps. Ease only the atmospheric
          // texture; boats and meters retain their independent fast response.
          const elapsed =
            previousTime === undefined
              ? 0
              : Math.max(
                  0,
                  Math.min(
                    100,
                    frame.deltaMs ?? (frame.timeSeconds - previousTime) * 1000,
                  ),
                );
          const attack = getEaseFactor(elapsed, 180);
          const release = getEaseFactor(elapsed, 420);
          settled = true;
          for (let i = 0; i < SPECTRUM_TEXELS; i += 1) {
            const target = frame.spectrum[i];
            if (previousTime === undefined) {
              slowValues[i] = target;
            }
            slowValues[i] +=
              (target - slowValues[i]) *
              (target > slowValues[i] ? attack : release);
            slowBytes[i] = Math.round(slowValues[i]);
            if (Math.abs(target - slowValues[i]) > 0.25) {
              settled = false;
            }
          }
          previousTime = frame.timeSeconds;
          gl.activeTexture(gl.TEXTURE3);
          gl.bindTexture(gl.TEXTURE_2D, slowTexture);
          gl.texSubImage2D(
            gl.TEXTURE_2D,
            0,
            0,
            0,
            SPECTRUM_TEXELS,
            1,
            gl.RED,
            gl.UNSIGNED_BYTE,
            slowBytes,
          );
          gl.uniform1i(slowLocation, 3);
        }

        gl.activeTexture(gl.TEXTURE1);
        gl.bindTexture(gl.TEXTURE_2D, waveformTexture);
        gl.texSubImage2D(
          gl.TEXTURE_2D,
          0,
          0,
          0,
          WAVEFORM_TEXELS,
          1,
          gl.RED,
          gl.UNSIGNED_BYTE,
          frame.waveform,
        );
        gl.uniform1i(uniforms.waveform, 1);
        if (artworkTexture) {
          gl.activeTexture(gl.TEXTURE2);
          gl.bindTexture(gl.TEXTURE_2D, artworkTexture);
          gl.uniform1i(uniforms.artwork, 2);
        }

        gl.uniform1f(uniforms.time, frame.timeSeconds);
        gl.uniform2f(uniforms.resolution, width, height);
        gl.uniform4f(
          uniforms.spectrumRect,
          ...(frame.spectrumRect ?? [0, 1, 0, 1]),
        );
        gl.uniform1f(uniforms.level, frame.level);
        gl.uniform1f(uniforms.beat, frame.beat);
        gl.uniform3f(
          uniforms.bands,
          frame.bands[0],
          frame.bands[1],
          frame.bands[2],
        );
        gl.uniform3f(
          uniforms.accent,
          frame.accent[0],
          frame.accent[1],
          frame.accent[2],
        );
        gl.uniform1f(uniforms.fade, frame.fade);
        paramLocations.forEach(({ id, location: where, fallback }) => {
          gl.uniform1f(where, frame.params[id] ?? fallback);
        });

        gl.drawArrays(gl.TRIANGLES, 0, 3);
      },
      dispose: () => {
        gl.deleteVertexArray(vao);
        gl.deleteTexture(spectrumTexture);
        gl.deleteTexture(waveformTexture);
        gl.deleteTexture(artworkTexture);
        gl.deleteTexture(slowTexture);
        gl.deleteProgram(program);
      },
      isSettled: () => settled,
      musicAccent: () => lastAccent,
    },
  };
};

/**
 * The scene's program: its 3D world when it has one and this GPU can build
 * it (`world/worldProgram.ts`), and its shader otherwise — which is the scene
 * every FluidEQ before worlds draws from the same pack, so a world that
 * cannot be built here still leaves the scene its author made for that case.
 */
export const compileScene = async (
  gl: WebGL2RenderingContext,
  pack: IScenePack,
  artwork?: ImageBitmap,
  signal?: AbortSignal,
): Promise<TSceneCompileResult> => {
  if (!pack.world) {
    return compileShaderScene(gl, pack, artwork, signal);
  }
  const world = await compileWorldScene(gl, pack, artwork, signal);
  if (world.ok) {
    return world;
  }
  const shader = await compileShaderScene(gl, pack, artwork, signal);
  return shader.ok
    ? { ...shader, notes: [`The 3D world was not drawn: ${world.log}`] }
    : shader;
};
