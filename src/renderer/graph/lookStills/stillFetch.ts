/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

import { useSyncExternalStore } from 'react';

/**
 * The shipped stills' pictures (`ShippedLookStill`), fetched ahead of the
 * picker and held, apart from the list of them so the stills' generator can
 * lay a still on a plate without the list it is writing.
 */

/** Pictures asked for already, held so the browser keeps their bytes. */
const fetched = new Map<string, HTMLImageElement>();

const fetchOne = (url: string): HTMLImageElement => {
  const known = fetched.get(url);
  if (known) {
    return known;
  }
  const image = new Image();
  image.src = url;
  fetched.set(url, image);
  return image;
};

/**
 * Has the browser fetch each still before the picker opens, so the picker's
 * first frame finds every one in memory and paints it then. The bytes are
 * held, not the decoded pixels: a still is decoded as it is painted, a few
 * hundred kilobytes for a grid. Bounded by the shipped files themselves.
 */
export const fetchShippedStills = (files: readonly { url: string }[]) => {
  files.forEach(({ url }) => fetchOne(url));
};

const isFetched = (url: string): boolean => {
  const image = fetched.get(url);
  return image !== undefined && image.complete && image.naturalWidth > 0;
};

/**
 * Whether a still's picture is in memory: its layers are laid only then. A
 * colour layer whose mask has not arrived would be a plate of solid colour
 * until it did; fetched while the picker was shut (`fetchShippedStills`),
 * it is in already, and this answers yes on the first frame.
 */
export const useShippedStillReady = (url: string): boolean =>
  useSyncExternalStore(
    (listener) => {
      const image = fetchOne(url);
      image.addEventListener('load', listener);
      image.addEventListener('error', listener);
      return () => {
        image.removeEventListener('load', listener);
        image.removeEventListener('error', listener);
      };
    },
    () => isFetched(url),
    () => false,
  );
