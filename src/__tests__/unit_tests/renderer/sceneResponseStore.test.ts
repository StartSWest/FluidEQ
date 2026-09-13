const STORAGE_KEY = 'fluideq.sceneResponse';
const LOOK = 'premium:neon-city';

type TStore = typeof import('../../../renderer/utils/sceneResponseStore');
type TLibrary = typeof import('@testing-library/react/pure');

/**
 * A fresh copy of the store, so what it read from storage is read again — a
 * launch. React and the testing library come from the same fresh registry:
 * a hook from one copy of React rendered by another has no dispatcher. The
 * `pure` build, because the default one registers test hooks as it loads.
 */
let renderHook: TLibrary['renderHook'];
let act: TLibrary['act'];
let cleanup: TLibrary['cleanup'] | undefined;
const loadStore = (): TStore => {
  let store: TStore | undefined;
  jest.isolateModules(() => {
    /* eslint-disable global-require -- a fresh module registry is the point */
    ({ renderHook, act, cleanup } = require('@testing-library/react/pure'));
    store = require('../../../renderer/utils/sceneResponseStore');
    /* eslint-enable global-require */
  });
  if (!store) {
    throw new Error('store did not load');
  }
  return store;
};

beforeEach(() => {
  window.localStorage.clear();
});

afterEach(() => {
  cleanup?.();
});

describe('a listener’s attack and release for a Plus visualizer', () => {
  it('keeps what was moved, for that visualizer only, across a restart', () => {
    const store = loadStore();
    store.setListenerResponse(LOOK, 'release', 900, 200);
    store.setListenerResponse(LOOK, 'attack', 40, 0);

    const again = loadStore();
    const { result } = renderHook(() => again.useListenerResponse(LOOK));
    expect(result.current).toEqual({ attack: 40, release: 900 });
    const other = renderHook(() => again.useListenerResponse('premium:alpine'));
    expect(other.result.current).toBeUndefined();
  });

  it('forgets a value brought back onto the visualizer’s own', () => {
    const store = loadStore();
    store.setListenerResponse(LOOK, 'release', 900, 200);
    store.setListenerResponse(LOOK, 'release', 200, 200);

    expect(window.localStorage.getItem(STORAGE_KEY)).toBeNull();
    const { result } = renderHook(() => store.useListenerResponse(LOOK));
    expect(result.current).toBeUndefined();
  });

  it('keeps every value inside the response’s limits', () => {
    const store = loadStore();
    store.setListenerResponse(LOOK, 'attack', 50_000, 0);
    store.setListenerResponse(LOOK, 'release', -30, 200);

    const { result } = renderHook(() => store.useListenerResponse(LOOK));
    expect(result.current).toEqual({ attack: 1000, release: 0 });
  });

  it('goes back to the visualizer’s own timing in one step', () => {
    const store = loadStore();
    store.setListenerResponse(LOOK, 'attack', 120, 0);
    const { result } = renderHook(() => store.useListenerResponse(LOOK));
    expect(result.current).toEqual({ attack: 120 });

    act(() => store.clearListenerResponse(LOOK));
    expect(result.current).toBeUndefined();
    expect(window.localStorage.getItem(STORAGE_KEY)).toBeNull();
  });

  it('reads damaged or foreign storage as nothing chosen, never as a crash', () => {
    window.localStorage.setItem(STORAGE_KEY, '{not json');
    const broken = loadStore();
    expect(
      renderHook(() => broken.useListenerResponse(LOOK)).result.current,
    ).toBeUndefined();

    window.localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({
        [LOOK]: { attack: 'fast', release: 700, sensitivity: 3 },
        'premium:alpine': 'loud',
      }),
    );
    const foreign = loadStore();
    expect(
      renderHook(() => foreign.useListenerResponse(LOOK)).result.current,
    ).toEqual({ release: 700 });
    expect(
      renderHook(() => foreign.useListenerResponse('premium:alpine')).result
        .current,
    ).toBeUndefined();
  });

  it('learns the timing a visualizer came with from the scene that loaded it', () => {
    const store = loadStore();
    const { result } = renderHook(() => store.useOwnResponse(LOOK));
    expect(result.current).toBeUndefined();

    act(() =>
      store.reportOwnResponse(LOOK, {
        sensitivity: 1,
        threshold: 0,
        attack: 0,
        release: 200,
      }),
    );
    expect(result.current).toEqual({
      sensitivity: 1,
      threshold: 0,
      attack: 0,
      release: 200,
    });

    // A pack with no response of its own answers the neutral one.
    act(() => store.reportOwnResponse('premium:alpine', undefined));
    const alpine = renderHook(() => store.useOwnResponse('premium:alpine'));
    expect(alpine.result.current).toEqual({
      sensitivity: 1,
      threshold: 0,
      attack: 0,
      release: 0,
    });
  });
});
