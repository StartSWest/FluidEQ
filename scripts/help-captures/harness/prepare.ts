/* Copyright (C) 2026 Ivan Carmenates Garcia. SPDX-License-Identifier: GPL-3.0-or-later */

import { PRODUCT_VERSION } from 'common/branding';
import { DISCLAIMER_ACCEPTED_KEY, buildAcceptance } from 'common/disclaimer';
import captureMusic from './music';

/**
 * The window as somebody who has used it would have it, written to storage
 * before the window reads any of it: the notice accepted and the tour seen,
 * so neither stands in front of a picture, the theme at the middle of the
 * Brightness slider, where every capture in the guide is taken — and then
 * the figure's own settings, which the capture script passes as JSON in the
 * page's `settings` query parameter.
 */

// The preload reads `process` while it has one, as Electron gives it; the
// window is Windows, as every capture in the guide is.
Object.assign(window, {
  process: { platform: 'win32', env: {}, versions: {}, arch: 'x64' },
});

// Windows' loopback capture, as Electron's handler gives it to the window:
// here, the harness's own two bars of music.
Object.defineProperty(navigator.mediaDevices, 'getDisplayMedia', {
  value: captureMusic,
});

// `useShellDialogs.ts`'s key, spelled out: importing that module here would
// evaluate the window's settings modules before storage holds anything.
const FEATURE_TOUR_DISMISSED_KEY = 'fluideq.featureTourDismissed';

const storage = window.localStorage;
storage.clear();
storage.setItem(
  DISCLAIMER_ACCEPTED_KEY,
  JSON.stringify(buildAcceptance(PRODUCT_VERSION, 'en')),
);
storage.setItem(FEATURE_TOUR_DISMISSED_KEY, PRODUCT_VERSION);
storage.setItem('fluideq.theme', '50');

const raw = new URLSearchParams(window.location.search).get('settings');
const settings: unknown = raw ? JSON.parse(raw) : undefined;
if (settings && typeof settings === 'object') {
  Object.entries(settings).forEach(([key, value]) => {
    storage.setItem(
      key,
      typeof value === 'string' ? value : JSON.stringify(value),
    );
  });
}
