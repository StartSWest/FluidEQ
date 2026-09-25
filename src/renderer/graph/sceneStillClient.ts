import type { IScenePack } from 'common/scenePacks';
import textDigest from 'common/textDigest';
import type { ISceneFrame } from './sceneGl';
import { afterLinkTurns, sceneProgramKey } from './sceneLinkTurns';
import type {
  TSceneStillRefusal,
  TSceneStillReply,
  TSceneStillRequest,
} from './sceneStillMessages';
import { parseAccent } from './sceneUniforms';

/**
 * The page's side of the scene still worker (`sceneStill.worker.ts`).
 *
 * One worker at a time, started on the first picture or sky anyone asks for
 * and let go once nothing is waiting on it. It used to stay for the session,
 * which kept a WebGL context and every program it had compiled alive through
 * hours in which nobody opened a gallery or changed a look — pictures come in
 * bursts, when a page opens or a look changes, and the next burst starts a
 * worker again. A worker that fails — its script missing, or the thread dying —
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

/** Tells the worker whether the page can be seen, whenever that changes. */
const tellVisibility = () => {
  worker?.postMessage({ kind: 'visibility', hidden: document.hidden });
};

const letGo = () => {
  document.removeEventListener('visibilitychange', tellVisibility);
  worker?.terminate();
  worker = undefined;
  waiting.forEach((resolve) => resolve(undefined));
  waiting.clear();
};

/**
 * Lets the worker go if nothing asked for more by the end of the current task.
 *
 * Not at the moment the queue empties: a caller that draws its pictures one
 * after another asks for the next one in the continuation of the last reply,
 * a few microtasks later, and letting go in between started a worker per
 * picture. A message posted to ourselves arrives as the next task, after
 * every one of those continuations has run.
 */
const releaseWhenIdle = () => {
  if (typeof MessageChannel === 'undefined') {
    return;
  }
  const idle = new MessageChannel();
  const candidate = worker;
  idle.port1.onmessage = () => {
    idle.port1.close();
    if (waiting.size === 0 && worker === candidate) {
      letGo();
    }
  };
  idle.port2.postMessage(undefined);
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
    if (waiting.size === 0) {
      releaseWhenIdle();
    }
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
  document.addEventListener('visibilitychange', tellVisibility);
  tellVisibility();
  return worker;
};

/** The theme's accent, which a worker has no styles to read. */
const pageAccent = () =>
  parseAccent(
    getComputedStyle(document.documentElement).getPropertyValue('--accent'),
  );

/**
 * Scenes a worker gave up on this session: their drawing lost the GPU's
 * context or held the GPU far too long. Kept here and not only in the worker,
 * which is let go when idle and would come back knowing none of them — and
 * every card that scrolls back into view asks for its picture again, each ask
 * the same reset of the display.
 */
const refusedScenes = new Map<string, TSceneStillRefusal>();
/**
 * A digest of the program rather than its text, which is the whole shader
 * source and would be kept here for the session.
 */
const refusalKey = (pack: IScenePack) =>
  `${pack.version}
${textDigest(sceneProgramKey(pack))}`;

const ask = <K extends TSceneStillRequest['kind']>(
  request: Omit<Extract<TSceneStillRequest, { kind: K }>, 'id'>,
): Promise<TReplyOf<K> | undefined> => {
  const key = refusalKey(request.pack);
  const already = refusedScenes.get(key);
  if (already) {
    // The kinds that say why tell it; the others answer nothing, as before.
    return Promise.resolve(
      request.kind === 'agent'
        ? ({ kind: 'agent', id: 0, refused: already } as TReplyOf<K>)
        : undefined,
    );
  }
  const running = started();
  if (!running) {
    return Promise.resolve(undefined);
  }
  nextId += 1;
  const id = nextId;
  return new Promise((resolve) => {
    waiting.set(id, (reply) => {
      // Only a refusal that is about the SCENE is remembered here. "Too
      // heavy" is about the GPU that answered — Windows moves this window
      // between the integrated chip and the card, and Remote Desktop does it
      // without asking — so keeping it meant one spell on the slow one
      // refused a scene for the rest of the session on a machine that draws
      // it in milliseconds. The worker drops those when its context is made
      // again, which is exactly when the GPU can have changed; this is the
      // page's half of the same rule.
      if (reply?.refused && reply.refused !== 'too-heavy') {
        refusedScenes.set(key, reply.refused);
      }
      resolve(
        reply?.kind === request.kind ? (reply as TReplyOf<K>) : undefined,
      );
    });
    running.postMessage({ ...request, id });
  });
};

/** `pack`'s picture under the showcase, or at a caught moment's `frames`. */
export const drawStillInWorker = async (
  pack: IScenePack,
  frames?: readonly ISceneFrame[],
  format?: 'png',
): Promise<Blob | undefined> => {
  // After the graph's own compile of this scene, if one is under way, so this
  // one is the GPU process's cached copy (`sceneLinkTurns.ts`).
  await afterLinkTurns(sceneProgramKey(pack));
  return (
    await ask<'still'>({
      kind: 'still',
      pack,
      accent: pageAccent(),
      ...(frames ? { frames } : {}),
      ...(format ? { format } : {}),
    })
  )?.blob;
};

/**
 * `pack` drawn for the member's AI (`studio/studioAgentDraw.ts`): the shape,
 * sound and moment it asked for, where the member's wave stands.
 *
 * While the window cannot be seen nothing waits on the stage's own compile:
 * the stage does not compile then, and one it started before the window was
 * covered waits on animation frames that no longer come.
 */
export const drawForAgentInWorker = async (
  request: Omit<
    Extract<TSceneStillRequest, { kind: 'agent' }>,
    'id' | 'kind' | 'accent'
  >,
): Promise<TReplyOf<'agent'> | undefined> => {
  if (!request.unseen) {
    // Other workers' links wait on frames too, and stop with them when the
    // window is hidden: the turn is given up on then rather than waited for.
    const racing = new AbortController();
    await Promise.race([
      afterLinkTurns(sceneProgramKey(request.pack)),
      untilHidden(racing.signal),
    ]);
    racing.abort();
  }
  return ask<'agent'>({
    kind: 'agent',
    ...request,
    unseen: request.unseen || document.hidden,
    accent: pageAccent(),
  });
};

/**
 * Settles once the page cannot be seen - at once when it already cannot - and
 * stops listening when `done` fires, whichever comes first.
 */
const untilHidden = (done: AbortSignal): Promise<void> =>
  new Promise((resolve) => {
    if (document.hidden) {
      resolve();
      return;
    }
    document.addEventListener(
      'visibilitychange',
      () => {
        if (document.hidden) {
          resolve();
        }
      },
      { signal: done },
    );
  });

/** `pack`'s showcase frames, drawn small and read back as RGBA. */
export const sampleSceneInWorker = async (
  pack: IScenePack,
): Promise<Uint8Array | undefined> => {
  await afterLinkTurns(sceneProgramKey(pack));
  return (await ask<'sample'>({ kind: 'sample', pack, accent: pageAccent() }))
    ?.pixels;
};
