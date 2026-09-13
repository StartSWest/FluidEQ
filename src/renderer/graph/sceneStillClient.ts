import type { IScenePack } from 'common/scenePacks';
import type { ISceneFrame } from './sceneGl';
import type {
  TSceneStillReply,
  TSceneStillRequest,
} from './sceneStillMessages';
import { parseAccent } from './sceneUniforms';

/**
 * The page's side of the scene still worker (`sceneStill.worker.ts`).
 *
 * One worker for the session, started on the first picture or sky anyone
 * asks for. A worker that fails — its script missing, or the thread dying —
 * answers everything waiting on it with nothing and is let go; the next
 * request starts a new one. Where there are no workers at all, as under Jest,
 * every answer is nothing, the same as a machine that cannot draw the scene.
 */

type TReplyOf<K extends TSceneStillReply['kind']> = Extract<
  TSceneStillReply,
  { kind: K }
>;

let worker: Worker | undefined;
let nextId = 0;
const waiting = new Map<
  number,
  (reply: TSceneStillReply | undefined) => void
>();

const letGo = () => {
  worker?.terminate();
  worker = undefined;
  waiting.forEach((resolve) => resolve(undefined));
  waiting.clear();
};

const started = (): Worker | undefined => {
  if (worker) {
    return worker;
  }
  if (typeof Worker === 'undefined') {
    return undefined;
  }
  const next = new Worker(
    new URL(
      process.env.NODE_ENV === 'production'
        ? './scene-still.js'
        : '/scene-still.dev.js',
      window.location.href,
    ),
  );
  next.onmessage = ({ data }: MessageEvent<TSceneStillReply>) => {
    const resolve = waiting.get(data.id);
    waiting.delete(data.id);
    resolve?.(data);
  };
  next.onerror = (event) => {
    console.error('The scene still worker failed:', event.message);
    letGo();
  };
  next.onmessageerror = () => {
    console.error('A scene still worker reply could not be decoded.');
    letGo();
  };
  worker = next;
  return worker;
};

/** The theme's accent, which a worker has no styles to read. */
const pageAccent = () =>
  parseAccent(
    getComputedStyle(document.documentElement).getPropertyValue('--accent'),
  );

const ask = <K extends TSceneStillRequest['kind']>(
  request: Omit<Extract<TSceneStillRequest, { kind: K }>, 'id'>,
): Promise<TReplyOf<K> | undefined> => {
  const running = started();
  if (!running) {
    return Promise.resolve(undefined);
  }
  nextId += 1;
  const id = nextId;
  return new Promise((resolve) => {
    waiting.set(id, (reply) =>
      resolve(
        reply?.kind === request.kind ? (reply as TReplyOf<K>) : undefined,
      ),
    );
    running.postMessage({ ...request, id });
  });
};

/** `pack`'s picture under the showcase, or at a caught moment's `frames`. */
export const drawStillInWorker = async (
  pack: IScenePack,
  frames?: readonly ISceneFrame[],
): Promise<Blob | undefined> =>
  (
    await ask<'still'>({
      kind: 'still',
      pack,
      accent: pageAccent(),
      ...(frames ? { frames } : {}),
    })
  )?.blob;

/** `pack`'s showcase frames, drawn small and read back as RGBA. */
export const sampleSceneInWorker = async (
  pack: IScenePack,
): Promise<Uint8Array | undefined> =>
  (await ask<'sample'>({ kind: 'sample', pack, accent: pageAccent() }))?.pixels;
