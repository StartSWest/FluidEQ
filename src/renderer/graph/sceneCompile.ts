import { SCENE_VERTEX_SOURCE } from 'common/sceneUniformContract';

const waitForLink = (
  gl: WebGL2RenderingContext,
  program: WebGLProgram,
  completion: number,
  signal?: AbortSignal,
): Promise<void> =>
  new Promise((resolve, reject) => {
    let animation: number | undefined;
    const stop = () => {
      if (animation !== undefined) {
        cancelAnimationFrame(animation);
      }
      signal?.removeEventListener('abort', abort);
    };
    const abort = () => {
      stop();
      reject(new DOMException('Scene compilation cancelled.', 'AbortError'));
    };
    const check = () => {
      if (signal?.aborted || gl.isContextLost()) {
        abort();
      } else if (gl.getProgramParameter(program, completion)) {
        stop();
        resolve();
      } else {
        animation = requestAnimationFrame(check);
      }
    };
    signal?.addEventListener('abort', abort, { once: true });
    check();
  });

/** Link completion, never COMPILE_STATUS, is the nonblocking readiness signal. */
export const linkSceneProgram = async (
  gl: WebGL2RenderingContext,
  source: string,
  sourceLineOffset: number,
  signal?: AbortSignal,
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
  try {
    gl.shaderSource(vertex, SCENE_VERTEX_SOURCE);
    gl.shaderSource(fragment, source);
    gl.compileShader(vertex);
    gl.compileShader(fragment);
    gl.attachShader(program, vertex);
    gl.attachShader(program, fragment);
    gl.linkProgram(program);
    // Reading either shader's status here made Alpine block the shared GPU
    // process for eight seconds. Only query logs/status after completion.
    await waitForLink(gl, program, parallel.COMPLETION_STATUS_KHR, signal);
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
    gl.deleteShader(vertex);
    gl.deleteShader(fragment);
    if (!linked) {
      gl.deleteProgram(program);
    }
  }
};
