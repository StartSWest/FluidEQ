import type { IScenePack } from 'common/scenePacks';
import { decodeSceneArtwork } from './sceneArtwork';
import { createFlashGuard, type IFlashGuard } from './sceneFlashGuard';
import {
  compileScene,
  createSceneContext,
  type ISceneProgram,
} from './sceneGl';
import { sameSceneProgramInputs } from './sceneProgramInputs';
import type {
  TSceneBuildResult,
  TSceneWorkerReply,
  TSceneWorkerRequest,
} from './sceneWorkerMessages';

const scope = globalThis as unknown as {
  onmessage: (event: MessageEvent<TSceneWorkerRequest>) => void;
  postMessage(reply: TSceneWorkerReply, transfer?: Transferable[]): void;
};

// Driver compilation, texture uploads and first-use shader specialization can
// all stall. None may share the event loop that handles Studio's controls.
//
// The canvas is the page's own, handed over by `attach` before anything else.
// Drawn here, a frame goes to the compositor when the task that drew it ends,
// without waiting for the page: rendered to a bitmap and posted back instead,
// it waited for the page to take the message and then for the page's next
// frame — 7 ms at the median on a quiet graph, 15 ms beside Studio, and every
// stall of the page on top — before any of it was on screen.
let canvas: OffscreenCanvas | undefined;
let gl: WebGL2RenderingContext | null = null;
let program: ISceneProgram | undefined;
let guard: IFlashGuard | null = null;
let pack: IScenePack | null = null;
let guarded = false;
let generation = 0;
let losses = 0;
let compilation: AbortController | undefined;
/** The one pixel each frame reads back to wait for the GPU. */
const probe = new Uint8Array(4);

const load = async (
  next: IScenePack,
  withGuard: boolean,
): Promise<TSceneBuildResult> => {
  generation += 1;
  compilation?.abort();
  const controller = new AbortController();
  compilation = controller;
  const mine = generation;
  const startedWithLosses = losses;
  if (!gl || gl.isContextLost() || losses >= 2) {
    return { kind: 'unavailable' };
  }
  if (program && withGuard === guarded && sameSceneProgramInputs(pack, next)) {
    pack = next;
    return { kind: 'ready', rebuilt: false };
  }
  let artwork: ImageBitmap | undefined;
  try {
    artwork = await decodeSceneArtwork(next);
    if (gl.isContextLost() || losses !== startedWithLosses) {
      return { kind: 'unavailable' };
    }
    if (mine !== generation) {
      return { kind: 'cancelled' };
    }
    if (withGuard && !guard) {
      guard = createFlashGuard(gl);
      if (!guard) {
        return { kind: 'unavailable' };
      }
    }
    const result = await compileScene(gl, next, artwork, controller.signal);
    if (
      mine !== generation ||
      gl.isContextLost() ||
      losses !== startedWithLosses
    ) {
      if (result.ok) {
        result.program.dispose();
      }
      return {
        kind:
          gl.isContextLost() || losses !== startedWithLosses
            ? 'unavailable'
            : 'cancelled',
      };
    }
    if (!result.ok) {
      return { kind: 'compile', log: result.log };
    }
    program?.dispose();
    program = result.program;
    pack = next;
    guarded = withGuard;
    if (!withGuard) {
      guard?.dispose();
      guard = null;
    }
    return { kind: 'ready', rebuilt: true };
  } catch (error) {
    // A lost first compile has no last-good pack to restore. Report it so
    // Studio leaves loading and the next save can start a fresh worker.
    if (gl.isContextLost() || losses !== startedWithLosses) {
      return { kind: 'unavailable' };
    }
    if (error instanceof DOMException && error.name === 'AbortError') {
      return { kind: 'cancelled' };
    }
    if (error instanceof DOMException && error.name === 'NotSupportedError') {
      return { kind: 'unavailable' };
    }
    return { kind: 'compile', log: String(error) };
  } finally {
    artwork?.close();
  }
};

const attach = (target: OffscreenCanvas) => {
  canvas = target;
  gl = createSceneContext(target);
  target.addEventListener('webglcontextlost', (event) => {
    event.preventDefault();
    generation += 1;
    compilation?.abort();
    program = undefined;
    guard = null;
    losses += 1;
    scope.postMessage({ kind: 'lost', fatal: losses >= 2 });
  });
  target.addEventListener('webglcontextrestored', () => {
    if (!pack || losses >= 2) {
      return;
    }
    load(pack, guarded).then((result) => {
      if (result.kind === 'ready') {
        scope.postMessage({ kind: 'restored' });
      } else if (result.kind !== 'cancelled') {
        scope.postMessage({
          kind: 'error',
          log: 'Scene context recovery failed.',
        });
      }
      return undefined;
    });
  });
};

scope.onmessage = ({ data }) => {
  if (data.kind === 'attach') {
    attach(data.canvas);
    return;
  }
  if (data.kind === 'load') {
    load(data.pack, data.guarded).then((result) => {
      scope.postMessage({ kind: 'loaded', id: data.id, result });
      return undefined;
    });
    return;
  }
  if (!canvas || !gl || !program || gl.isContextLost()) {
    scope.postMessage({ kind: 'drawn', accent: 0, costMs: 0 });
    return;
  }
  try {
    const started = performance.now();
    const { width, height, frame, clip } = data;
    if (canvas.width !== width || canvas.height !== height) {
      canvas.width = width;
      canvas.height = height;
    }
    const [left, top, right, bottom] = clip;
    const x = Math.floor(left * width);
    const y = Math.floor(top * height);
    const farX = Math.ceil(right * width);
    const farY = Math.ceil(bottom * height);
    gl.enable(gl.SCISSOR_TEST);
    gl.scissor(x, height - farY, farX - x, farY - y);
    guard?.begin(width, height);
    program.draw(frame, width, height);
    guard?.end(frame.deltaMs ?? 0);
    // One pixel read back waits for the GPU to finish this frame, so the time
    // is what the scene costs to draw, on this thread, which nothing else
    // runs on. The page's own frame interval is not that: it also holds every
    // stall of the page — an artwork decode, a React commit, a collection —
    // and judged by it, a scene loading beside the Studio's other work was
    // held at an eighth of its size or stopped as too heavy on a GPU that
    // drew it in a millisecond.
    gl.readPixels(0, 0, 1, 1, gl.RGBA, gl.UNSIGNED_BYTE, probe);
    const costMs = performance.now() - started;
    // No hand-off: the frame is committed when this task returns.
    scope.postMessage({
      kind: 'drawn',
      accent: program.musicAccent(),
      costMs,
    });
  } catch (error) {
    scope.postMessage({ kind: 'error', log: String(error) });
  }
};
