import { SCENE_VERTEX_SOURCE } from '../../common/sceneUniformContract';
import {
  FLASH_AREA_FULL,
  FLASH_AREA_START,
  FLASH_CALM_TEXELS,
  FLASH_CALM_WEIGHT_SOURCE,
  FLASH_PERIOD_S,
  FLASH_PRESSURE_MEMORY_SOURCE,
  FLASH_STATE_REST,
  FLASH_SWING,
  GAP_MARGIN_S,
  MAX_FRAME_MS,
  MAX_GAP_S,
  flashAllowance,
  flashAreaLod,
  flashCalmLod,
  flashTravelDecay,
  flashingDecay,
} from './sceneFlashGuard';

// The guard on the graphics card: the shaders that keep its state, its
// calm picture and the composite, and the guard built from them, reading the
// limits sceneFlashGuard.ts sets and models on the CPU.

const COLOUR_FUNCTIONS = `
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
`;

/**
 * How far a pixel has travelled one way, and which way, in one number.
 *
 * This used to be the direction alone, set only when ONE FRAME moved by a
 * tenth of full scale and faded otherwise — and that is what a flash was
 * recognised by. So a brightness spread over eleven frames or more moved by
 * under a tenth each time, set nothing, and left the memory to fade to
 * nothing; the instant drop at the end of the ramp then had nothing to
 * oppose, and a full-screen black-to-white strobe at three to five and a half
 * flashes a second — the exact band that provokes seizures — was drawn
 * exactly as its author wrote it. Ten characters of shader.
 *
 * Travel accumulates instead, decaying as it always did, so a slow rise is
 * remembered as the rise it is. A movement the other way starts the count
 * again from itself, which is what makes a turn after a rise a turn at all:
 * `flashStep` counts the rises that come after a fall of a tenth.
 */
const TRAVEL_FUNCTION = `
float flashTravel(float last, float swing, float decay) {
  float carried = last * swing < 0.0 ? swing : last * decay + swing;
  return abs(swing) >= ${FLASH_SWING.toFixed(3)}
    ? sign(swing)
    : clamp(carried, -1.0, 1.0);
}
`;

const STATE_SOURCE = `#version 300 es
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
${COLOUR_FUNCTIONS}${TRAVEL_FUNCTION}
void main() {
  vec3 now = textureLod(uCurrent, vUv, 1.0).rgb;
  vec3 before = textureLod(uLastFrame, vUv, 1.0).rgb;
  float lumaSwing = luma(now) - luma(before);
  float redSwing = redness(now) - redness(before);
  float swing = abs(redSwing) > abs(lumaSwing) ? redSwing : lumaSwing;
  vec4 old = textureLod(uState, vUv, 0.0);
  float lastSwing = old.g * 2.0 - 1.0;
  // Travel — see FLASH_PRESSURE_MEMORY_SOURCE, whose text this is.
  float remembered = ${FLASH_PRESSURE_MEMORY_SOURCE};
  // A TURN of that travel, not a swing: a flash is a pair of changes, and
  // counting changes counts a square wave twice a cycle against a ramp's
  // once. See flashStep, which is this.
  // A RISE, not either end of the pair: one of these a flash, evenly spaced
  // for a strobe and for a ramp that snaps back alike. See FLASH_PERIOD_S.
  float opposing = remembered > 0.0
    && lastSwing <= ${(-FLASH_SWING).toFixed(3)} ? 1.0 : 0.0;
  // Red counts the seconds SINCE the last turn, and the gap this turn closes
  // is everything since it, this frame included. Counting up rather than
  // decaying down is what lets eight bits hold it at any frame rate: a second
  // over 255 steps is 3.9 ms, and the number this has to resolve is a sixth
  // of a second. See flashStep for why the level it replaced could not.
  float gap = min(${MAX_GAP_S.toFixed(1)}, old.r + uElapsed);
  float tooSoon = opposing
    * (gap < ${(FLASH_PERIOD_S - GAP_MARGIN_S).toFixed(6)} ? 1.0 : 0.0);
  float sinceTurn = opposing > 0.5 ? 0.0 : gap;
  // Blue is whether this spot is flashing, kept apart from the gap so its
  // mips are the share of an area that is. Set outright by a turn that came
  // too soon and only smoothed on the way down, which is what a level built
  // up over turns could never be.
  // Holds while the pixel is still inside a period of its last rise, and
  // falls only once a whole one has gone by without one. Decaying between
  // rises let 3.75, 4 and 5 a second through in the dip — see flashStep.
  float held = gap < ${FLASH_PERIOD_S.toFixed(6)}
    ? old.b
    : old.b * uFlashDecay;
  float flashing = max(held, tooSoon);
  // Alpha is unused.
  state = vec4(sinceTurn, remembered * 0.5 + 0.5, flashing, 0.0);
}
`;

/**
 * The flag's mip level the calming reads: two levels of the half-size state,
 * so it follows a flashing area eight pixels at a time rather than one. Read
 * pixel by pixel, the flags along a tunnel's tiles and not between them
 * striped the calmed area with the picture's own dark gaps.
 */
const FLAG_LOD = 2;

/**
 * The calm field: every region's colour, followed no faster than the limit.
 *
 * Each texel reads the frame blurred to its own size, in light, and moves its
 * own colour toward that by at most the allowance, in luminance or in red,
 * whichever moved more. It is kept for every region all the time, not only
 * where something flashes, so a region that starts flashing is calmed from
 * the colour it had and not from a jump. A calmed pixel shows this field and
 * nothing else, so what it shows moves no faster than the limit whatever its
 * neighbours do — which is the whole of the protection, and why it holds at
 * any size of field.
 */
const CALM_SOURCE = `#version 300 es
precision highp float;
uniform sampler2D uCurrent;
uniform sampler2D uCalm;
uniform float uLod;
uniform float uAllowance;
uniform float uFirst;
in vec2 vUv;
out vec4 calmOut;
${COLOUR_FUNCTIONS}
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
`;

const COMPOSITE_SOURCE = `#version 300 es
precision highp float;
uniform sampler2D uCurrent;
uniform sampler2D uCalm;
uniform sampler2D uState;
uniform float uAreaLod;
in vec2 vUv;
out vec4 fragColor;
${COLOUR_FUNCTIONS}
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
  float flashing = textureLod(uState, vUv, ${FLAG_LOD.toFixed(1)}).b
    * smoothstep(${FLASH_AREA_START.toFixed(2)}, ${FLASH_AREA_FULL.toFixed(2)}, area);
  // Nothing flashing here: exactly what the scene drew.
  if (flashing <= 0.0) {
    fragColor = current;
    return;
  }
  float calmed = ${FLASH_CALM_WEIGHT_SOURCE};
  vec3 light = mix(lightOf(current.rgb), texture(uCalm, vUv).rgb, calmed);
  fragColor = vec4(pow(light, vec3(1.0 / 2.2)), current.a);
}
`;

export interface IFlashGuard {
  /** Point drawing at the offscreen frame. Call before the scene draws. */
  begin(width: number, height: number): void;
  /**
   * Limit what was drawn and put it on `destination` — the canvas when null,
   * or the upscaler's input when the scene is drawn smaller than its panel
   * (`sceneUpscale.ts`), so the limiter judges the picture at the size it
   * was drawn and the upscale reads what was shown.
   *
   * FALSE when it could not limit the frame, which is a GPU that would not
   * give it somewhere to draw. Every caller treats that the way it treats a
   * guard that could not be built at all — a member's scene is not shown. It
   * used to bind the destination and return, quietly, which put the scene on
   * the screen with no limiter at all and nothing said: the one place in this
   * file that failed OPEN, and the only one that mattered.
   */
  end(deltaMs: number, destination: WebGLFramebuffer | null): boolean;
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

/**
 * `null` when the GPU cannot give it what it needs — the scene then must not
 * run. Which scenes are drawn through it is decided in `sceneRules.ts`, from
 * who made them, and nowhere else.
 */
export const createFlashGuard = (
  gl: WebGL2RenderingContext,
): IFlashGuard | null => {
  // The state has to be drawn into at half-float precision, and there is no
  // second-best. The red channel counts the seconds since a pixel last rose,
  // a frame at a time, and eight bits cannot carry that: a frame at sixty is
  // 4.25 steps of 255 and is stored as 4, so a gap of a third of a second
  // comes out six per cent short — enough to read three flashes a second, the
  // rate WCAG allows, as faster than three. Worse, the size of that error is
  // the frame rate: at 144 a frame is 1.77 steps and rounds UP by thirteen
  // per cent. That is the same frame-rate dependence this design exists to
  // remove, in a new place. Measured on the driver both ways.
  //
  // Refusing here is refusing to draw a member's scene at all, which is what
  // every other failure in this file does and is the only safe direction: a
  // scene nobody has watched is not shown without a working limiter.
  if (!gl.getExtension('EXT_color_buffer_float')) {
    return null;
  }
  const composite = link(gl, COMPOSITE_SOURCE);
  const stateProgram = link(gl, STATE_SOURCE);
  const calmProgram = link(gl, CALM_SOURCE);
  const vao = gl.createVertexArray();
  if (!composite || !stateProgram || !calmProgram || !vao) {
    return null;
  }
  const where = {
    current: gl.getUniformLocation(composite, 'uCurrent'),
    calm: gl.getUniformLocation(composite, 'uCalm'),
    state: gl.getUniformLocation(composite, 'uState'),
    areaLod: gl.getUniformLocation(composite, 'uAreaLod'),
  };
  const stateWhere = {
    current: gl.getUniformLocation(stateProgram, 'uCurrent'),
    lastFrame: gl.getUniformLocation(stateProgram, 'uLastFrame'),
    state: gl.getUniformLocation(stateProgram, 'uState'),
    decay: gl.getUniformLocation(stateProgram, 'uDecay'),
    elapsed: gl.getUniformLocation(stateProgram, 'uElapsed'),
    flashDecay: gl.getUniformLocation(stateProgram, 'uFlashDecay'),
  };
  const calmWhere = {
    current: gl.getUniformLocation(calmProgram, 'uCurrent'),
    calm: gl.getUniformLocation(calmProgram, 'uCalm'),
    lod: gl.getUniformLocation(calmProgram, 'uLod'),
    allowance: gl.getUniformLocation(calmProgram, 'uAllowance'),
    first: gl.getUniformLocation(calmProgram, 'uFirst'),
  };

  let width = 0;
  let height = 0;
  /** The scene's two frames: the one drawn this time, and the one before. */
  let frames: [ITarget, ITarget] | undefined;
  let drawn = 0;
  let hasFrame = false;
  let pressure: [ITarget, ITarget] | undefined;
  let pressureLatest = 0;
  /** The calm field (CALM_SOURCE), and whether it has been filled yet. */
  let calm: [ITarget, ITarget] | undefined;
  let calmLatest = 0;
  let hasCalm = false;

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
    /** Half floats, for the state and the calm field, which eight bits
     * cannot carry: a gap counted a frame at a time, and light moved by
     * a few thousandths a frame. */
    precise: boolean,
    /** What an untouched texel reads as. The state's travel means "no
     * swing" at a half, not at zero, which would read as a full swing down. */
    clear: readonly [number, number, number, number] = [0, 0, 0, 0],
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
      precise ? gl.RGBA16F : gl.RGBA8,
      targetWidth,
      targetHeight,
      0,
      gl.RGBA,
      precise ? gl.HALF_FLOAT : gl.UNSIGNED_BYTE,
      null,
    );
    // Mipmapped: the region colour and the flashing share are read from high
    // levels. A texture that asks for levels it has never been given samples
    // as black, so every one is given them below and after each write.
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
    gl.clearColor(clear[0], clear[1], clear[2], clear[3]);
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
    precise: boolean,
    clear?: readonly [number, number, number, number],
  ): [ITarget, ITarget] | undefined => {
    const a = makeTarget(targetWidth, targetHeight, mipmapped, precise, clear);
    const b = makeTarget(targetWidth, targetHeight, mipmapped, precise, clear);
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
    const old = { frames, drawn, pressure, pressureLatest };
    width = nextWidth;
    height = nextHeight;
    // Clearing a new target and every carry below must reach every pixel.
    const scissored = gl.isEnabled(gl.SCISSOR_TEST);
    gl.disable(gl.SCISSOR_TEST);
    frames = makePair(width, height, true, false);
    pressure = makePair(
      Math.max(1, Math.ceil(width / 2)),
      Math.max(1, Math.ceil(height / 2)),
      true,
      true,
      // Red starts at the CAP, not at zero: it counts the seconds since the
      // last turn, and a fresh pixel has never turned. Cleared to zero it
      // would read as having turned this instant, and the first turn it ever
      // saw would come "too soon" after one that never happened — one cut on
      // a beat, on a scene just started, held as a flash. The travel means
      // "no swing" at a half; the flashing flag starts off; alpha is unused.
      [FLASH_STATE_REST.sinceTurn, 0.5, FLASH_STATE_REST.flashing, 0],
    );
    // The calm field is the same few texels at any size, laid over the frame,
    // so it goes on as it was; the last frame and the state are scaled into
    // the new size, so a panel resizing every frame is still limited.
    calm ??= makePair(FLASH_CALM_TEXELS, FLASH_CALM_TEXELS, false, true);
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
    releasePair(old.pressure);
    gl.bindFramebuffer(gl.FRAMEBUFFER, null);
  };

  const updatePressure = (current: ITarget, last: ITarget, deltaMs: number) => {
    if (!pressure) {
      return;
    }
    const before = pressure[pressureLatest];
    const after = pressure[1 - pressureLatest];
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
    gl.uniform1f(stateWhere.decay, flashTravelDecay(deltaMs));
    gl.uniform1f(
      stateWhere.elapsed,
      Math.max(0, Math.min(MAX_FRAME_MS, deltaMs)) / 1000,
    );
    gl.uniform1f(stateWhere.flashDecay, flashingDecay(deltaMs));
    gl.drawArrays(gl.TRIANGLES, 0, 3);
    // Its levels are the share of each area that is flashing.
    gl.bindTexture(gl.TEXTURE_2D, after.texture);
    gl.generateMipmap(gl.TEXTURE_2D);
    pressureLatest = 1 - pressureLatest;
  };

  const updateCalm = (current: ITarget, deltaMs: number) => {
    if (!calm) {
      return;
    }
    const before = calm[calmLatest];
    const after = calm[1 - calmLatest];
    gl.activeTexture(gl.TEXTURE0);
    gl.bindTexture(gl.TEXTURE_2D, current.texture);
    gl.activeTexture(gl.TEXTURE1);
    gl.bindTexture(gl.TEXTURE_2D, before.texture);
    gl.bindFramebuffer(gl.FRAMEBUFFER, after.framebuffer);
    gl.viewport(0, 0, after.width, after.height);
    gl.useProgram(calmProgram);
    gl.bindVertexArray(vao);
    gl.uniform1i(calmWhere.current, 0);
    gl.uniform1i(calmWhere.calm, 1);
    // The frame blurred to the field's own patch size.
    gl.uniform1f(calmWhere.lod, flashCalmLod(width, height));
    gl.uniform1f(calmWhere.allowance, flashAllowance(deltaMs));
    gl.uniform1f(calmWhere.first, hasCalm ? 0 : 1);
    gl.drawArrays(gl.TRIANGLES, 0, 3);
    calmLatest = 1 - calmLatest;
    hasCalm = true;
  };

  return {
    begin: (nextWidth, nextHeight) => {
      if (nextWidth !== width || nextHeight !== height || !frames) {
        resize(nextWidth, nextHeight);
      }
      // Never the canvas as a fallback. Binding `null` where a target is
      // missing pointed the scene straight at what the listener sees, and
      // `end` then had nothing to limit: the scene was drawn raw. Where there
      // is no target the scene draws into no framebuffer at all, and `end`
      // says below that it could not do its job.
      const into = frames?.[1 - drawn].framebuffer;
      if (into) {
        gl.bindFramebuffer(gl.FRAMEBUFFER, into);
      }
    },
    end: (deltaMs, destination) => {
      if (!frames || !pressure || !calm) {
        return false;
      }
      const current = frames[1 - drawn];
      const last = frames[drawn];

      // The state and the calm field reach every texel, whatever part of the
      // panel is on screen.
      const scissored = gl.isEnabled(gl.SCISSOR_TEST);
      gl.disable(gl.SCISSOR_TEST);
      gl.activeTexture(gl.TEXTURE0);
      gl.bindTexture(gl.TEXTURE_2D, current.texture);
      gl.generateMipmap(gl.TEXTURE_2D);
      if (hasFrame) {
        updatePressure(current, last, deltaMs);
      }
      updateCalm(current, deltaMs);
      if (scissored) {
        gl.enable(gl.SCISSOR_TEST);
      }

      // Straight onto the destination, under the same scissor the scene was
      // drawn with, so only the part of the panel on screen is touched.
      gl.activeTexture(gl.TEXTURE0);
      gl.bindTexture(gl.TEXTURE_2D, current.texture);
      gl.activeTexture(gl.TEXTURE1);
      gl.bindTexture(gl.TEXTURE_2D, calm[calmLatest].texture);
      gl.activeTexture(gl.TEXTURE2);
      gl.bindTexture(gl.TEXTURE_2D, pressure[pressureLatest].texture);
      gl.bindFramebuffer(gl.FRAMEBUFFER, destination);
      gl.viewport(0, 0, width, height);
      gl.useProgram(composite);
      gl.bindVertexArray(vao);
      gl.uniform1i(where.current, 0);
      gl.uniform1i(where.calm, 1);
      gl.uniform1i(where.state, 2);
      gl.uniform1f(where.areaLod, flashAreaLod(width, height));
      gl.drawArrays(gl.TRIANGLES, 0, 3);
      gl.bindFramebuffer(gl.FRAMEBUFFER, null);
      gl.activeTexture(gl.TEXTURE0);
      drawn = 1 - drawn;
      hasFrame = true;
      return true;
    },
    dispose: () => {
      releasePair(frames);
      releasePair(pressure);
      releasePair(calm);
      frames = undefined;
      pressure = undefined;
      calm = undefined;
      gl.deleteVertexArray(vao);
      gl.deleteProgram(composite);
      gl.deleteProgram(stateProgram);
      gl.deleteProgram(calmProgram);
    },
  };
};
