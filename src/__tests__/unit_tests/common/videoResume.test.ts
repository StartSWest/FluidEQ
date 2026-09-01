/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>

This program is free software: you can redistribute it and/or modify
it under the terms of the GNU General Public License as published by
the Free Software Foundation, either version 3 of the License, or
(at your option) any later version.

This program is distributed in the hope that it will be useful,
but WITHOUT ANY WARRANTY; without even the implied warranty of
MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
GNU General Public License for more details.

You should have received a copy of the GNU General Public License
along with this program.  If not, see <https://www.gnu.org/licenses/>.
*/

import {
  MIN_RESUME_SECONDS,
  RESUME_REWIND_SECONDS,
  buildResumeSeekScript,
  forgetPlayback,
  parsePlaybackMarks,
  rememberPlayback,
  resumePositionFor,
  resumeUrlFor,
  serialisePlaybackMarks,
  TPlaybackMarks,
} from '../../../common/videoResume';
import { isNavigableVideoUrl } from '../../../common/videoSites';

const A_VIDEO = 'https://www.youtube.com/watch?v=abcdefghijk';
const A_TRACK = 'https://music.youtube.com/watch?v=zyxwvutsrqp';

describe('remembering where a site was left', () => {
  it('keeps one mark per site', () => {
    let marks: TPlaybackMarks = {};
    marks = rememberPlayback(marks, 'youtube', A_VIDEO, 120);
    marks = rememberPlayback(marks, 'youtube-music', A_TRACK, 90);

    expect(resumeUrlFor(marks, 'youtube')).toBe(A_VIDEO);
    expect(resumeUrlFor(marks, 'youtube-music')).toBe(A_TRACK);
  });

  it('replaces a site’s mark rather than accumulating them', () => {
    let marks: TPlaybackMarks = {};
    marks = rememberPlayback(marks, 'youtube', A_VIDEO, 120);
    marks = rememberPlayback(
      marks,
      'youtube',
      'https://www.youtube.com/watch?v=laterlaterla',
      30,
    );

    expect(Object.keys(marks)).toHaveLength(1);
    expect(resumeUrlFor(marks, 'youtube')).toBe(
      'https://www.youtube.com/watch?v=laterlaterla',
    );
  });

  it('does not mutate the marks it is given', () => {
    const before: TPlaybackMarks = {};
    const after = rememberPlayback(before, 'youtube', A_VIDEO, 120);

    expect(before).toEqual({});
    expect(after).not.toBe(before);
  });

  it('has nothing to say about a site never visited', () => {
    expect(resumeUrlFor({}, 'twitch')).toBeUndefined();
    expect(resumePositionFor({}, 'twitch')).toBe(0);
  });

  /**
   * The store is handed to the guest as a navigation, so it is checked here
   * exactly as the main process checks it. A site that is not on the list, or a
   * URL that is not, cannot become a page the player visits.
   */
  it('refuses a mark for somewhere the player may not go', () => {
    expect(
      rememberPlayback({}, 'youtube', 'https://example.com/watch', 120),
    ).toEqual({});
    expect(rememberPlayback({}, 'not-a-site', A_VIDEO, 120)).toEqual({});
  });

  /**
   * The bug this exists to make impossible. The position is sampled on a timer,
   * and a tick landing between navigating away and the interface noticing filed
   * YouTube Music's page under YouTube's name — after which the YouTube button
   * went to YouTube Music, every time.
   */
  it('refuses a page belonging to a different site', () => {
    expect(rememberPlayback({}, 'youtube', A_TRACK, 120)).toEqual({});
    expect(rememberPlayback({}, 'youtube-music', A_VIDEO, 120)).toEqual({});
    expect(rememberPlayback({}, 'soundcloud', A_VIDEO, 120)).toEqual({});
  });

  /**
   * Reachable, and still not somewhere to come back to.
   *
   * The player may navigate to a sign-in page now — that is the whole point of
   * a session that persists. Filing one as 'where you left off' would mean
   * somebody who signed in and pressed the site button landed back on the login
   * form they had just finished with.
   */
  it('refuses an account page, which it is allowed to navigate to', () => {
    expect(isNavigableVideoUrl('https://www.youtube.com/signin')).toBe(true);
    expect(
      rememberPlayback({}, 'youtube', 'https://www.youtube.com/signin', 120),
    ).toEqual({});
    expect(
      rememberPlayback({}, 'twitch', 'https://www.twitch.tv/login', 120),
    ).toEqual({});
  });

  it('forgets a site on request, and shrugs at one it never held', () => {
    const marks = rememberPlayback({}, 'youtube', A_VIDEO, 120);

    expect(forgetPlayback(marks, 'youtube')).toEqual({});
    expect(forgetPlayback(marks, 'twitch')).toBe(marks);
  });
});

describe('deciding where to start', () => {
  it('steps back a few seconds so the join is not mid-word', () => {
    const marks = rememberPlayback({}, 'youtube', A_VIDEO, 120);

    expect(resumePositionFor(marks, 'youtube')).toBe(
      120 - RESUME_REWIND_SECONDS,
    );
  });

  it('never steps back past the beginning', () => {
    // The shortest position that is kept at all, which is where the run-up has
    // the least room. It has to land inside the media rather than before it.
    const marks = rememberPlayback({}, 'youtube', A_VIDEO, MIN_RESUME_SECONDS);
    const start = resumePositionFor(marks, 'youtube');

    expect(start).toBe(MIN_RESUME_SECONDS - RESUME_REWIND_SECONDS);
    expect(start).toBeGreaterThanOrEqual(0);
  });

  /**
   * A page open for a moment should not make the next visit start somewhere
   * arbitrary — but it should still be the page that comes back.
   */
  it('keeps the page but not a position barely into it', () => {
    const marks = rememberPlayback(
      {},
      'youtube',
      A_VIDEO,
      MIN_RESUME_SECONDS - 1,
    );

    expect(resumeUrlFor(marks, 'youtube')).toBe(A_VIDEO);
    expect(resumePositionFor(marks, 'youtube')).toBe(0);
  });

  it('ignores a position that is not a number at all', () => {
    const marks = rememberPlayback(
      {},
      'youtube',
      A_VIDEO,
      Number.POSITIVE_INFINITY,
    );

    expect(resumeUrlFor(marks, 'youtube')).toBe(A_VIDEO);
    expect(resumePositionFor(marks, 'youtube')).toBe(0);
  });
});

/**
 * Put a media element on the page for the script to find.
 *
 * jsdom has a real `<video>` and real events; what it has no notion of is
 * loading anything, so the three properties a player would have filled in are
 * defined on the instance. `play` is a spy rather than jsdom's own, which
 * throws "not implemented" — and a throw is not the thing being watched for
 * here, a call is.
 */
const givenMediaOnThePage = ({
  readyState = 0,
  duration = 300,
  width = 640,
  height = 360,
} = {}) => {
  const el = document.createElement('video');
  Object.defineProperty(el, 'readyState', {
    value: readyState,
    configurable: true,
  });
  // jsdom has no layout engine, so `clientWidth` and `clientHeight` are always
  // zero and the script's sort-by-area would be a no-op — every element would
  // tie and the first in document order would win by accident. Given here so
  // the ordering the script actually depends on is the ordering under test.
  Object.defineProperty(el, 'clientWidth', {
    value: width,
    configurable: true,
  });
  Object.defineProperty(el, 'clientHeight', {
    value: height,
    configurable: true,
  });
  Object.defineProperty(el, 'duration', {
    value: duration,
    configurable: true,
  });
  Object.defineProperty(el, 'currentTime', {
    value: 0,
    writable: true,
    configurable: true,
  });
  const play = jest.fn(() => Promise.resolve());
  el.play = play;
  document.body.appendChild(el);
  return { el, play };
};

/**
 * Run it the way the player does: as source, against a document.
 *
 * Reading the text of the script and asserting on that would pass just as
 * happily against something that no longer parses, and the whole value of this
 * file is that it is the same string the guest is handed.
 */
const runInThePage = (script: string) =>
  // eslint-disable-next-line no-new-func
  new Function(`return ${script};`)();

describe('picking a page back up', () => {
  afterEach(() => {
    document.body.innerHTML = '';
  });

  it('seeks to the position once the media says how long it is', () => {
    const { el } = givenMediaOnThePage();

    runInThePage(buildResumeSeekScript(117));

    // Nothing yet: `currentTime` set before metadata has arrived is discarded
    // silently, which would be a resume that quietly started from the top.
    expect(el.currentTime).toBe(0);

    el.dispatchEvent(new Event('loadedmetadata'));

    expect(el.currentTime).toBe(117);
  });

  it('seeks straight away when the media is already loaded', () => {
    const { el } = givenMediaOnThePage({ readyState: 1 });

    runInThePage(buildResumeSeekScript(117));

    expect(el.currentTime).toBe(117);
  });

  /**
   * The rule this whole thing exists for, and the one that regresses silently:
   * everything still looks right on screen when a restored page plays itself,
   * it is only the room it happens in that is wrong. Opening the tab restores
   * what was on and leaves it paused; pressing play is somebody's decision.
   */
  it('never presses play', () => {
    const { el, play } = givenMediaOnThePage({ readyState: 1 });

    runInThePage(buildResumeSeekScript(117));
    el.dispatchEvent(new Event('loadedmetadata'));

    expect(play).not.toHaveBeenCalled();
  });

  it('leaves a video that had already finished where it is', () => {
    const { el } = givenMediaOnThePage({ readyState: 1, duration: 60 });

    runInThePage(buildResumeSeekScript(117));

    expect(el.currentTime).toBe(0);
  });

  it('has nothing to seek to when there was no position worth keeping', () => {
    const { el, play } = givenMediaOnThePage({ readyState: 1 });

    runInThePage(buildResumeSeekScript(0));

    expect(el.currentTime).toBe(0);
    expect(play).not.toHaveBeenCalled();
  });

  /**
   * The observer reacts to a mutation, then looks a frame later — so a test
   * has to let both happen. Two frames, because the mutation callback is what
   * schedules the frame.
   */
  const settle = async () => {
    for (let i = 0; i < 3; i += 1) {
      // eslint-disable-next-line no-await-in-loop -- frames are sequential.
      await new Promise((resolve) => {
        requestAnimationFrame(() => resolve(undefined));
      });
    }
  };

  /**
   * THE CASE THE TWENTY-SECOND POLL EXISTED FOR.
   *
   * These sites do not have a player in the document when the page fires its
   * load event — they mount one several levels down once their own bundle has
   * run. The script used to wait for that by asking every 250ms, eighty times,
   * which is the shape this project bans: a duration standing in for an event.
   * It is now a `MutationObserver`, and this is the test that says the
   * replacement actually does the job the timer was doing.
   */
  it('seeks a player that is only added to the page later', async () => {
    runInThePage(buildResumeSeekScript(117));

    // Nothing on the page yet, which is where the old poll would have started
    // counting.
    expect(document.querySelector('video')).toBeNull();

    const { el } = givenMediaOnThePage({ readyState: 1 });
    await settle();

    expect(el.currentTime).toBe(117);
  });

  it('stops observing once it has seeked, and does not seek a second player', async () => {
    runInThePage(buildResumeSeekScript(117));

    const { el } = givenMediaOnThePage({ readyState: 1 });
    await settle();
    expect(el.currentTime).toBe(117);

    // An advert player mounting afterwards must not be rewound to the
    // position of the video the user was actually watching.
    const later = givenMediaOnThePage({ readyState: 1 });
    await settle();

    expect(later.el.currentTime).toBe(0);
  });

  it('waits for metadata on a player that arrives late without it', async () => {
    runInThePage(buildResumeSeekScript(117));

    const { el } = givenMediaOnThePage();
    await settle();

    expect(el.currentTime).toBe(0);
    el.dispatchEvent(new Event('loadedmetadata'));
    expect(el.currentTime).toBe(117);
  });

  /**
   * The largest of several players wins, not the first in document order.
   *
   * These pages carry more than one media element — an advert, a muted
   * preview, a miniplayer — and the one somebody is watching is the big one.
   *
   * This pins the SELECTION, and deliberately claims nothing about the frame
   * hop in the observer: the same test was run with that hop removed and
   * passed, because both elements land in one mutation batch either way. The
   * hop is there to avoid forcing a reflow per batch, which is a cost, not a
   * behaviour, and is not something this suite can see.
   */
  it('picks the largest player, not the first one to mount', async () => {
    runInThePage(buildResumeSeekScript(117));

    const advert = givenMediaOnThePage({
      readyState: 1,
      width: 20,
      height: 20,
    });
    const player = givenMediaOnThePage({
      readyState: 1,
      width: 640,
      height: 360,
    });
    await settle();

    expect(player.el.currentTime).toBe(117);
    expect(advert.el.currentTime).toBe(0);
  });

  /**
   * A burst of mutations costs one pass, not one pass each.
   *
   * `largest()` reads `clientWidth`, and reading that from a mutation callback
   * forces a synchronous reflow — so a page that mutates continuously while it
   * boots would pay for one on every batch. This is the assertion that the
   * frame hop is actually doing that job, since the selection tests cannot see
   * it.
   */
  it('looks once per frame however many times the page mutates', async () => {
    const spy = jest.spyOn(document, 'querySelectorAll');
    try {
      runInThePage(buildResumeSeekScript(117));
      const afterInitialAttempt = spy.mock.calls.length;

      // Twenty separate batches, each its own microtask checkpoint, with no
      // media element for any of them to find.
      for (let i = 0; i < 20; i += 1) {
        document.body.appendChild(document.createElement('div'));
        // eslint-disable-next-line no-await-in-loop -- separate batches is the point.
        await Promise.resolve();
      }

      // Without the hop this would be twenty lookups. With it, the frame has
      // not come round yet, so it is none.
      expect(spy.mock.calls.length).toBe(afterInitialAttempt);

      await settle();
      expect(spy.mock.calls.length).toBeLessThanOrEqual(
        afterInitialAttempt + 2,
      );
    } finally {
      spy.mockRestore();
    }
  });

  /**
   * The position becomes source in another process's page. It has been checked
   * twice before it gets here, which is the reason to check it once more rather
   * than the reason not to.
   */
  it('writes nothing but a number into the script', () => {
    expect(buildResumeSeekScript(Number.NaN)).toContain('const at = 0;');
    expect(buildResumeSeekScript(Number.POSITIVE_INFINITY)).toContain(
      'const at = 0;',
    );
    expect(buildResumeSeekScript(-30)).toContain('const at = 0;');
  });
});

describe('reading the store back', () => {
  it('survives a round trip', () => {
    const marks = rememberPlayback({}, 'youtube', A_VIDEO, 120);

    expect(parsePlaybackMarks(serialisePlaybackMarks(marks))).toEqual(marks);
  });

  it.each([
    ['nothing stored', null],
    ['an empty string', ''],
    ['not JSON at all', '{not json'],
    ['a JSON array', '[]'],
    ['a JSON scalar', '42'],
  ])('gives back an empty set for %s', (_case, raw) => {
    expect(parsePlaybackMarks(raw)).toEqual({});
  });

  it('drops an entry pointing somewhere the player may not go', () => {
    const raw = JSON.stringify({
      youtube: { url: 'https://example.com/watch', position: 30 },
      'youtube-music': { url: A_TRACK, position: 30 },
    });

    expect(parsePlaybackMarks(raw)).toEqual({
      'youtube-music': { url: A_TRACK, position: 30 },
    });
  });

  /**
   * Self-healing, and it has to be: a build that wrote mismatched marks has
   * already put them on somebody's disk, and without this they would keep
   * sending that button to the wrong site for good.
   */
  it('drops an entry filed under the wrong site', () => {
    const raw = JSON.stringify({
      youtube: { url: A_TRACK, position: 30 },
      'youtube-music': { url: A_TRACK, position: 30 },
    });

    expect(parsePlaybackMarks(raw)).toEqual({
      'youtube-music': { url: A_TRACK, position: 30 },
    });
  });

  it('drops an entry for a site that no longer exists', () => {
    const raw = JSON.stringify({
      vimeo: { url: 'https://vimeo.com/76979871', position: 30 },
      youtube: { url: A_VIDEO, position: 30 },
    });

    expect(parsePlaybackMarks(raw)).toEqual({
      youtube: { url: A_VIDEO, position: 30 },
    });
  });

  it.each([
    ['a missing position', { url: A_VIDEO }],
    ['a position that is text', { url: A_VIDEO, position: '30' }],
    ['a negative position', { url: A_VIDEO, position: -1 }],
    ['a missing url', { position: 30 }],
    ['no mark at all', null],
  ])('drops an entry with %s', (_case, mark) => {
    expect(parsePlaybackMarks(JSON.stringify({ youtube: mark }))).toEqual({});
  });
});
