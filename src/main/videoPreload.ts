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
 * The ad blocker, running inside the player.
 *
 * This is ClearTube — the Chrome extension in `_GIGABYTZ/youtube-add-blocker` —
 * ported to a preload. The detection and the stylesheet are carried over
 * unchanged, including the `cleartube` attribute names, so that when YouTube
 * next moves its markup a fix can be copied straight across in either
 * direction. What is gone is the extension shell: `chrome.storage` became one
 * boolean over IPC, and the badge counter became nothing.
 *
 * It is a preload rather than a loaded extension on purpose. Electron's
 * MV3 support is partial — service workers and `chrome.storage` in particular —
 * so shipping the .crx would mean depending on the least finished corner of
 * Electron for a feature that is 200 lines of DOM work. A preload also runs
 * before the page's first script, which is what a content script at
 * `document_start` buys and what stops an ad slot appearing and then vanishing.
 *
 * The page cannot reach any of this. The preload runs in its own world with
 * context isolation on, and nothing here is exposed through `contextBridge`.
 */

import { ipcRenderer, webFrame } from 'electron';
import {
  VIDEO_AD_BLOCK_CHANGED,
  VIDEO_AD_BLOCK_DEFAULT,
  VIDEO_AD_BLOCK_REQUEST,
} from '../common/videoAdBlock';
import { VIDEO_GRAPH_FULLSCREEN_REQUEST } from '../common/videoSites';

/**
 * ClearTube's `content.css`, verbatim.
 *
 * Inlined as a string because `webFrame.insertCSS` wants one and because the
 * preload bundle has no stylesheet loader — a separate .css file would mean
 * teaching webpack about a second asset pipeline to move sixty lines.
 */
const AD_BLOCK_CSS = `
html[data-cleartube-hide-page-ads="true"] #masthead-ad,
html[data-cleartube-hide-page-ads="true"] #player-ads,
html[data-cleartube-hide-page-ads="true"] ytd-ad-slot-renderer,
html[data-cleartube-hide-page-ads="true"] ytd-action-companion-ad-renderer,
html[data-cleartube-hide-page-ads="true"] ytd-banner-promo-renderer,
html[data-cleartube-hide-page-ads="true"] ytd-companion-slot-renderer,
html[data-cleartube-hide-page-ads="true"] ytd-display-ad-renderer,
html[data-cleartube-hide-page-ads="true"] ytd-in-feed-ad-layout-renderer,
html[data-cleartube-hide-page-ads="true"] ytd-player-legacy-desktop-watch-ads-renderer,
html[data-cleartube-hide-page-ads="true"] ytd-brand-video-shelf-renderer,
html[data-cleartube-hide-page-ads="true"] ytd-compact-promoted-video-renderer,
html[data-cleartube-hide-page-ads="true"] ytd-promoted-sparkles-text-search-renderer,
html[data-cleartube-hide-page-ads="true"] ytd-promoted-sparkles-web-renderer,
html[data-cleartube-hide-page-ads="true"] ytd-promoted-video-renderer,
html[data-cleartube-hide-page-ads="true"] ytd-search-pyv-renderer,
html[data-cleartube-hide-page-ads="true"] ytd-video-masthead-ad-advertiser-info-renderer,
html[data-cleartube-hide-page-ads="true"] ytd-video-masthead-ad-primary-video-renderer,
html[data-cleartube-hide-page-ads="true"] ytd-video-masthead-ad-v3-renderer,
html[data-cleartube-hide-page-ads="true"] ytd-rich-item-renderer:has(ytd-ad-slot-renderer),
html[data-cleartube-hide-page-ads="true"] ytd-reel-item-renderer:has(ytd-ad-slot-renderer),
html[data-cleartube-hide-page-ads="true"] ytm-companion-ad-renderer,
html[data-cleartube-hide-page-ads="true"] ytmusic-mealbar-promo-renderer,
html[data-cleartube-hide-page-ads="true"] ytmusic-player-page #player-ads {
  display: none !important;
  visibility: hidden !important;
}

html[data-cleartube-block-video-ads="true"] .ytp-ad-image-overlay,
html[data-cleartube-block-video-ads="true"] .ytp-ad-player-overlay,
html[data-cleartube-block-video-ads="true"] .ytp-ad-survey,
html[data-cleartube-block-video-ads="true"] .ytp-ad-text-overlay,
html[data-cleartube-block-video-ads="true"] .ytp-ad-overlay-container {
  display: none !important;
}

html[data-cleartube-block-video-ads="true"]
  .html5-video-player[data-cleartube-ad-active="true"]
  .video-ads,
html[data-cleartube-block-video-ads="true"]
  .html5-video-player[data-cleartube-ad-active="true"]
  .ytp-ad-module,
html[data-cleartube-block-video-ads="true"]
  .html5-video-player[data-cleartube-ad-active="true"]
  .html5-main-video {
  visibility: hidden !important;
}

html[data-cleartube-block-video-ads="true"]
  .html5-video-player[data-cleartube-ad-active="true"]
  .html5-video-container::after {
  position: absolute;
  z-index: 2;
  inset: 0;
  content: "";
  pointer-events: none;
  background-color: #050505;
}

html[data-cleartube-block-video-ads="true"]
  .html5-video-player[data-cleartube-ad-active="true"]
  .ytp-cued-thumbnail-overlay {
  z-index: 3 !important;
  display: block !important;
  visibility: visible !important;
  opacity: 1 !important;
}

html[data-cleartube-block-video-ads="true"] tp-yt-paper-dialog:has(ytd-enforcement-message-view-model),
html[data-cleartube-block-video-ads="true"] ytd-popup-container:has(ytd-enforcement-message-view-model) {
  display: none !important;
}
`;

/**
 * Apple paints dark form text but leaves the page canvas transparent in this
 * embedded Chromium path. A normal browser supplies a white canvas; FluidEQ's
 * transparent webview instead showed the app's navy surface through it and
 * made the form nearly unreadable. This runs in the preload for both the player
 * and its sign-in popup, before first paint, and is deliberately scoped to the
 * one document that needs the browser-like fallback.
 */
const APPLE_AUTH_BACKGROUND_CSS = `
html,
body {
  background-color: #ffffff !important;
}
`;

const SKIP_BUTTON_SELECTORS = [
  '.ytp-ad-skip-button',
  '.ytp-ad-skip-button-modern',
  '.ytp-skip-ad-button',
  '.ytp-ad-skip-button-container button',
  '.ytp-ad-skip-button-slot button',
  "button[class*='ytp-ad-skip']",
  "[class*='ytp-ad-skip-button'] button",
];

const PLAYER_SELECTOR = '#movie_player, .html5-video-player';

/**
 * Turn a double-click on the moving picture into FluidEQ graph fullscreen.
 *
 * Registered in capture from the preload's isolated world, before the page's
 * player handlers. Stopping it here is what prevents YouTube from entering its
 * own HTML fullscreen underneath the graph and creating two competing modes.
 * Coordinates are used as well as ancestry because most players put a controls
 * or gesture overlay in front of the `<video>` rather than making the video the
 * event target.
 */
const handleVideoDoubleClick = (event: MouseEvent) => {
  const target = event.target instanceof Element ? event.target : null;
  if (
    target?.closest(
      'button, input, select, textarea, a, [contenteditable], [role="button"]',
    )
  ) {
    return;
  }

  const hitsVideo = Array.from(document.querySelectorAll('video')).some(
    (video) => {
      const rect = video.getBoundingClientRect();
      return (
        rect.width > 0 &&
        rect.height > 0 &&
        event.clientX >= rect.left &&
        event.clientX <= rect.right &&
        event.clientY >= rect.top &&
        event.clientY <= rect.bottom
      );
    },
  );
  if (!hitsVideo) {
    return;
  }

  event.preventDefault();
  event.stopImmediatePropagation();
  ipcRenderer.sendToHost(VIDEO_GRAPH_FULLSCREEN_REQUEST);
};

window.addEventListener('dblclick', handleVideoDoubleClick, true);

/** How often to sweep the page, in milliseconds. ClearTube's own cadence. */
const SWEEP_INTERVAL_MS = 350;

interface IAdSession {
  player: HTMLElement | null;
  video: HTMLVideoElement;
  /** What the user had set, to be put back when the ad ends. */
  muted: boolean;
  playbackRate: number;
  forcedMute: boolean;
  forcedRate: boolean;
}

let isEnabled = VIDEO_AD_BLOCK_DEFAULT;
let scheduled = false;
let adSession: IAdSession | null = null;
const handledEnforcementDialogs = new WeakSet<Element>();

const isVisible = (element: Element | null): element is HTMLElement => {
  if (!element || !element.isConnected) {
    return false;
  }

  const style = getComputedStyle(element);
  return (
    style.display !== 'none' &&
    style.visibility !== 'hidden' &&
    Number.parseFloat(style.opacity || '1') > 0 &&
    element.getClientRects().length > 0
  );
};

/**
 * Put the two flags the stylesheet reads onto `<html>`.
 *
 * Everything visual is driven from these rather than from inline styles, which
 * is what lets the whole blocker be switched off by flipping two attributes —
 * no un-hiding pass, nothing to get out of step.
 */
const applySettings = () => {
  const root = document.documentElement;
  if (!root) {
    return;
  }

  root.dataset.cleartubeHidePageAds = String(isEnabled);
  root.dataset.cleartubeBlockVideoAds = String(isEnabled);
};

const playerIsShowingAd = (player: Element): boolean => {
  if (
    player.classList.contains('ad-showing') ||
    player.classList.contains('ad-interrupting')
  ) {
    return true;
  }

  const hasVisibleSkipButton = SKIP_BUTTON_SELECTORS.some((selector) =>
    isVisible(player.querySelector(selector)),
  );

  return (
    hasVisibleSkipButton ||
    isVisible(player.querySelector('.ytp-ad-preview-container'))
  );
};

const clickSkipButton = (player: Element): boolean =>
  SKIP_BUTTON_SELECTORS.some((selector) => {
    const button = player.querySelector(selector);
    if (isVisible(button) && !(button as HTMLButtonElement).disabled) {
      (button as HTMLElement).click();
      return true;
    }
    return false;
  });

/**
 * Hand back whatever was borrowed for the ad.
 *
 * The mute and the playback rate are only restored if this code was the one
 * that changed them, and only if they still hold the value it set. Somebody who
 * hit mute themselves during an ad means it, and stamping the old value back
 * over that would be the blocker un-muting a video against them.
 *
 * `force` drops that second condition, and is used when the switch has been
 * turned off. Being asked to stop is not the same as an ad ending: whatever
 * this code did to the page has to come off it, and a video left silent or at
 * sixteen times speed by a blocker that is no longer running is exactly the
 * sort of thing that looks like it is still running.
 */
const finishAdSession = (force = false) => {
  if (!adSession) {
    return;
  }

  const { player, video, muted, playbackRate, forcedRate, forcedMute } =
    adSession;

  if (video.isConnected) {
    if (forcedRate && (force || video.playbackRate >= 15)) {
      video.playbackRate = playbackRate;
    }

    if (forcedMute && (force || video.muted)) {
      video.muted = muted;
    }
  }

  if (player?.isConnected) {
    delete player.dataset.cleartubeAdActive;
  }

  adSession = null;
};

const beginAdSession = (video: HTMLVideoElement): IAdSession => {
  if (adSession?.video === video) {
    return adSession;
  }

  finishAdSession();

  const player = video.closest<HTMLElement>(PLAYER_SELECTOR);
  adSession = {
    player,
    video,
    muted: video.muted,
    playbackRate: video.playbackRate,
    forcedMute: false,
    forcedRate: false,
  };

  // What the stylesheet keys the black cover off. The ad is still playing
  // underneath it — this hides the picture, and the mute below hides the sound.
  if (player) {
    player.dataset.cleartubeAdActive = 'true';
  }

  return adSession;
};

const seekToAdEnd = (video: HTMLVideoElement) => {
  const { duration } = video;
  let seekTarget = Number.isFinite(duration) && duration > 0 ? duration : 0;
  if (video.seekable.length > 0) {
    seekTarget = Math.max(
      seekTarget,
      video.seekable.end(video.seekable.length - 1),
    );
  }

  if (!Number.isFinite(seekTarget) || seekTarget <= 0) {
    return;
  }

  try {
    if (typeof video.fastSeek === 'function') {
      video.fastSeek(seekTarget);
    }
    video.currentTime = seekTarget;
  } catch {
    // Server-controlled streams can reject seeking; acceleration continues.
  }
};

/**
 * Get past one ad.
 *
 * Four escalating moves, because no single one works on every ad: press skip
 * if there is a skip button, and otherwise mute it, run it at sixteen times
 * speed and try to seek to its end. An unskippable ad still has to play, but it
 * plays silent, black and in about a second.
 */
const bypassVideoAd = (player: Element, video: HTMLVideoElement) => {
  const session = beginAdSession(video);
  clickSkipButton(player);

  if (!playerIsShowingAd(player)) {
    finishAdSession();
    return;
  }

  if (!video.muted) {
    video.muted = true;
    session.forcedMute = true;
  }

  if (video.playbackRate < 15) {
    video.playbackRate = 16;
    session.forcedRate = true;
  }

  seekToAdEnd(video);
};

/**
 * Dismiss the "ad blockers are not allowed" dialog.
 *
 * Handled once per dialog element — it is re-created rather than reopened, and
 * a WeakSet keyed on the element means a dialog the user dismissed themselves
 * is not fought over, and nothing is retained after the page drops it.
 */
const clearInterruptionOverlay = () => {
  const enforcement = document.querySelector(
    'ytd-enforcement-message-view-model',
  );
  if (
    !enforcement ||
    !enforcement.isConnected ||
    handledEnforcementDialogs.has(enforcement)
  ) {
    return;
  }

  handledEnforcementDialogs.add(enforcement);

  const dialog = enforcement.closest('tp-yt-paper-dialog');
  if (dialog) {
    dialog.removeAttribute('opened');
    dialog.setAttribute('aria-hidden', 'true');
  }

  // The dialog locks the page behind it; both attributes have to come off or
  // the page stays frozen after it is hidden.
  document.documentElement.removeAttribute('scrolling');
  document.body?.removeAttribute('scrolling');

  const video = document.querySelector('video');
  if (video?.paused) {
    video.play().catch(() => {
      // Chromium can require a user gesture before resuming playback.
    });
  }
};

const processPage = () => {
  scheduled = false;
  applySettings();

  if (!isEnabled) {
    // Everything visual is off already — `applySettings` above cleared the two
    // attributes the stylesheet keys on, and every rule in it is gated behind
    // them. This is the rest: the sound and the speed, which are properties of
    // the video element rather than of the page, and which no attribute undoes.
    finishAdSession(true);
    return;
  }

  const player = document.querySelector(PLAYER_SELECTOR);
  const video = player?.querySelector('video');

  if (player && video && playerIsShowingAd(player)) {
    bypassVideoAd(player, video);
  } else {
    finishAdSession();
  }

  clearInterruptionOverlay();
};

/**
 * Coalesce a burst of mutations into one pass.
 *
 * YouTube's player rewrites a great deal of DOM per second, and running the
 * sweep on every record was enough work to be visible in a frame budget that
 * also has a spectrum analyser in it.
 */
const scheduleProcess = () => {
  if (scheduled) {
    return;
  }

  scheduled = true;
  requestAnimationFrame(processPage);
};

const start = async () => {
  try {
    isEnabled = Boolean(await ipcRenderer.invoke(VIDEO_AD_BLOCK_REQUEST));
  } catch {
    // No answer means the app is mid-teardown. The default is the safe one.
  }

  applySettings();

  const observer = new MutationObserver(scheduleProcess);
  observer.observe(document.documentElement, {
    attributes: true,
    attributeFilter: ['class'],
    childList: true,
    subtree: true,
  });

  // Belt as well as braces: an ad can begin without mutating anything this
  // observer watches, and a fixed sweep catches those.
  setInterval(processPage, SWEEP_INTERVAL_MS);
  processPage();
};

ipcRenderer.on(VIDEO_AD_BLOCK_CHANGED, (_event, enabled: boolean) => {
  isEnabled = Boolean(enabled);
  processPage();
});

// The stylesheet goes in now, before the page has run a line of its own script.
// This is the half that has to be early: the sweep below can afford to arrive
// late, but CSS that lands after first paint is a visible flash of the ad slot
// it was supposed to hide.
webFrame.insertCSS(AD_BLOCK_CSS);

if (window.location.hostname.toLowerCase() === 'appleid.apple.com') {
  webFrame.insertCSS(APPLE_AUTH_BACKGROUND_CSS);
}

if (document.documentElement) {
  start();
} else {
  document.addEventListener('DOMContentLoaded', start, { once: true });
}
