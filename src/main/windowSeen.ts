/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

/**
 * Whether anybody can see the window: shown, and not minimised to the
 * taskbar. Told once at the start and then on every change, never twice in a
 * row the same.
 *
 * Gone to the tray and minimised are two different events for the same
 * thing, and only one of them fires, so both are heard. Each says "not seen"
 * outright rather than asking the window: what `isMinimized` answers in the
 * middle of its own event is the platform's business. A switch between the
 * full app and the amp hides nothing — the window is cloaked or faded for it,
 * never hidden — so it never reads as the window going away.
 */
type TWindowSeenEvent = 'show' | 'hide' | 'minimize' | 'restore' | 'closed';

/** The part of a `BrowserWindow` this needs; a test passes an emitter. */
export interface IWindowSeenSource {
  on(event: TWindowSeenEvent, listener: () => void): unknown;
  isVisible(): boolean;
  isMinimized(): boolean;
  isDestroyed(): boolean;
}

const watchWindowSeen = (
  window: IWindowSeenSource,
  tell: (isSeen: boolean) => void,
): void => {
  let told: boolean | undefined;
  const say = (isSeen: boolean) => {
    if (isSeen !== told) {
      told = isSeen;
      tell(isSeen);
    }
  };
  const ask = () =>
    say(!window.isDestroyed() && window.isVisible() && !window.isMinimized());
  window.on('show', ask);
  window.on('restore', ask);
  window.on('hide', () => say(false));
  window.on('minimize', () => say(false));
  window.on('closed', () => say(false));
  ask();
};

export default watchWindowSeen;
