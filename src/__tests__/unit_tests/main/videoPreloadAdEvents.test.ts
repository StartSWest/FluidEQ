/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

/**
 * The player's ad blocker notices an ad from what the page and its media
 * elements say, never from a sweep on a clock.
 *
 * It used to sweep the page every 350 ms as well as watching it. What that
 * sweep caught — an ad started on the same <video> with nothing the observer
 * watches changing, and a page that is not being painted, where a pass
 * waiting on a frame never runs — is now caught by the element's own events
 * and by passes that do not wait for frames off screen. The fake timers here
 * also fake `requestAnimationFrame`, and never advance: a frame never comes,
 * which is exactly the Media tab's hidden player.
 */

jest.mock('electron', () => ({
  ipcRenderer: {
    invoke: jest.fn(() => Promise.resolve(true)),
    on: jest.fn(),
    sendToHost: jest.fn(),
  },
  webFrame: { insertCSS: jest.fn() },
}));

const flush = async () => {
  for (let turn = 0; turn < 10; turn += 1) {
    // eslint-disable-next-line no-await-in-loop -- one microtask at a time
    await Promise.resolve();
  }
};

const player = () => {
  document.body.innerHTML =
    '<div id="movie_player" class="html5-video-player"><video></video></div>';
  const element = document.getElementById('movie_player');
  const video = document.querySelector('video');
  if (!element || !video) {
    throw new Error('The player did not build');
  }
  return { element, video };
};

const visibility = (state: DocumentVisibilityState) => {
  Object.defineProperty(document, 'visibilityState', {
    configurable: true,
    get: () => state,
  });
  document.dispatchEvent(new Event('visibilitychange'));
};

beforeAll(async () => {
  jest.useFakeTimers({ doNotFake: ['nextTick', 'queueMicrotask'] });
  visibility('visible');
  player();
  jest.isolateModules(() => {
    // eslint-disable-next-line global-require, @typescript-eslint/no-require-imports -- loaded once the timers are fake, as a preload runs
    require('../../../main/videoPreload');
  });
  await flush();
});

afterAll(async () => {
  // The observer's last notifications land while there is still a document
  // for them to read.
  document.body.innerHTML = '';
  await flush();
  jest.useRealTimers();
});

it('starts no sweep', () => {
  expect(jest.getTimerCount()).toBe(0);
});

it("gets past an ad that starts on the element, on the element's own event", async () => {
  const { element, video } = player();
  await flush();
  // The class alone waits for a frame that never comes here.
  element.classList.add('ad-showing');
  await flush();
  expect(video.muted).toBe(false);
  expect(video.playbackRate).toBe(1);
  video.dispatchEvent(new Event('playing'));
  await flush();
  expect(video.muted).toBe(true);
  expect(video.playbackRate).toBe(16);
});

it('takes the ad back when the page puts the sound back under it', async () => {
  const { element, video } = player();
  element.classList.add('ad-showing');
  video.dispatchEvent(new Event('loadeddata'));
  await flush();
  expect(video.muted).toBe(true);
  video.muted = false;
  expect(video.muted).toBe(false);
  video.dispatchEvent(new Event('volumechange'));
  await flush();
  expect(video.muted).toBe(true);
});

it('off screen, notices a change to the page without waiting for a frame', async () => {
  const { element, video } = player();
  await flush();
  element.classList.add('ad-showing');
  await flush();
  expect(video.muted).toBe(false);
  // Going off screen runs the pass that was waiting on a frame, and from
  // then on the page's own changes are enough.
  visibility('hidden');
  await flush();
  element.classList.remove('ad-showing');
  const next = player();
  await flush();
  expect(next.video.muted).toBe(false);
  next.element.classList.add('ad-showing');
  await flush();
  expect(next.video.muted).toBe(true);
});
