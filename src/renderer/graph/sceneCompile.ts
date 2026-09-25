import { SCENE_VERTEX_SOURCE } from 'common/sceneUniformContract';

/**
 * Programs whose link was given up on, each deleted once its link has
 * finished on its own.
 *
 * A link cannot be cancelled: ANGLE compiles on the GPU process's threads, and
 * deleting the program — or its context, which ending the worker does —
 * waits for that compile on the GPU process's main thread, where every
 * WebGL context in the window is served. Alpine takes nine seconds to compile
 * on an RTX 4080 and twenty-three in a busy window; leaving it mid-link froze
 * every scene, and the next one's context could not even be created, for as
 * long as that took — the minute-long "Loading visualizer". So a program
 * given up on is kept until its link completes, then deleted, and a worker
 * waits for `linksSettled` before it is ended.
 */
const unsettled = new Set<Promise<void>>();

/**
 * Runs `release` once `linked` says every link it cares about is done, or
 * the context is gone, checked on animation frames; `linksSettled` waits for
 * it. For a 3D world given up on mid-link as well as a shader: three's
 * programs are deleted by disposing their materials, and deleting one still
 * linking is the same freeze.
 */
export const releaseWhenLinked = (
  gl: WebGL2RenderingContext,
  linked: () => boolean,
  release: () => void,
): void => {
  const settled = new Promise<void>((resolve) => {
    const check = () => {
      if (gl.isContextLost() || linked()) {
        release();
        resolve();
      } else {
        requestAnimationFrame(check);
      }
    };
    check();
  });
  unsettled.add(settled);
  settled
    .then(() => unsettled.delete(settled))
    .catch(() => unsettled.delete(settled));
};

const deleteWhenLinked = (
  gl: WebGL2RenderingContext,
  program: WebGLProgram,
  completion: number,
) =>
  releaseWhenLinked(
    gl,
    () => Boolean(gl.getProgramParameter(program, completion)),
    () => gl.deleteProgram(program),
  );

/** Resolves once every program given up on mid-link has been deleted. */
export const linksSettled = async (): Promise<void> => {
  if (unsettled.size === 0) {
    return;
  }
  await Promise.all(unsettled);
  // More may have been given up on while those settled.
  await linksSettled();
};

const waitForLink = (
  gl: WebGL2RenderingContext,
  program: WebGLProgram,
  completion: number,
  signal?: AbortSignal,
  hurry?: AbortSignal,
): Promise<void> =>
  new Promise((resolve, reject) => {
    let animation: number | undefined;
    const stop = () => {
      if (animation !== undefined) {
        cancelAnimationFrame(animation);
      }
      signal?.removeEventListener('abort', abort);
      hurry?.removeEventListener('abort', rush);
    };
    const abort = () => {
      stop();
      reject(new DOMException('Scene compilation cancelled.', 'AbortError'));
    };
    // No more frames are coming to poll on: done waiting, and the caller
    // reads the link to its end.
    const rush = () => {
      stop();
      resolve();
    };
    const check = () => {
      if (signal?.aborted || gl.isContextLost()) {
        abort();
      } else if (
        hurry?.aborted ||
        gl.getProgramParameter(program, completion)
      ) {
        stop();
        resolve();
      } else {
        animation = requestAnimationFrame(check);
      }
    };
    signal?.addEventListener('abort', abort, { once: true });
    hurry?.addEventListener('abort', rush, { once: true });
    check();
  });

/**
 * Link completion, never COMPILE_STATUS, is the nonblocking readiness signal.
 *
 * `hurry`: fired when the window cannot be seen, so no animation frame will
 * come to poll on — Chromium stops them for a covered or minimised window —
 * and a wait for one lasts until the member looks at FluidEQ again. Fired
 * already, or at any moment of the wait, and the link is read to its end in
 * one call, which holds the GPU process until the driver is done: the freeze
 * the polling exists to avoid, taken only when there is no window on screen
 * to freeze. Only the member's AI asking for a picture (`studioAgentDraw.ts`)
 * passes it, because that is the one caller that is expected to ask while
 * the member is looking at something else - or to be hidden mid-link.
 */
export const linkSceneProgram = async (
  gl: WebGL2RenderingContext,
  source: string,
  sourceLineOffset: number,
  signal?: AbortSignal,
  hurry?: AbortSignal,
): Promise<
  { ok: true; program: WebGLProgram } | { ok: false; log: string }
> => {
  const parallel = gl.getExtension('KHR_parallel_shader_compile');
  if (!parallel) {
    // A synchronous fallback freezes the compositor too, even from a worker.
    throw new DOMException(
      'Nonblocking scene compilation is unavailable.',
      'NotSupportedError',
    );
  }
  const vertex = gl.createShader(gl.VERTEX_SHADER);
  const fragment = gl.createShader(gl.FRAGMENT_SHADER);
  const program = gl.createProgram();
  if (!vertex || !fragment || !program) {
    gl.deleteShader(vertex);
    gl.deleteShader(fragment);
    gl.deleteProgram(program);
    return { ok: false, log: 'could not create shader program' };
  }
  let linked = false;
  let linking = false;
  try {
    gl.shaderSource(vertex, SCENE_VERTEX_SOURCE);
    gl.shaderSource(fragment, source);
    gl.compileShader(vertex);
    gl.compileShader(fragment);
    gl.attachShader(program, vertex);
    gl.attachShader(program, fragment);
    gl.linkProgram(program);
    linking = true;
    // Reading either shader's status here made Alpine block the shared GPU
    // process for eight seconds. Only query logs/status after completion —
    // unless no frame will come to wait on (see `hurry` above).
    if (!hurry?.aborted) {
      await waitForLink(
        gl,
        program,
        parallel.COMPLETION_STATUS_KHR,
        signal,
        hurry,
      );
    }
    linking = false;
    if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
      const log =
        gl.getShaderInfoLog(fragment) ||
        gl.getShaderInfoLog(vertex) ||
        gl.getProgramInfoLog(program) ||
        'unknown link error';
      return {
        ok: false,
        log: log.replace(
          /ERROR:\s*(\d+):(\d+)/g,
          (_match, column: string, line: string) =>
            `ERROR: ${column}:${Math.max(1, Number(line) - sourceLineOffset)}`,
        ),
      };
    }
    linked = true;
    return { ok: true, program };
  } finally {
    // Flagged for deletion only: attached to a program still linking, a
    // shader is freed with it, and nothing here waits.
    gl.deleteShader(vertex);
    gl.deleteShader(fragment);
    if (linking && !gl.isContextLost()) {
      deleteWhenLinked(gl, program, parallel.COMPLETION_STATUS_KHR);
    } else if (!linked) {
      gl.deleteProgram(program);
    }
  }
};
