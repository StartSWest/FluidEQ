/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

import { createElement, lazy, useState, type ComponentType } from 'react';

/** A page whose code is its own chunk, fetched on the first need of it. */
export interface ILazyPage<P extends object> {
  /** The page. Suspends only when drawn before its code has arrived. */
  Page: ComponentType<P>;
  /** Fetches the code; resolves once the page can be drawn without waiting. */
  preload: () => Promise<void>;
  /** Whether drawing the page now would draw it, rather than wait for it. */
  isLoaded: () => boolean;
}

/**
 * `React.lazy`, plus the two things the shell needs from it: fetching a page's
 * code before it is shown, and knowing whether that has happened.
 *
 * The shell switches tabs only once the new page's code is here
 * (`workspacePages.ts`), so the previous page stays on screen until the new
 * one can be drawn whole; nothing blank is ever shown between them. A page
 * mounted after its code arrived is drawn by the component itself, with no
 * Suspense in the way, which is what lets the first frame of a launch already
 * hold the page it opens on.
 */
export default function lazyPage<P extends object>(
  load: () => Promise<{ default: ComponentType<P> }>,
): ILazyPage<P> {
  let loaded: ComponentType<P> | undefined;
  let pending: Promise<{ default: ComponentType<P> }> | undefined;
  const fetchCode = () => {
    pending ??= load().then(
      (module) => {
        loaded = module.default;
        return module;
      },
      (error: unknown) => {
        // Forgotten, so the next hover or press asks again rather than
        // inheriting a failure that may have been a moment's.
        pending = undefined;
        throw error;
      },
    );
    return pending;
  };
  const Waiting = lazy(fetchCode);
  const Page = (props: P) => {
    // Chosen once for the life of this mount. Swapping from the waiting
    // wrapper to the loaded component would be a different element type, and
    // React would throw the page away and build it again with its state lost.
    const [Component] = useState<ComponentType<P>>(() => loaded ?? Waiting);
    return createElement(Component, props);
  };
  return {
    Page,
    preload: () => fetchCode().then(() => undefined),
    isLoaded: () => loaded !== undefined,
  };
}
