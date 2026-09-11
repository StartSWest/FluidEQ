import { act, renderHook } from '@testing-library/react';
import type { IScenePack } from '../../../common/scenePacks';
import type { IAccountState } from '../../../main/account/session';
import { resetAccountStore } from '../../../renderer/account/accountStore';
import { requestAccountPanel } from '../../../renderer/account/accountPanel';
import type { ISceneFrame } from '../../../renderer/graph/sceneGl';
import {
  renderCapturedStill,
  renderSceneStill,
} from '../../../renderer/graph/sceneStill';
import { markGalleryStale } from '../../../renderer/plus/galleryStore';
import type { IStudioView } from '../../../renderer/studio/studioStore';
import useStudioPublish, {
  MAX_SHOTS,
} from '../../../renderer/studio/useStudioPublish';

jest.mock('../../../renderer/graph/sceneStill', () => ({
  renderSceneStill: jest.fn(),
  renderCapturedStill: jest.fn(),
  blobAsDataUrl: async () => 'data:image/webp;base64,AQ==',
}));
jest.mock('../../../renderer/plus/galleryStore', () => ({
  markGalleryStale: jest.fn(),
}));
jest.mock('../../../renderer/account/accountPanel', () => ({
  requestAccountPanel: jest.fn(),
}));

const deferred = <T,>() => {
  let resolve: (value: T) => void = () => {
    throw new Error('not initialized');
  };
  const promise = new Promise<T>((_resolve) => {
    resolve = _resolve;
  });
  return { promise, resolve };
};
const blob = (value = 1) =>
  ({ arrayBuffer: async () => new Uint8Array([value]).buffer }) as Blob;
const pack: IScenePack = {
  schema: 1,
  id: 'neon-city',
  version: 1,
  contract: 1,
  names: { en: 'Neon City' },
  fallbackStyle: 'skyline',
  swatch: ['#050a1a', '#00e5cf'],
  source: 'vec4 sceneColour(vec2 uv) { return vec4(1.0); }',
  params: [],
};
const frame: ISceneFrame = {
  timeSeconds: 1,
  level: 0.5,
  beat: 0,
  bands: [0, 0, 0],
  accent: [1, 1, 1],
  fade: 1,
  spectrum: new Uint8Array(4),
  waveform: new Uint8Array(4),
  params: {},
};
const view = (): IStudioView => ({
  loaded: true,
  serial: 1,
  pack,
  state: { entitled: true, activeId: 'city', projectsRoot: '', projects: [] },
});
const bridge = {
  onAccountState: jest.fn(),
  myPublishedScenes: jest.fn(),
  studioTermsAgreed: jest.fn(),
  publishStudioScene: jest.fn(),
};
let accountChanged: (state: IAccountState) => void;

beforeEach(() => {
  resetAccountStore();
  jest.resetAllMocks();
  jest.mocked(renderSceneStill).mockResolvedValue(blob());
  jest.mocked(renderCapturedStill).mockResolvedValue(blob(2));
  bridge.myPublishedScenes.mockResolvedValue({ ok: true, scenes: [] });
  bridge.studioTermsAgreed.mockResolvedValue(999);
  bridge.publishStudioScene.mockResolvedValue({ ok: true });
  bridge.onAccountState.mockImplementation(
    (listener: typeof accountChanged) => {
      accountChanged = listener;
      return () => {};
    },
  );
  Object.defineProperty(window, 'electron', {
    configurable: true,
    value: { ipcRenderer: bridge },
  });
});

afterEach(resetAccountStore);

const setup = () =>
  renderHook(
    (current: IStudioView) => useStudioPublish(current, true, 'Neon City'),
    { initialProps: view() },
  );

it.each(['preparing', 'ready', 'publishing'])(
  'invalidates the %s draft when another account signs in',
  async (phase) => {
    const picture = deferred<Blob | undefined>();
    const publication = deferred<{ ok: true }>();
    if (phase === 'preparing') {
      jest.mocked(renderSceneStill).mockReturnValueOnce(picture.promise);
    }
    bridge.publishStudioScene.mockReturnValueOnce(publication.promise);
    const { result } = setup();
    act(() => {
      accountChanged({
        status: 'signed-in',
        identity: { id: 'first', email: 'first@example.com' },
      });
    });
    await act(async () => {
      result.current.begin();
    });
    if (phase === 'publishing') {
      act(() => {
        result.current.publish('space');
      });
    }
    act(() => {
      accountChanged({
        status: 'signed-in',
        identity: { id: 'second', email: 'second@example.com' },
      });
    });
    await act(async () => {
      picture.resolve(blob());
      publication.resolve({ ok: true });
    });
    expect(result.current.draft).toBeUndefined();
    expect(result.current.notice).toBeUndefined();
    expect(result.current.preparing).toBe(false);
    expect(result.current.publishing).toBe(false);
    expect(markGalleryStale).toHaveBeenCalledTimes(
      phase === 'publishing' ? 1 : 0,
    );
    expect(bridge.publishStudioScene).toHaveBeenCalledTimes(
      phase === 'publishing' ? 1 : 0,
    );
  },
);

it('refreshes the gallery after a successful publication even if Studio was unmounted', async () => {
  const pending = deferred<{ ok: true }>();
  bridge.publishStudioScene.mockReturnValueOnce(pending.promise);
  const { result, unmount } = setup();
  await act(async () => {
    result.current.begin();
  });
  act(() => {
    result.current.publish('space');
  });
  unmount();
  await act(async () => {
    pending.resolve({ ok: true });
  });
  expect(markGalleryStale).toHaveBeenCalledTimes(1);
});

it('opens the Plus account panel on entitlement refusal without reporting success', async () => {
  bridge.publishStudioScene.mockResolvedValueOnce({
    ok: false,
    reason: 'not-entitled',
  });
  const { result } = setup();
  await act(async () => {
    result.current.begin();
  });
  await act(async () => {
    result.current.publish('space');
  });
  expect(requestAccountPanel).toHaveBeenCalledWith('subscribe');
  expect(result.current.draft).toBeUndefined();
  expect(result.current.publishing).toBe(false);
  expect(markGalleryStale).not.toHaveBeenCalled();
});

it('recovers from a missing initial picture and a failed capture without losing its usable cover', async () => {
  jest.mocked(renderSceneStill).mockResolvedValueOnce(undefined);
  const { result } = setup();
  await act(async () => {
    result.current.begin();
  });
  expect(result.current.notice?.key).toBe('studio.publish.noPicture');
  expect(result.current.preparing).toBe(false);
  await act(async () => {
    result.current.begin();
  });
  const chosen = result.current.draft?.chosen;
  jest
    .mocked(renderCapturedStill)
    .mockRejectedValueOnce(new Error('context lost'));
  await act(async () => {
    result.current.capture([frame]);
  });
  expect(result.current.draft?.shots).toHaveLength(1);
  expect(result.current.draft?.chosen).toBe(chosen);
  expect(result.current.draft?.missed).toBe(true);
  await act(async () => {
    result.current.publish('space');
  });
  expect(result.current.notice?.ok).toBe(true);
});

it('publishes the selected bytes once and refreshes the gallery only after success', async () => {
  const pending = deferred<{ ok: true }>();
  bridge.publishStudioScene.mockReturnValue(pending.promise);
  const { result } = setup();
  await act(async () => {
    result.current.begin();
  });
  act(() => {
    result.current.publish('space');
    result.current.publish('space');
  });
  expect(bridge.publishStudioScene).toHaveBeenCalledTimes(1);
  expect(bridge.publishStudioScene).toHaveBeenCalledWith(
    expect.any(Number),
    'space',
    new Uint8Array([1]),
  );
  expect(markGalleryStale).not.toHaveBeenCalled();
  await act(async () => {
    pending.resolve({ ok: true });
  });
  expect(markGalleryStale).toHaveBeenCalledTimes(1);
  expect(result.current.draft).toBeUndefined();
  expect(result.current.notice?.key).toBe('studio.publish.done');
});

it.each(['project', 'build', 'invalid build', 'entitlement'])(
  'discards preparation after a change of %s',
  async (change) => {
    const pending = deferred<Blob | undefined>();
    jest.mocked(renderSceneStill).mockReturnValueOnce(pending.promise);
    const { result, rerender } = setup();
    act(() => {
      result.current.begin();
    });
    const next = view();
    if (change === 'project') {
      next.state.activeId = 'sea';
    }
    if (change === 'build') {
      next.pack = { ...pack, source: `${pack.source}\n` };
      next.serial = 2;
    }
    if (change === 'invalid build') {
      next.problems = [{ code: 'missing-file', file: 'source' }];
    }
    if (change === 'entitlement') {
      next.state.entitled = false;
    }
    rerender(next);
    await act(async () => {
      pending.resolve(blob());
    });
    expect(result.current.draft).toBeUndefined();
    expect(result.current.preparing).toBe(false);
    expect(bridge.publishStudioScene).not.toHaveBeenCalled();
  },
);

it('does not reopen a cancelled preparation or overwrite its replacement', async () => {
  const pending = deferred<Blob | undefined>();
  jest.mocked(renderSceneStill).mockReturnValueOnce(pending.promise);
  const { result } = setup();
  act(() => {
    result.current.begin();
    result.current.cancel();
  });
  await act(async () => {
    result.current.begin();
  });
  const replacement = result.current.draft;
  await act(async () => {
    pending.resolve(blob(9));
  });
  expect(result.current.draft).toBe(replacement);
  expect(replacement?.shots[0]?.picture?.bytes).toEqual(new Uint8Array([1]));
});

it.each(['offline', 'rejection'])(
  'keeps covers for retry after %s and clears the error on retry',
  async (failure) => {
    if (failure === 'offline') {
      bridge.publishStudioScene.mockResolvedValueOnce({
        ok: false,
        reason: 'offline',
      });
    } else {
      bridge.publishStudioScene.mockRejectedValueOnce(new Error('IPC failed'));
    }
    const { result } = setup();
    await act(async () => {
      result.current.begin();
    });
    await act(async () => {
      result.current.capture([frame]);
    });
    const covers = result.current.draft?.shots;
    await act(async () => {
      result.current.publish('space');
    });
    expect(result.current.publishing).toBe(false);
    expect(result.current.notice?.ok).toBe(false);
    expect(result.current.draft).toBeUndefined();
    expect(markGalleryStale).not.toHaveBeenCalled();
    await act(async () => {
      result.current.begin();
    });
    expect(result.current.draft?.shots).toEqual(covers);
    expect(result.current.notice).toBeUndefined();
    await act(async () => {
      result.current.publish('space');
    });
    expect(bridge.publishStudioScene).toHaveBeenLastCalledWith(
      expect.any(Number),
      'space',
      new Uint8Array([2]),
    );
    expect(result.current.notice?.ok).toBe(true);
  },
);

it('keeps a newer draft intact when an older publication finishes', async () => {
  const pending = deferred<{ ok: true }>();
  bridge.publishStudioScene.mockReturnValueOnce(pending.promise);
  const { result, rerender } = setup();
  await act(async () => {
    result.current.begin();
  });
  act(() => {
    result.current.publish('space');
  });
  rerender({ ...view(), serial: 2, pack: { ...pack, version: 2 } });
  await act(async () => {
    result.current.begin();
  });
  const replacement = result.current.draft;
  await act(async () => {
    pending.resolve({ ok: true });
  });
  expect(result.current.draft).toBe(replacement);
  expect(result.current.notice).toBeUndefined();
  expect(markGalleryStale).toHaveBeenCalledTimes(1);
});

it('does not let an older capture replace a newer or manually selected cover', async () => {
  const first = deferred<Blob | undefined>();
  const second = deferred<Blob | undefined>();
  jest
    .mocked(renderCapturedStill)
    .mockReturnValueOnce(first.promise)
    .mockReturnValueOnce(second.promise);
  const { result } = setup();
  await act(async () => {
    result.current.begin();
  });
  const original = result.current.draft?.chosen ?? 0;
  act(() => {
    result.current.capture([frame]);
    result.current.capture([frame]);
  });
  await act(async () => {
    second.resolve(blob(3));
  });
  const latest = result.current.draft?.chosen;
  await act(async () => {
    first.resolve(blob(2));
  });
  expect(result.current.draft?.chosen).toBe(latest);
  const third = deferred<Blob | undefined>();
  jest.mocked(renderCapturedStill).mockReturnValueOnce(third.promise);
  act(() => {
    result.current.capture([frame]);
    result.current.choose(original);
  });
  await act(async () => {
    third.resolve(blob(4));
  });
  expect(result.current.draft?.chosen).toBe(original);
});

it('bounds pending captures and keeps the cover fixed while publishing', async () => {
  const pending = deferred<Blob | undefined>();
  const publication = deferred<{ ok: false; reason: 'offline' }>();
  jest.mocked(renderCapturedStill).mockReturnValue(pending.promise);
  bridge.publishStudioScene.mockReturnValue(publication.promise);
  const { result } = setup();
  await act(async () => {
    result.current.begin();
  });
  const chosen = result.current.draft?.chosen;
  act(() => {
    Array.from({ length: 10 }).forEach(() => result.current.capture([frame]));
  });
  expect(result.current.draft?.shots).toHaveLength(MAX_SHOTS);
  act(() => {
    result.current.publish('space');
  });
  await act(async () => {
    pending.resolve(blob(2));
  });
  expect(result.current.draft?.chosen).toBe(chosen);
  expect(result.current.draft?.shots).toHaveLength(MAX_SHOTS);
  await act(async () => {
    publication.resolve({ ok: false, reason: 'offline' });
  });
});
