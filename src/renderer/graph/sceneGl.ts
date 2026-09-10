import type { IScenePack } from 'common/scenePacks';
import { getEaseFactor } from 'common/smoothing';
import {
  assembleFragmentSource,
  SCENE_VERTEX_SOURCE,
  SPECTRUM_TEXELS,
  uniformNameForParam,
  WAVEFORM_TEXELS,
} from 'common/sceneUniformContract';
import { SCENE_CONTEXT_ATTRIBUTES } from './sceneHealth';

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
  { ok: true; program: ISceneProgram } | { ok: false; log: string };

export const createSceneContext = (
  canvas: HTMLCanvasElement,
): WebGL2RenderingContext | null => {
  try {
    return canvas.getContext('webgl2', SCENE_CONTEXT_ATTRIBUTES);
  } catch {
    return null;
  }
};

const compileShader = (
  gl: WebGL2RenderingContext,
  kind: number,
  source: string,
): WebGLShader | string => {
  const shader = gl.createShader(kind);
  if (!shader) {
    return 'could not create shader';
  }
  gl.shaderSource(shader, source);
  gl.compileShader(shader);
  if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
    const log = gl.getShaderInfoLog(shader) ?? 'unknown compile error';
    gl.deleteShader(shader);
    return log;
  }
  return shader;
};

/**
 * Driver error lines are in the assembled program; the author wrote only the
 * middle of it. Shift every `ERROR: 0:<line>` so it points into their source.
 */
const relocateErrorLines = (log: string, offset: number): string =>
  log.replace(
    /ERROR:\s*(\d+):(\d+)/g,
    (_match, column: string, line: string) =>
      `ERROR: ${column}:${Math.max(1, Number(line) - offset)}`,
  );

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

export const compileScene = (
  gl: WebGL2RenderingContext,
  pack: IScenePack,
  artwork?: ImageBitmap,
): TSceneCompileResult => {
  if (pack.artwork && !artwork) {
    return { ok: false, log: 'scene artwork was not decoded' };
  }
  const { source, sourceLineOffset } = assembleFragmentSource(pack);

  const vertex = compileShader(gl, gl.VERTEX_SHADER, SCENE_VERTEX_SOURCE);
  if (typeof vertex === 'string') {
    return { ok: false, log: `vertex: ${vertex}` };
  }
  const fragment = compileShader(gl, gl.FRAGMENT_SHADER, source);
  if (typeof fragment === 'string') {
    gl.deleteShader(vertex);
    return { ok: false, log: relocateErrorLines(fragment, sourceLineOffset) };
  }

  const program = gl.createProgram();
  if (!program) {
    gl.deleteShader(vertex);
    gl.deleteShader(fragment);
    return { ok: false, log: 'could not create program' };
  }
  gl.attachShader(program, vertex);
  gl.attachShader(program, fragment);
  gl.linkProgram(program);
  // Shaders can be released once linked; the program keeps what it needs.
  gl.deleteShader(vertex);
  gl.deleteShader(fragment);
  if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
    const log = gl.getProgramInfoLog(program) ?? 'unknown link error';
    gl.deleteProgram(program);
    return { ok: false, log };
  }

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
  let accentEnvelope = 0;
  let accentSerial = 0;
  let accentWaitMs = 1500;
  let previousBeat = 0;

  return {
    ok: true,
    program: {
      draw: (frame, width, height) => {
        gl.viewport(0, 0, width, height);
        gl.useProgram(program);
        gl.bindVertexArray(vao);

        if (uniforms.musicAccent) {
          const elapsed = Math.max(0, Math.min(100, frame.deltaMs ?? 0));
          accentWaitMs = Math.max(0, accentWaitMs - elapsed);
          accentEnvelope = Math.max(0, accentEnvelope - elapsed / 320);
          // Count beat onsets, never every frame of a held beat. The gap
          // only admits an event; its expiry cannot cause a clock-only flash.
          if (
            frame.beat > 0.85 &&
            previousBeat < 0.65 &&
            accentWaitMs === 0 &&
            (frame.bands[0] > 0.08 || frame.bands[1] > 0.12)
          ) {
            accentSerial = (accentSerial + 1) % 4096;
            accentEnvelope = 1;
            accentWaitMs = 4800 + ((accentSerial * 0.61803398875) % 1) * 2400;
          }
          previousBeat = frame.beat;
          gl.uniform2f(uniforms.musicAccent, accentEnvelope, accentSerial);
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
      isSettled: () => settled && accentEnvelope === 0,
      musicAccent: () => accentEnvelope,
    },
  };
};
