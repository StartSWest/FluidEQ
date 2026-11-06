/* FluidEQ — GPL-3.0-or-later */

import { useLayoutEffect, useRef, useState } from 'react';

const STORAGE_KEY = 'fluideq.gaming.gamesLayout';
const MIN_WIDTH = 190;
const MAX_WIDTH = 420;
const MIN_HEIGHT = 140;
const DEFAULTS = { width: 270, height: 260, collapsed: false };
const clamp = (value: number, min: number, max: number) =>
  Math.max(min, Math.min(max, value));

const readLayout = (): typeof DEFAULTS => {
  try {
    const value: unknown = JSON.parse(
      localStorage.getItem(STORAGE_KEY) ?? 'null',
    );
    if (typeof value !== 'object' || value === null) {
      return DEFAULTS;
    }
    return {
      width:
        'width' in value &&
        typeof value.width === 'number' &&
        Number.isFinite(value.width)
          ? clamp(value.width, MIN_WIDTH, MAX_WIDTH)
          : DEFAULTS.width,
      height:
        'height' in value &&
        typeof value.height === 'number' &&
        Number.isFinite(value.height)
          ? clamp(value.height, MIN_HEIGHT, 640)
          : DEFAULTS.height,
      collapsed:
        'collapsed' in value && typeof value.collapsed === 'boolean'
          ? value.collapsed
          : DEFAULTS.collapsed,
    };
  } catch {
    // Missing or damaged optional preferences cannot prevent opening Games.
    return DEFAULTS;
  }
};

const remember = (layout: typeof DEFAULTS) => {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(layout));
  } catch {
    // A blocked storage still leaves resizing and folding usable this session.
  }
};

/** The list owns a bounded scrollport; adding games never lengthens the page. */
export default function useGamingGamesLayout() {
  const host = useRef<HTMLDivElement>(null);
  const [layout, setLayout] = useState(readLayout);
  const latest = useRef(layout);
  const [bounds, setBounds] = useState({ width: 0, height: 480 });
  const stacked = bounds.width > 0 && bounds.width <= 820;
  const maxWidth = Math.max(MIN_WIDTH, Math.min(MAX_WIDTH, bounds.width - 524));
  const width = clamp(layout.width, MIN_WIDTH, maxWidth);
  const height =
    stacked && !layout.collapsed
      ? clamp(layout.height, MIN_HEIGHT, bounds.height)
      : bounds.height;
  const drag = useRef({ key: 'width' as 'width' | 'height', start: width });

  useLayoutEffect(() => {
    const node = host.current;
    if (!node) {
      return undefined;
    }
    const scrollport = node.closest<HTMLElement>(
      '.workspace-tab-panel__scroll',
    );
    const measure = () => {
      const rect = node.getBoundingClientRect();
      // Content coordinates stay fixed while the page scrolls. Reading the
      // on-screen top alone would resize the list as the editor was scrolled.
      const top = scrollport
        ? rect.top -
          scrollport.getBoundingClientRect().top +
          scrollport.scrollTop
        : rect.top + window.scrollY;
      const available = (scrollport?.clientHeight ?? window.innerHeight) - top;
      const next = {
        width: rect.width,
        height: clamp(available - 8, MIN_HEIGHT, 640),
      };
      setBounds((previous) =>
        previous.width === next.width && previous.height === next.height
          ? previous
          : next,
      );
    };
    measure();
    const observer =
      typeof ResizeObserver === 'undefined'
        ? undefined
        : new ResizeObserver(measure);
    observer?.observe(node);
    if (scrollport) {
      observer?.observe(scrollport);
    }
    window.addEventListener('resize', measure);
    return () => {
      observer?.disconnect();
      window.removeEventListener('resize', measure);
    };
  }, []);

  const update = (next: typeof DEFAULTS) => {
    latest.current = next;
    setLayout(next);
  };
  const commit = () => remember(latest.current);

  return {
    host,
    width,
    height,
    stacked,
    collapsed: layout.collapsed,
    valuePercent: stacked
      ? ((height - MIN_HEIGHT) / Math.max(1, bounds.height - MIN_HEIGHT)) * 100
      : ((width - MIN_WIDTH) / Math.max(1, maxWidth - MIN_WIDTH)) * 100,
    start: () => {
      drag.current = {
        key: stacked ? 'height' : 'width',
        start: stacked ? height : width,
      };
    },
    resize: (delta: number) => {
      const { key, start } = drag.current;
      const size =
        key === 'width'
          ? clamp(start + delta, MIN_WIDTH, maxWidth)
          : clamp(start + delta, MIN_HEIGHT, bounds.height);
      update({ ...latest.current, [key]: size });
    },
    commit,
    reset: () => {
      update({ ...latest.current, width: DEFAULTS.width });
      commit();
    },
    toggle: () => {
      update({ ...latest.current, collapsed: !latest.current.collapsed });
      commit();
    },
  };
}
