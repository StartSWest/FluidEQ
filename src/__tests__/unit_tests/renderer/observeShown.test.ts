import observeShown from 'renderer/utils/observeShown';

/**
 * jsdom lays nothing out and has no `checkVisibility`, so the element's
 * answer is scripted: hidden while the window is the amp with its host in
 * `body`, exactly as `_miniPlayerShell.scss` hides the app.
 */
const ampHidesApp = () =>
  document.documentElement.dataset.windowMode === 'player' &&
  document.querySelector('body > .mini-player-host') !== null;

// Mutation reports are microtasks queued at the moment of the change, so
// they have all been delivered by the time a microtask awaited after it runs.
const flush = () => Promise.resolve();

let app: HTMLDivElement;
let wave: HTMLCanvasElement;

beforeEach(() => {
  document.documentElement.dataset.windowMode = 'app';
  app = document.createElement('div');
  app.id = 'root';
  wave = document.createElement('canvas');
  app.appendChild(wave);
  document.body.appendChild(app);
  Object.defineProperty(wave, 'checkVisibility', {
    configurable: true,
    value: () => !ampHidesApp(),
  });
});

afterEach(() => {
  document.body.innerHTML = '';
  delete document.documentElement.dataset.windowMode;
});

describe('the titlebar wave coming back from the amp', () => {
  it('is told it is hidden while the amp is up, and shown again after', async () => {
    const onChange = jest.fn();
    const stop = observeShown(wave, onChange);
    expect(onChange).toHaveBeenLastCalledWith(true);

    // Into the amp: the mode flips, then the amp's host lands in `body`.
    document.documentElement.dataset.windowMode = 'player';
    const host = document.createElement('div');
    host.className = 'mini-player-host';
    document.body.appendChild(host);
    await flush();
    expect(onChange).toHaveBeenLastCalledWith(false);

    // And back out. Nothing else happens — no resize, no focus change, no
    // intersection report — which is the case that left the wave stopped.
    document.documentElement.dataset.windowMode = 'app';
    host.remove();
    await flush();
    expect(onChange).toHaveBeenLastCalledWith(true);
    stop();
  });

  it('is told on the mode alone, whichever of the two changes first', async () => {
    const onChange = jest.fn();
    const host = document.createElement('div');
    host.className = 'mini-player-host';
    document.body.appendChild(host);
    const stop = observeShown(wave, onChange);
    document.documentElement.dataset.windowMode = 'player';
    await flush();
    expect(onChange).toHaveBeenLastCalledWith(false);

    // The mode goes back before the host is taken down.
    document.documentElement.dataset.windowMode = 'app';
    await flush();
    expect(onChange).toHaveBeenLastCalledWith(true);
    stop();
  });
});
