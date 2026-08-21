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

/**
 * The scripts and stylesheet injected into a video site's page.
 *
 * Two hundred and ninety lines of string, and the only part of the browser that
 * runs somewhere else. Everything here is sent across the webview boundary and
 * evaluated in a page FluidEQ does not control, which is exactly why it is worth
 * having on its own: the rules for writing it are different from the rest of
 * this feature — no imports, no types, no build step, and no assumption about
 * what the page contains.
 *
 * The generation number that several of these take is not decoration. A webview
 * can still be running the last theatre-mode script when the next one arrives,
 * and without a generation to compare against, the old one's teardown undoes
 * the new one's setup.
 */
/**
 * Just the picture, with the page it came from out of the way.
 *
 * Injected while the graph is expanded or full screen. The rest of a video page
 * — header, sidebar, recommendations, comments — is what you scroll through to
 * *find* something; once it is playing with a spectrum over it, all of it is
 * furniture around a rectangle.
 *
 * Hidden by chain rather than by pinning the player. A z-index only sorts within
 * its own stacking context and these sites nest their players in several, so a
 * player told to be above everything still had the comments painted over it.
 * Marking the path from the document down to the player and hiding whatever is
 * not on it at each level has no such ceiling, and names nothing per-site.
 *
 * The pruning stops *at* the player: it is on the chain itself, so without that
 * the rule reached inside and hid its own children — the video among them.
 */
export const PLAYER_ONLY_CSS = `
  /* Transparent rather than black, so the letterbox is the app's own
     background rather than two different blacks meeting at the edge of the
     picture. A video that does not match the window shape now sits in the
     workspace instead of in a black box inside it. */
  html[data-fluideq-solo],
  html[data-fluideq-solo] body {
    overflow: hidden !important;
    background: transparent !important;
  }
  html[data-fluideq-solo]
    [data-fluideq-keep]:not([data-fluideq-player])
    > *:not([data-fluideq-keep]) {
    display: none !important;
  }
  html[data-fluideq-solo] [data-fluideq-keep]:not([data-fluideq-player]) {
    display: block !important;
    width: auto !important;
    max-width: none !important;
    height: auto !important;
    max-height: none !important;
    padding: 0 !important;
    margin: 0 !important;
  }
  html[data-fluideq-solo] [data-fluideq-player] {
    position: fixed !important;
    z-index: 2147483647 !important;
    top: 0 !important;
    left: 0 !important;
    width: 100vw !important;
    height: 100vh !important;
    background: transparent !important;
  }

  /* Twitch, and Twitch alone.

     Pinning its player works — the box really is the viewport — but the video
     inside stayed short and left a band across the bottom. The cause is one
     inline style Twitch puts on 'video-player__container':

       max-height: calc(-16rem + 100vh)

     which is the room it leaves for the chat and the channel bar underneath.
     With the rest of the page hidden there is nothing under it to leave room
     for, and 16rem is 160px here rather than 256 because Twitch sets its root
     font size to 10px. On a 720-tall window that capped the picture at 560 and
     put 160 pixels of black below it.

     Measured on a live channel rather than reasoned about: player 1280x720,
     video 1280x560, and 1280x720 throughout once these three rules are in.

     Scoped by 'data-a-target', which is Twitch's own attribute and exists on no
     other site here — so this cannot reach YouTube's player, which does not
     have the problem and has twice been broken by a rule meant for somebody
     else. 'contain' keeps a stream that does not match the window letterboxed
     rather than stretched. */
  html[data-fluideq-solo]
    [data-a-target='video-player'][data-fluideq-player]
    .video-player__container,
  html[data-fluideq-solo]
    [data-a-target='video-player'][data-fluideq-player]
    [data-a-target='video-ref'],
  html[data-fluideq-solo]
    [data-a-target='video-player'][data-fluideq-player]
    video {
    position: absolute !important;
    inset: 0 !important;
    width: 100% !important;
    max-width: none !important;
    height: 100% !important;
    max-height: none !important;
  }
  html[data-fluideq-solo]
    [data-a-target='video-player'][data-fluideq-player]
    video {
    object-fit: contain !important;
  }
`;

/**
 * Mark the path to the player, and keep it marked.
 *
 * The observer is the part that matters. Marking once works for about a second
 * on YouTube: it is a single-page app that rebuilds its own tree constantly, and
 * the moment it swapped the player out, the marks pointed at elements no longer
 * in the document — so the rule hid everything and left a black screen. Re-
 * marking whenever the tree changes is what makes this survive contact with a
 * real site.
 *
 * Coalesced onto an animation frame, because a page like that mutates hundreds
 * of times a second and re-walking the ancestor chain on each one would cost
 * more than the page it is hiding.
 */
export const enterPlayerOnlyScript = (generation: number) => `(() => {
  // Which run of the mode owns this page. The teardown reads it and refuses to
  // undo a run newer than itself — see 'exitPlayerOnlyScript'.
  window.__fluideqGen = ${generation};
  // Most specific first, because several of these match on the same page and
  // the first hit wins. YouTube Music is why the list is ordered rather than
  // merely long: it wraps the same '#movie_player' YouTube uses inside its own
  // 'ytmusic-player', and marking the inner one leaves the app's chrome — nav
  // rail, queue, now-playing bar — off the chain and therefore hidden, which on
  // a music app removes the half people actually use.
  const SELECTOR =
    'ytmusic-player, #movie_player, .html5-video-player, [data-a-target="video-player"]';
  const mark = () => {
    // The largest video, rather than the first in the document. Pages are full
    // of thumbnails and preview loops; the one being watched is the big one.
    const videos = Array.from(document.querySelectorAll('video'));
    videos.sort(
      (a, b) =>
        b.clientWidth * b.clientHeight - a.clientWidth * a.clientHeight
    );
    const player =
      document.querySelector(SELECTOR) ||
      (videos[0] && videos[0].parentElement);
    if (!player) { return; }
    // Nothing is hidden until there is something to show in its place.
    //
    // These pages build the player element well before the video goes into it,
    // and hiding the whole page around an empty box is a black screen. It is
    // also the small picture in the corner that vanishes: the box is pinned to
    // a viewport that is still being resized, measured before the video is in
    // it. Returning leaves the page visible until there is a picture to replace
    // it with, and the observer calls this again on the next change — the video
    // arriving being one of them.
    if (!player.querySelector('video')) { return; }
    // Already correct — which means marked, attached, *and* still standing on a
    // chain that is marked the whole way up.
    //
    // That last clause is the one this cost an evening for. YouTube reparents
    // '#movie_player' when the viewport changes: a different layout container,
    // four levels away from the old one. The element is still the player and
    // still in the document, so the old test returned here and never re-walked
    // — leaving the marks on ancestors it no longer has, and the rule below
    // hiding the branch it had moved into. The player collapsed to 0x0 and no
    // amount of observing brought it back, because every callback took this
    // early return.
    //
    // It is why the two modes disagreed: each has its own viewport, so each
    // gets its own chain, and whichever was marked first was wrong for the
    // other. It is why it alternated, why the first go after a reload always
    // worked, and why a reload was the only thing that fixed it.
    //
    // Walking up to check costs a dozen attribute reads at most once per
    // animation frame, against a page that mutates hundreds of times a second.
    if (player.hasAttribute('data-fluideq-player') && player.isConnected) {
      let intact = true;
      let up = player.parentElement;
      while (up && up !== document.documentElement) {
        if (!up.hasAttribute('data-fluideq-keep')) { intact = false; break; }
        up = up.parentElement;
      }
      if (intact) { return; }
    }
    document
      .querySelectorAll('[data-fluideq-keep], [data-fluideq-player]')
      .forEach((node) => {
        node.removeAttribute('data-fluideq-keep');
        node.removeAttribute('data-fluideq-player');
      });
    player.setAttribute('data-fluideq-player', '');
    let node = player;
    while (node && node !== document.documentElement) {
      node.setAttribute('data-fluideq-keep', '');
      node = node.parentElement;
    }
    document.documentElement.setAttribute('data-fluideq-solo', '');
  };
  mark();
  if (window.__fluideqSolo) { window.__fluideqSolo.disconnect(); }
  let queued = false;
  window.__fluideqSolo = new MutationObserver(() => {
    if (queued) { return; }
    queued = true;
    requestAnimationFrame(() => { queued = false; mark(); });
  });
  window.__fluideqSolo.observe(document.documentElement, {
    childList: true,
    subtree: true,
  });
  return 'ok';
})()`;

/**
 * Take the mode off the page — unless a newer run has already put it back on.
 *
 * React runs an effect's cleanup before the next effect's body, and that
 * ordering is worth nothing here: both of these are messages to another
 * process. They are dispatched one after the other and execute in whichever
 * order the guest reaches them. Every mode change sends a teardown and a setup
 * within the same tick, so the winner alternates — which is exactly what
 * "it inverts each time I hit Ctrl+F" means, and why the first go after a
 * reload always worked and the next one did not.
 *
 * When the teardown wins it disconnects the observer the setup has just
 * installed and unmarks the tree it has just marked. Nothing is left watching,
 * so the page never recovers on its own; only a reload clears it, which is why
 * expanded was broken afterwards too.
 *
 * The generation makes the pair order-independent instead of trying to make it
 * ordered. A teardown only undoes the run whose number is still on the page.
 */
export const exitPlayerOnlyScript = (generation: number) => `(() => {
  if (
    window.__fluideqGen !== undefined &&
    window.__fluideqGen !== ${generation}
  ) {
    return 'stale';
  }
  window.__fluideqGen = undefined;
  if (window.__fluideqSolo) {
    window.__fluideqSolo.disconnect();
    window.__fluideqSolo = undefined;
  }
  document.documentElement.removeAttribute('data-fluideq-solo');
  document
    .querySelectorAll('[data-fluideq-keep], [data-fluideq-player]')
    .forEach((node) => {
      node.removeAttribute('data-fluideq-keep');
      node.removeAttribute('data-fluideq-player');
    });
  return 'ok';
})()`;

/**
 * Pause every media element on the page.
 *
 * Run before navigating away. A player still running holds its document open
 * against the navigation, which is why choosing another site while YouTube
 * Music was playing appeared to do nothing at all — the request was made and
 * the page simply would not let go.
 */
export const STOP_PLAYBACK = `(() => {
  document.querySelectorAll('video, audio').forEach((media) => {
    try { media.pause(); } catch (e) { /* already gone */ }
  });
  return 'ok';
})()`;

/**
 * How far into whatever is playing, in seconds.
 *
 * The one that is running is preferred over the one that is biggest: a page can
 * hold a muted preview loop larger than the thing being listened to, and an
 * audio element has no size at all, so area alone picks the wrong one on a
 * music site. Falls back to the largest when nothing is playing, which is the
 * paused video somebody means to come back to.
 */
export const READ_POSITION = `(() => {
  const media = Array.from(document.querySelectorAll('video, audio'));
  if (!media.length) { return 0; }
  media.sort(
    (a, b) => (b.clientWidth * b.clientHeight) - (a.clientWidth * a.clientHeight)
  );
  const playing = media.find((el) => !el.paused && el.currentTime > 0);
  const chosen = playing || media[0];
  return Number.isFinite(chosen.currentTime) ? chosen.currentTime : 0;
})()`;

/**
 * Whether the page has a player at all, and whether it is running.
 *
 * `true` or `false` when there is something to control, `null` when there is
 * nothing. The bar at the foot of the window uses the difference: a page with
 * no media gets no bar, rather than a play button that would do nothing when
 * pressed.
 *
 * Asked when a page finishes arriving, because the tag only reports playback
 * once it *starts* — a video that is sitting there paused, which is every
 * video the autoplay policy stopped, announces nothing at all.
 */
export const PROBE_PLAYBACK = `(() => {
  const media = [...document.querySelectorAll('video, audio')];
  if (media.length === 0) { return null; }
  return media.some((m) => !m.paused && !m.ended);
})()`;

/**
 * End the page's own fullscreen, and never begin one.
 *
 * `exitFullscreen` rather than the site's button, deliberately: the button is a
 * toggle and would put the page *into* fullscreen whenever it was not already
 * there, which is how this used to alternate between working and not.
 */
export const EXIT_PAGE_FULLSCREEN = `(() => {
  if (!document.fullscreenElement) { return 'none'; }
  document.exitFullscreen();
  return 'exit';
})()`;

/**
 * Play or pause whatever the page is playing, and say which it did.
 *
 * The element chosen is the one that is running, or failing that the largest —
 * the same preference `READ_POSITION` explains at length, and for the same
 * reason: a page can hold a muted preview loop bigger than the thing being
 * listened to.
 *
 * This one is run WITH a user gesture, unlike everything else here, and that
 * is correct rather than an oversight: it exists because somebody pressed play
 * on our own bar. Granting the activation is what lets the guest's `play()`
 * through under the autoplay policy the tag is loaded with — see
 * `VIDEO_WEB_PREFERENCES`. Nothing else in this file asks for it, and nothing
 * else should.
 */
export const TOGGLE_PLAYBACK = `(() => {
  const media = [...document.querySelectorAll('video, audio')];
  if (media.length === 0) {
    return 'none';
  }
  const playing = media.find((m) => !m.paused && !m.ended);
  const target = playing
    ?? media.reduce((best, m) => {
      const area = (m.clientWidth || 0) * (m.clientHeight || 0);
      const bestArea = (best.clientWidth || 0) * (best.clientHeight || 0);
      return area > bestArea ? m : best;
    }, media[0]);
  try {
    if (target.paused || target.ended) {
      target.play();
      return 'playing';
    }
    target.pause();
    return 'paused';
  } catch (e) {
    return 'none';
  }
})()`;

/**
 * The guest's own volume, for the fader on our bar.
 *
 * Set on every media element rather than only the one being listened to: a
 * page that swaps players between an ad and the video would otherwise start
 * the next one back at full volume, having never been told.
 */
export const setGuestVolumeScript = (volume: number) => `(() => {
  document.querySelectorAll('video, audio').forEach((media) => {
    try { media.volume = ${Math.min(1, Math.max(0, volume))}; } catch (e) { /* gone */ }
  });
  return 'ok';
})()`;

/**
 * Move the page's playhead by a step, from wherever it actually is.
 *
 * A step and not a position, because this end does not know the position: the
 * pane samples the guest every few seconds for its resume mark, and five
 * seconds worked out from a five-second-old reading lands somewhere nobody
 * asked for. The page holds the truth and does the arithmetic.
 *
 * The element is chosen the way `READ_POSITION` chooses one, and for the same
 * reason: the running player first, the largest otherwise, so a muted preview
 * loop bigger than the video does not take the press.
 *
 * Clamped at both ends. Past the end is a video that finished — and on a
 * stream with no duration to compare against, the guest is left to refuse the
 * seek itself, which it does far more sensibly than a guess from here.
 */
export const nudgePositionScript = (deltaSeconds: number) => `(() => {
  const media = [...document.querySelectorAll('video, audio')];
  if (media.length === 0) { return 'none'; }
  media.sort(
    (a, b) => (b.clientWidth * b.clientHeight) - (a.clientWidth * a.clientHeight)
  );
  const playing = media.find((el) => !el.paused && el.currentTime > 0);
  const target = playing || media[0];
  try {
    const next = target.currentTime + ${Number.isFinite(deltaSeconds) ? deltaSeconds : 0};
    const end = Number.isFinite(target.duration) ? target.duration : undefined;
    target.currentTime = Math.max(0, end === undefined ? next : Math.min(next, end));
    return 'moved';
  } catch (e) {
    // A server-controlled stream can refuse a seek, and says so by throwing.
    return 'none';
  }
})()`;
