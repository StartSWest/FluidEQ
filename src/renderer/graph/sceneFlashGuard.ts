import { SCENE_VERTEX_SOURCE } from '../../common/sceneUniformContract';

/**
 * The brightness limiter every member's scene is drawn through.
 *
 * A picture that flashes more than three times a second can trigger a seizure
 * in somebody with photosensitive epilepsy, and a member's scene is shown to
 * other people without anybody having watched it first. So this pass measures
 * brightness on the GPU and limits how fast the picture may change where it
 * could flash. WCAG 2.3.1 counts a flash as a pair of opposing swings of at
 * least 10 %, and a general or a red flash alike.
 *
 * Two limits, each for what the other cannot see:
 *
 * - Across the frame: relative luminance, averaged over cells about a quarter
 *   of the frame across, may move at most half of full scale per second —
 *   below the 0.6 that three flashes need. A beat still reads; a strobe of
 *   the whole picture does not. Averages cannot see a pattern: a checkerboard
 *   of squares an eighth across, inverting every frame, kept every cell's
 *   average where it was and passed untouched.
 * - Where it alternates, over enough of the picture: each pixel (at half
 *   resolution) keeps a pressure that every opposing swing of 10 % or more,
 *   in luminance or saturated red, pushes up and time lets down, so six
 *   swings a second — three flashes — hold it at full. Where pressure is high
 *   AND flashing covers a share of the area around it (`FLASH_AREA_START`),
 *   the pixel may change no faster than the frame limit.
 *
 * How: the scene draws into one of two offscreen textures, the other holding
 * its last frame. A state pass compares them and updates the pressure. The
 * composite blends the last picture shown toward the new one by just enough
 * for both limits, and the result is copied to the canvas. A new size carries
 * the last picture shown, the last frame and the pressure across, scaled, so
 * a panel resizing every frame is still limited.
 *
 * Official scenes do not go through this: they are watched before release.
 * NOT UNIT-TESTED beyond its arithmetic, for the same reason as `sceneGl.ts` —
 * jsdom has no WebGL. Measured in Chrome at the Studio's 1460x603 against a
 * whole-frame strobe, 8-, 32- and 128-square inverting checkerboards, a
 * red-grey flash and a quarter-frame strobe (all held), and a moving dot, a
 * jittering edge, sparkles and a beat (all left as drawn), and on FluidEQ's
 * Alpine, Aurora, Jellyfish and Ember, drawn as without it.
 */

/** Of full relative luminance, per second. Below the 0.6 that three flashes need. */
export const FLASH_LIMIT_PER_SECOND = 0.5;

/** A stalled frame earns no extra allowance: the change it permits is capped. */
const MAX_FRAME_MS = 100;

/** How far the coarse luminance may move this frame. */
export const flashAllowance = (deltaMs: number): number =>
  (FLASH_LIMIT_PER_SECOND * Math.max(0, Math.min(MAX_FRAME_MS, deltaMs))) /
  1000;

/**
 * The share of the new frame to show over the last one, so a coarse luminance
 * change of `change` moves by at most `allowance`. Mirrors the shader below.
 */
export const flashBlend = (change: number, allowance: number): number =>
  Math.abs(change) > allowance ? allowance / Math.abs(change) : 1;

/** The mip level whose texels cover roughly a quarter of the frame. */
export const flashLod = (width: number, height: number): number =>
  Math.max(0, Math.log2(Math.max(width, height) / 4));

/** The smallest swing WCAG counts as part of a flash: a tenth of full scale. */
export const FLASH_SWING = 0.1;

/** Pressure one opposing swing adds: six a second, three flashes, hold it at one. */
export const FLASH_SWING_PRESSURE = 1 / 6;

/** One step of an 8-bit channel: without it, rounding stops a small pressure falling. */
const PRESSURE_FLOOR = 1 / 255;

/** Seconds in which pressure, and the memory of the last swing, fall to 1/e. */
const PRESSURE_SECONDS = 1;

/** What pressure is multiplied by over a frame of `deltaMs`. */
export const flashPressureDecay = (deltaMs: number): number =>
  Math.exp(
    -Math.max(0, Math.min(MAX_FRAME_MS, deltaMs)) / 1000 / PRESSURE_SECONDS,
  );

/**
 * The pressure after one frame, as the state pass computes it: decayed, less
 * the one step an 8-bit texture needs to fall at all, plus a swing that
 * opposes the last one remembered. Mirrors STATE_SOURCE.
 */
export const flashPressure = (
  pressure: number,
  swing: number,
  lastSwing: number,
  deltaMs: number,
): number => {
  const opposing =
    Math.abs(swing) >= FLASH_SWING &&
    Math.abs(lastSwing) >= FLASH_SWING &&
    swing * lastSwing < 0;
  const fallen = Math.max(
    0,
    pressure * flashPressureDecay(deltaMs) - PRESSURE_FLOOR,
  );
  return Math.min(1, fallen + (opposing ? FLASH_SWING_PRESSURE : 0));
};

/**
 * Where pressure starts limiting a pixel, and where the limit is whole. With
 * the decay and the 8-bit floor, a pixel swinging steadily settles at about
 * 0.5 for two flashes a second, 0.66 for two and a half, 0.83 for three and 1
 * for a strobe: a picture pulsing to a beat up to about 150 BPM is left alone,
 * and one at three flashes a second or more is held.
 */
export const FLASH_PRESSURE_START = 0.7;
export const FLASH_PRESSURE_FULL = 0.85;

/**
 * How much of the picture has to be flashing together before any of it is
 * held: a share of a window a quarter of the frame's longer side across.
 *
 * WCAG 2.3.1 counts flashing by area — a quarter of any 10° field of view,
 * about a quarter-screen window. Flame tips, a ridge riding the level and
 * scattered sparkles all alternate at three flashes a second and more, pixel
 * by pixel; held wherever they did, every scene in the Studio and the gallery
 * tore into frozen shards along exactly the lines that move, while the graph
 * drew the same scenes cleanly. A strobe, an inverting checkerboard or a red
 * flash across a region fills the window, and is held.
 *
 * Starting at a fifth rather than at the quarter itself, and whole only past
 * a third, because a fire's flames flicker in red over a quarter of a window
 * or so without anything flashing as a whole: on FluidEQ's Ember at 1460x603,
 * 0.12-0.25 still held a patch of flame, 0.2-0.35 left 0.6% of the picture
 * faintly softer and nothing visible, while every strobe and checkerboard
 * above was still held. The window is sampled from a mip of the flags, so the
 * share rises and falls smoothly across the frame rather than cell by cell.
 */
export const FLASH_AREA_WINDOW = 4;
export const FLASH_AREA_START = 0.2;
export const FLASH_AREA_FULL = 0.35;

/**
 * The mip level of the half-size flag texture whose texels are half a window
 * across, so four taps half a texel either side of a pixel cover one window.
 */
export const flashAreaLod = (width: number, height: number): number =>
  Math.max(0, Math.log2(Math.max(width, height) / (FLASH_AREA_WINDOW * 4)));

const COLOUR_FUNCTIONS = `
float luma(vec3 colour) {
  vec3 linear = pow(max(colour, vec3(0.0)), vec3(2.2));
  return dot(linear, vec3(0.2126, 0.7152, 0.0722));
}

// Saturated red: red light well above both green and blue.
float redness(vec3 colour) {
  vec3 linear = pow(max(colour, vec3(0.0)), vec3(2.2));
  return max(0.0, linear.r - max(linear.g, linear.b));
}
`;

const STATE_SOURCE = `#version 300 es
precision highp float;
uniform sampler2D uCurrent;
uniform sampler2D uLastFrame;
uniform sampler2D uState;
uniform float uDecay;
in vec2 vUv;
out vec4 state;
${COLOUR_FUNCTIONS}
void main() {
  vec3 now = textureLod(uCurrent, vUv, 1.0).rgb;
  vec3 before = textureLod(uLastFrame, vUv, 1.0).rgb;
  float lumaSwing = luma(now) - luma(before);
  float redSwing = redness(now) - redness(before);
  float swing = abs(redSwing) > abs(lumaSwing) ? redSwing : lumaSwing;
  vec4 old = textureLod(uState, vUv, 0.0);
  float lastSwing = old.g * 2.0 - 1.0;
  float opposing = abs(swing) >= ${FLASH_SWING.toFixed(3)}
    && abs(lastSwing) >= ${FLASH_SWING.toFixed(3)}
    && swing * lastSwing < 0.0 ? 1.0 : 0.0;
  float pressure = min(1.0,
    max(0.0, old.r * uDecay - ${PRESSURE_FLOOR.toFixed(6)})
    + opposing * ${FLASH_SWING_PRESSURE.toFixed(6)});
  float remembered = abs(swing) >= ${FLASH_SWING.toFixed(3)} ? swing : lastSwing * uDecay;
  // Blue is whether this spot is flashing, kept apart from the pressure so
  // its mips are the share of an area that is.
  float flashing = smoothstep(${FLASH_PRESSURE_START.toFixed(2)}, ${FLASH_PRESSURE_FULL.toFixed(2)}, pressure);
  state = vec4(pressure, remembered * 0.5 + 0.5, flashing, 1.0);
}
`;

const COMPOSITE_SOURCE = `#version 300 es
precision highp float;
uniform sampler2D uCurrent;
uniform sampler2D uPrevious;
uniform sampler2D uState;
uniform float uLod;
uniform float uAreaLod;
uniform float uAllowance;
uniform float uFirst;
in vec2 vUv;
out vec4 fragColor;
${COLOUR_FUNCTIONS}
float changeOf(vec3 now, vec3 before) {
  return max(abs(luma(now) - luma(before)), abs(redness(now) - redness(before)));
}

void main() {
  vec4 current = texture(uCurrent, vUv);
  if (uFirst > 0.5) {
    fragColor = current;
    return;
  }
  vec4 previous = texture(uPrevious, vUv);
  // Luminance only across the frame. Red is caught where it alternates,
  // below; a quarter-frame average of redness also moved with every surge of
  // a fire scene's flames, and smeared them when nothing flashed.
  float coarse = abs(luma(textureLod(uCurrent, vUv, uLod).rgb)
                   - luma(textureLod(uPrevious, vUv, uLod).rgb));
  float frameBlend = coarse > uAllowance ? uAllowance / coarse : 1.0;
  float pixel = changeOf(current.rgb, previous.rgb);
  float pixelBlend = pixel > uAllowance ? uAllowance / pixel : 1.0;
  vec2 reach = 0.5 * pow(2.0, uAreaLod) / vec2(textureSize(uState, 0));
  float area = 0.25 * (
      textureLod(uState, vUv + vec2(-reach.x, -reach.y), uAreaLod).b
    + textureLod(uState, vUv + vec2( reach.x, -reach.y), uAreaLod).b
    + textureLod(uState, vUv + vec2(-reach.x,  reach.y), uAreaLod).b
    + textureLod(uState, vUv + vec2( reach.x,  reach.y), uAreaLod).b);
  float flashing = textureLod(uState, vUv, 0.0).b
    * smoothstep(${FLASH_AREA_START.toFixed(2)}, ${FLASH_AREA_FULL.toFixed(2)}, area);
  float blend = min(frameBlend, mix(1.0, pixelBlend, flashing));
  fragColor = mix(previous, current, blend);
}
`;

export interface IFlashGuard {
  /** Point drawing at the offscreen frame. Call before the scene draws. */
  begin(width: number, height: number): void;
  /** Limit what was drawn and put it on the canvas. */
  end(deltaMs: number): void;
  dispose(): void;
}

interface ITarget {
  texture: WebGLTexture;
  framebuffer: WebGLFramebuffer;
  width: number;
  height: number;
}

const compile = (gl: WebGL2RenderingContext, kind: number, source: string) => {
  const shader = gl.createShader(kind);
  if (!shader) {
    return null;
  }
  gl.shaderSource(shader, source);
  gl.compileShader(shader);
  if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
    gl.deleteShader(shader);
    return null;
  }
  return shader;
};

const link = (gl: WebGL2RenderingContext, fragmentSource: string) => {
  const vertex = compile(gl, gl.VERTEX_SHADER, SCENE_VERTEX_SOURCE);
  const fragment = compile(gl, gl.FRAGMENT_SHADER, fragmentSource);
  const program = gl.createProgram();
  if (!vertex || !fragment || !program) {
    return null;
  }
  gl.attachShader(program, vertex);
  gl.attachShader(program, fragment);
  gl.linkProgram(program);
  gl.deleteShader(vertex);
  gl.deleteShader(fragment);
  if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
    gl.deleteProgram(program);
    return null;
  }
  return program;
};

/** `null` when the GPU cannot give it what it needs — the scene then must not run. */
export const createFlashGuard = (
  gl: WebGL2RenderingContext,
): IFlashGuard | null => {
  const composite = link(gl, COMPOSITE_SOURCE);
  const stateProgram = link(gl, STATE_SOURCE);
  const vao = gl.createVertexArray();
  if (!composite || !stateProgram || !vao) {
    return null;
  }
  const where = {
    current: gl.getUniformLocation(composite, 'uCurrent'),
    previous: gl.getUniformLocation(composite, 'uPrevious'),
    state: gl.getUniformLocation(composite, 'uState'),
    lod: gl.getUniformLocation(composite, 'uLod'),
    areaLod: gl.getUniformLocation(composite, 'uAreaLod'),
    allowance: gl.getUniformLocation(composite, 'uAllowance'),
    first: gl.getUniformLocation(composite, 'uFirst'),
  };
  const stateWhere = {
    current: gl.getUniformLocation(stateProgram, 'uCurrent'),
    lastFrame: gl.getUniformLocation(stateProgram, 'uLastFrame'),
    state: gl.getUniformLocation(stateProgram, 'uState'),
    decay: gl.getUniformLocation(stateProgram, 'uDecay'),
  };

  let width = 0;
  let height = 0;
  /** The scene's two frames: the one drawn this time, and the one before. */
  let frames: [ITarget, ITarget] | undefined;
  let drawn = 0;
  let hasFrame = false;
  let shown: [ITarget, ITarget] | undefined;
  let latest = 0;
  let hasShown = false;
  let pressure: [ITarget, ITarget] | undefined;
  let pressureLatest = 0;

  const release = (target: ITarget | undefined) => {
    if (target) {
      gl.deleteFramebuffer(target.framebuffer);
      gl.deleteTexture(target.texture);
    }
  };
  const releasePair = (pair: [ITarget, ITarget] | undefined) => {
    release(pair?.[0]);
    release(pair?.[1]);
  };

  const makeTarget = (
    targetWidth: number,
    targetHeight: number,
    mipmapped: boolean,
  ): ITarget | undefined => {
    const texture = gl.createTexture();
    const framebuffer = gl.createFramebuffer();
    if (!texture || !framebuffer) {
      return undefined;
    }
    gl.bindTexture(gl.TEXTURE_2D, texture);
    gl.texImage2D(
      gl.TEXTURE_2D,
      0,
      gl.RGBA8,
      targetWidth,
      targetHeight,
      0,
      gl.RGBA,
      gl.UNSIGNED_BYTE,
      null,
    );
    // Mipmapped: the coarse luminance and the flashing share are read from
    // high levels. A texture that asks for levels it has never been given
    // samples as black, so every one is given them below and after each write.
    gl.texParameteri(
      gl.TEXTURE_2D,
      gl.TEXTURE_MIN_FILTER,
      mipmapped ? gl.LINEAR_MIPMAP_LINEAR : gl.LINEAR,
    );
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    gl.bindFramebuffer(gl.FRAMEBUFFER, framebuffer);
    gl.framebufferTexture2D(
      gl.FRAMEBUFFER,
      gl.COLOR_ATTACHMENT0,
      gl.TEXTURE_2D,
      texture,
      0,
    );
    gl.clearColor(0, 0, 0, 0);
    gl.clear(gl.COLOR_BUFFER_BIT);
    if (mipmapped) {
      gl.generateMipmap(gl.TEXTURE_2D);
    }
    return { texture, framebuffer, width: targetWidth, height: targetHeight };
  };

  const makePair = (
    targetWidth: number,
    targetHeight: number,
    mipmapped: boolean,
  ): [ITarget, ITarget] | undefined => {
    const a = makeTarget(targetWidth, targetHeight, mipmapped);
    const b = makeTarget(targetWidth, targetHeight, mipmapped);
    if (a && b) {
      return [a, b];
    }
    release(a);
    release(b);
    return undefined;
  };

  /** One target's picture into another, scaled; the caller lifts the scissor. */
  const carry = (from: ITarget, to: ITarget, mipmapped: boolean) => {
    gl.bindFramebuffer(gl.READ_FRAMEBUFFER, from.framebuffer);
    gl.bindFramebuffer(gl.DRAW_FRAMEBUFFER, to.framebuffer);
    gl.blitFramebuffer(
      0,
      0,
      from.width,
      from.height,
      0,
      0,
      to.width,
      to.height,
      gl.COLOR_BUFFER_BIT,
      gl.LINEAR,
    );
    if (mipmapped) {
      gl.bindTexture(gl.TEXTURE_2D, to.texture);
      gl.generateMipmap(gl.TEXTURE_2D);
    }
  };

  const resize = (nextWidth: number, nextHeight: number) => {
    const old = { frames, drawn, shown, latest, pressure, pressureLatest };
    width = nextWidth;
    height = nextHeight;
    // Clearing a new target and every carry below must reach every pixel.
    const scissored = gl.isEnabled(gl.SCISSOR_TEST);
    gl.disable(gl.SCISSOR_TEST);
    frames = makePair(width, height, true);
    shown = makePair(width, height, true);
    pressure = makePair(
      Math.max(1, Math.ceil(width / 2)),
      Math.max(1, Math.ceil(height / 2)),
      true,
    );
    // The last picture shown, the last frame and the pressure, scaled into
    // the new size, are what the next frame is limited against; only a guard
    // that never showed a picture starts unlimited.
    if (hasShown && old.shown && shown) {
      carry(old.shown[old.latest], shown[latest], true);
    } else {
      hasShown = false;
    }
    if (hasFrame && old.frames && frames) {
      carry(old.frames[old.drawn], frames[drawn], true);
    } else {
      hasFrame = false;
    }
    if (old.pressure && pressure) {
      carry(old.pressure[old.pressureLatest], pressure[pressureLatest], true);
    }
    if (scissored) {
      gl.enable(gl.SCISSOR_TEST);
    }
    releasePair(old.frames);
    releasePair(old.shown);
    releasePair(old.pressure);
    gl.bindFramebuffer(gl.FRAMEBUFFER, null);
  };

  const updatePressure = (current: ITarget, last: ITarget, deltaMs: number) => {
    if (!pressure) {
      return;
    }
    const before = pressure[pressureLatest];
    const after = pressure[1 - pressureLatest];
    const scissored = gl.isEnabled(gl.SCISSOR_TEST);
    gl.disable(gl.SCISSOR_TEST);
    gl.activeTexture(gl.TEXTURE0);
    gl.bindTexture(gl.TEXTURE_2D, current.texture);
    gl.activeTexture(gl.TEXTURE1);
    gl.bindTexture(gl.TEXTURE_2D, last.texture);
    gl.activeTexture(gl.TEXTURE2);
    gl.bindTexture(gl.TEXTURE_2D, before.texture);
    gl.bindFramebuffer(gl.FRAMEBUFFER, after.framebuffer);
    gl.viewport(0, 0, after.width, after.height);
    gl.useProgram(stateProgram);
    gl.bindVertexArray(vao);
    gl.uniform1i(stateWhere.current, 0);
    gl.uniform1i(stateWhere.lastFrame, 1);
    gl.uniform1i(stateWhere.state, 2);
    gl.uniform1f(stateWhere.decay, flashPressureDecay(deltaMs));
    gl.drawArrays(gl.TRIANGLES, 0, 3);
    // Its levels are the share of each area that is flashing.
    gl.bindTexture(gl.TEXTURE_2D, after.texture);
    gl.generateMipmap(gl.TEXTURE_2D);
    if (scissored) {
      gl.enable(gl.SCISSOR_TEST);
    }
    pressureLatest = 1 - pressureLatest;
  };

  return {
    begin: (nextWidth, nextHeight) => {
      if (nextWidth !== width || nextHeight !== height || !frames) {
        resize(nextWidth, nextHeight);
      }
      gl.bindFramebuffer(
        gl.FRAMEBUFFER,
        frames?.[1 - drawn].framebuffer ?? null,
      );
    },
    end: (deltaMs) => {
      if (!frames || !shown || !pressure) {
        gl.bindFramebuffer(gl.FRAMEBUFFER, null);
        return;
      }
      const current = frames[1 - drawn];
      const last = frames[drawn];
      const previous = shown[latest];
      const next = shown[1 - latest];

      gl.activeTexture(gl.TEXTURE0);
      gl.bindTexture(gl.TEXTURE_2D, current.texture);
      gl.generateMipmap(gl.TEXTURE_2D);
      if (hasFrame) {
        updatePressure(current, last, deltaMs);
      }

      gl.activeTexture(gl.TEXTURE0);
      gl.bindTexture(gl.TEXTURE_2D, current.texture);
      gl.activeTexture(gl.TEXTURE1);
      gl.bindTexture(gl.TEXTURE_2D, previous.texture);
      if (hasShown) {
        gl.generateMipmap(gl.TEXTURE_2D);
      }
      gl.activeTexture(gl.TEXTURE2);
      gl.bindTexture(gl.TEXTURE_2D, pressure[pressureLatest].texture);

      gl.bindFramebuffer(gl.FRAMEBUFFER, next.framebuffer);
      gl.viewport(0, 0, width, height);
      gl.useProgram(composite);
      gl.bindVertexArray(vao);
      gl.uniform1i(where.current, 0);
      gl.uniform1i(where.previous, 1);
      gl.uniform1i(where.state, 2);
      gl.uniform1f(where.lod, flashLod(width, height));
      gl.uniform1f(where.areaLod, flashAreaLod(width, height));
      gl.uniform1f(where.allowance, flashAllowance(deltaMs));
      gl.uniform1f(where.first, hasShown ? 0 : 1);
      gl.drawArrays(gl.TRIANGLES, 0, 3);

      // Onto the canvas. The blit honours the same scissor as the scene did,
      // so only the part of the panel on screen is touched.
      gl.bindFramebuffer(gl.READ_FRAMEBUFFER, next.framebuffer);
      gl.bindFramebuffer(gl.DRAW_FRAMEBUFFER, null);
      gl.blitFramebuffer(
        0,
        0,
        width,
        height,
        0,
        0,
        width,
        height,
        gl.COLOR_BUFFER_BIT,
        gl.NEAREST,
      );
      gl.bindFramebuffer(gl.FRAMEBUFFER, null);
      gl.activeTexture(gl.TEXTURE0);
      latest = 1 - latest;
      hasShown = true;
      drawn = 1 - drawn;
      hasFrame = true;
    },
    dispose: () => {
      releasePair(frames);
      releasePair(shown);
      releasePair(pressure);
      frames = undefined;
      shown = undefined;
      pressure = undefined;
      gl.deleteVertexArray(vao);
      gl.deleteProgram(composite);
      gl.deleteProgram(stateProgram);
    },
  };
};
