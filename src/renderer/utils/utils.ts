/*
<AQUA: System-wide parametric audio equalizer interface>
Copyright (C) <2023>  <AQUA Dev Team>

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

import { IFilter } from 'common/constants';
import latestCall from 'common/latestCall';
import { RefObject, useEffect, useMemo, useRef, useState } from 'react';

export const getMaxIntegerDigitCount = (num: number) => {
  const absNum = Math.round(Math.abs(num));
  return absNum > 0 ? Math.floor(Math.log10(absNum)) + 1 : 1;
};

export const clamp = (num: number, min: number, max: number) => {
  return Math.min(Math.max(num, min), max);
};

export const sortHelper = (a: IFilter, b: IFilter) =>
  a.frequency - b.frequency ||
  a.gain - b.gain ||
  a.quality - b.quality ||
  a.type.localeCompare(b.type);

// https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Array/from#sequence_generator_range
export const range = (start: number, stop: number, step: number) =>
  Array.from({ length: (stop - start) / step + 1 }, (_, i) => start + i * step);

export const formatPresetName = (s: string) => {
  return s.replaceAll(/[^a-zA-Z0-9|_|\-()| ]+/g, '');
};

// *** CUSTOM HOOKS ***

/**
 * `latestCall` for a component: one call of `fn` in flight, the newest of the
 * rest waiting behind it, and the waiting one sent the moment the first
 * settles (see `common/latestCall.ts`).
 *
 * What replaced the throttle that guarded every write here. It wrote at most
 * once per `delay` and put the last call on a timer so it was not lost; a
 * write already says when it is done, and that is the moment the next one can
 * go. The function called is always the latest one rendered, so a caller need
 * not keep it stable.
 */
export const useLatestCall = <Args extends unknown[]>(
  fn: (...args: Args) => Promise<void> | void,
): ((...args: Args) => Promise<void>) => {
  const fnRef = useRef(fn);
  fnRef.current = fn;
  const [call] = useState(() =>
    latestCall<Args>((...args) => fnRef.current(...args)),
  );
  return call;
};

/**
 * "Outside" means outside every one of these, not outside the first.
 *
 * A widget that portals part of itself elsewhere — a menu rendered into
 * `document.body` so no ancestor can clip it — is one component in the React
 * tree and two subtrees in the DOM. These listeners are native and see only the
 * DOM, so the portalled half has to be named explicitly or clicking inside it
 * reads as a click outside the widget.
 */
const isInsideAny = (
  refs: RefObject<HTMLElement | null>[],
  target: EventTarget | null,
) => refs.some((ref) => ref.current && ref.current.contains(target as Node));

// https://github.com/teetotum/react-attached-properties/blob/master/examples/useClickOutside.js
export const useClickOutside = <T extends HTMLElement = HTMLElement>(
  ref: RefObject<T | null>,
  callback: () => void,
  ...alsoInside: RefObject<HTMLElement | null>[]
) => {
  const handleClick = useMemo(() => {
    return (e: globalThis.MouseEvent) => {
      if (!ref.current || isInsideAny([ref, ...alsoInside], e.target)) {
        return;
      }

      callback();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [callback, ref, ...alsoInside]);

  useEffect(() => {
    document.addEventListener('click', handleClick, true);

    return () => document.removeEventListener('click', handleClick, true);
  }, [handleClick]);
};

export const useMouseDownOutside = <T extends HTMLElement = HTMLElement>(
  ref: RefObject<T | null>,
  callback: () => void,
) => {
  const handleMouseDown = useMemo(() => {
    return (e: globalThis.MouseEvent) => {
      if (!ref.current || ref.current.contains(e.target as Node)) {
        return;
      }

      callback();
    };
  }, [callback, ref]);

  useEffect(() => {
    document.addEventListener('mousedown', handleMouseDown, true);

    return () =>
      document.removeEventListener('mousedown', handleMouseDown, true);
  }, [handleMouseDown]);
};

export const useFocusOutside = <T extends HTMLElement = HTMLElement>(
  ref: RefObject<T | null>,
  callback: () => void,
  ...alsoInside: RefObject<HTMLElement | null>[]
) => {
  const handleFocus = useMemo(() => {
    return (e: globalThis.FocusEvent) => {
      if (!ref.current || isInsideAny([ref, ...alsoInside], e.target)) {
        return;
      }

      callback();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [callback, ref, ...alsoInside]);

  useEffect(() => {
    document.addEventListener('focusin', handleFocus, true);

    return () => document.removeEventListener('focusin', handleFocus, true);
  }, [handleFocus]);
};

export const useIsFirstRender = () => {
  const isFirstRender = useRef(true);

  useEffect(() => {
    return () => {
      isFirstRender.current = true;
    };
  }, []);

  if (isFirstRender.current) {
    isFirstRender.current = false;
    return true;
  }
  return false;
};
