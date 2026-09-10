import { SCENE_VERTEX_SOURCE } from '../../common/sceneUniformContract';

/**
 * The brightness limiter every member's scene is drawn through.
 *
 * A picture that flashes more than three times a second can trigger a seizure
 * in somebody with photosensitive epilepsy, and a member's scene is shown to
 * other people without anybody having watched it first. So this pass measures
 * brightness on the GPU — relative luminance, averaged over coarse cells of
 * the frame — and limits how fast each part of the picture may change: at most
 * half of full scale per second. WCAG 2.3.1 counts a flash as a pair of
 * opposing swings of at least 10 %; three pairs a second need six swings, 0.6
 * of full scale per second, which the limit stays below. A beat still reads;
 * a strobe does not.
 *
 * How: the scene draws into an offscreen texture instead of the canvas. The
 * composite blends the last picture shown toward the new one, per pixel, by
 * just enough that the coarse luminance there moves no faster than the limit —
 * sampled from a mip level about a quarter of the frame across, so the
 * correction is smooth between cells and no grid can show. The result becomes
 * the "last picture shown" for the next frame, and is copied to the canvas.
 *
 * Official scenes do not go through this: they are watched before release.
 * NOT UNIT-TESTED beyond its arithmetic, for the same reason as `sceneGl.ts` —
 * jsdom has no WebGL — and verified by looking at a scene that strobes.
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

const COMPOSITE_SOURCE = `#version 300 es
precision highp float;
uniform sampler2D uCurrent;
uniform sampler2D uPrevious;
uniform float uLod;
uniform float uAllowance;
uniform float uFirst;
in vec2 vUv;
out vec4 fragColor;

float luma(vec3 colour) {
  vec3 linear = pow(max(colour, vec3(0.0)), vec3(2.2));
  return dot(linear, vec3(0.2126, 0.7152, 0.0722));
}

void main() {
  vec4 current = texture(uCurrent, vUv);
  if (uFirst > 0.5) {
    fragColor = current;
    return;
  }
  vec4 previous = texture(uPrevious, vUv);
  float change = abs(luma(textureLod(uCurrent, vUv, uLod).rgb)
                   - luma(textureLod(uPrevious, vUv, uLod).rgb));
  float blend = change > uAllowance ? uAllowance / change : 1.0;
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

/** `null` when the GPU cannot give it what it needs — the scene then must not run. */
export const createFlashGuard = (
  gl: WebGL2RenderingContext,
): IFlashGuard | null => {
  const vertex = compile(gl, gl.VERTEX_SHADER, SCENE_VERTEX_SOURCE);
  const fragment = compile(gl, gl.FRAGMENT_SHADER, COMPOSITE_SOURCE);
  const program = gl.createProgram();
  const vao = gl.createVertexArray();
  if (!vertex || !fragment || !program || !vao) {
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
  const where = {
    current: gl.getUniformLocation(program, 'uCurrent'),
    previous: gl.getUniformLocation(program, 'uPrevious'),
    lod: gl.getUniformLocation(program, 'uLod'),
    allowance: gl.getUniformLocation(program, 'uAllowance'),
    first: gl.getUniformLocation(program, 'uFirst'),
  };

  let width = 0;
  let height = 0;
  let scene: ITarget | undefined;
  let shown: [ITarget, ITarget] | undefined;
  let latest = 0;
  let hasShown = false;

  const release = (target: ITarget | undefined) => {
    if (target) {
      gl.deleteFramebuffer(target.framebuffer);
      gl.deleteTexture(target.texture);
    }
  };

  const makeTarget = (): ITarget | undefined => {
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
      width,
      height,
      0,
      gl.RGBA,
      gl.UNSIGNED_BYTE,
      null,
    );
    // Mipmapped, because the coarse luminance is read from a high mip level.
    gl.texParameteri(
      gl.TEXTURE_2D,
      gl.TEXTURE_MIN_FILTER,
      gl.LINEAR_MIPMAP_LINEAR,
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
    return { texture, framebuffer };
  };

  const resize = (nextWidth: number, nextHeight: number) => {
    release(scene);
    release(shown?.[0]);
    release(shown?.[1]);
    width = nextWidth;
    height = nextHeight;
    const made = [makeTarget(), makeTarget(), makeTarget()];
    const [sceneTarget, a, b] = made;
    scene = sceneTarget;
    shown = a && b ? [a, b] : undefined;
    hasShown = false;
    gl.bindFramebuffer(gl.FRAMEBUFFER, null);
  };

  return {
    begin: (nextWidth, nextHeight) => {
      if (nextWidth !== width || nextHeight !== height || !scene) {
        resize(nextWidth, nextHeight);
      }
      gl.bindFramebuffer(gl.FRAMEBUFFER, scene?.framebuffer ?? null);
    },
    end: (deltaMs) => {
      if (!scene || !shown) {
        gl.bindFramebuffer(gl.FRAMEBUFFER, null);
        return;
      }
      const previous = shown[latest];
      const next = shown[1 - latest];

      gl.activeTexture(gl.TEXTURE0);
      gl.bindTexture(gl.TEXTURE_2D, scene.texture);
      gl.generateMipmap(gl.TEXTURE_2D);
      gl.activeTexture(gl.TEXTURE1);
      gl.bindTexture(gl.TEXTURE_2D, previous.texture);
      if (hasShown) {
        gl.generateMipmap(gl.TEXTURE_2D);
      }

      gl.bindFramebuffer(gl.FRAMEBUFFER, next.framebuffer);
      gl.viewport(0, 0, width, height);
      gl.useProgram(program);
      gl.bindVertexArray(vao);
      gl.uniform1i(where.current, 0);
      gl.uniform1i(where.previous, 1);
      gl.uniform1f(where.lod, flashLod(width, height));
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
      latest = 1 - latest;
      hasShown = true;
    },
    dispose: () => {
      release(scene);
      release(shown?.[0]);
      release(shown?.[1]);
      scene = undefined;
      shown = undefined;
      gl.deleteVertexArray(vao);
      gl.deleteProgram(program);
    },
  };
};
