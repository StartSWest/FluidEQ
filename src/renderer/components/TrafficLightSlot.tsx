/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

import { useLayoutEffect, useRef } from 'react';
import { TRAFFIC_LIGHTS_CHANNEL } from 'common/windowMode';
import runsOnMac from '../utils/platform';

/**
 * What was last sent, whichever slot sent it. One for the window, not one per
 * slot: the app's titlebar and the player's two strips each carry a slot, and
 * a slot that compared only against its own last word would stay silent on
 * coming back into view with the numbers it had sent before — while the
 * buttons stood where another strip had put them.
 */
let placed = '';

/**
 * Where a Mac draws the window's traffic lights, and the room they take.
 *
 * The first thing in the strip it stands in, stretched to the strip's height:
 * its left edge is where the first button goes and its middle is the line
 * the three are centred on, which it tells main in CSS pixels
 * (`macWindowChrome.ts`). Its width is the system's own measure of the
 * buttons — `titlebar-area-x`, the buttons with their margin on both sides —
 * less that margin twice, so what follows it starts one strip gap after the
 * green button on every release of macOS. The margin is this slot's own left
 * edge, which is what it asked for.
 *
 * Measured again whenever its box changes (a shorter window's smaller bar,
 * the player folding), told again when the numbers or the device pixel
 * ratio moved; and told whatever the numbers whenever the viewport changes
 * (which is also what a change of zoom looks like from here) or the window
 * has finished changing state, which is when macOS puts the buttons back at
 * its own default. A slot whose strip is not on screen measures nothing and
 * says nothing, so the strip that is on screen is the one the buttons stand
 * in.
 *
 * Nothing at all on Windows and Linux, which draw their own buttons.
 */
const TrafficLightSlot = () => {
  const slotRef = useRef<HTMLSpanElement>(null);
  const isMac = runsOnMac();

  useLayoutEffect(() => {
    const slot = slotRef.current;
    if (!isMac || !slot) {
      return undefined;
    }
    const report = () => {
      const box = slot.getBoundingClientRect();
      if (box.height === 0) {
        return;
      }
      slot.style.setProperty('--traffic-lights-x', `${box.left}px`);
      const strip = slot.closest('[data-window-strip]') ?? slot;
      const band = [
        box.left,
        box.top + box.height / 2,
        strip.getBoundingClientRect().bottom,
      ];
      const said = `${band.join(',')}@${window.devicePixelRatio}`;
      if (said === placed) {
        return;
      }
      placed = said;
      window.electron.ipcRenderer.sendMessage(TRAFFIC_LIGHTS_CHANNEL, band);
    };
    /**
     * Said again, unchanged, whenever the window has been laid out anew.
     *
     * macOS 26 lays its title bar out again after Electron has put the
     * buttons where they were asked to go — at the end of a zoom, and as the
     * window changes between the app and the player — and the buttons fall
     * back to its own default at the top of the window. Nothing in the page
     * moved, so nothing said the position again, and they stayed there
     * (2026-10-01, a maximised window: the buttons at the top, and back in
     * the middle of the strip the moment the same numbers were sent again).
     *
     * That layout is the window's, title bar and content together, so the
     * viewport's own `resize` follows it and a position said from there
     * reaches main after it; the push for a maximise, a restore, full screen
     * or a switch says it too, for a change that ends without one. During a
     * drag that is a message a frame, as Electron's own redraw on every
     * resize already is.
     *
     * What was said is forgotten rather than this slot made to speak, so a
     * slot that cannot be measured at that moment — the titlebar not drawn
     * yet — says it at the next measurement that finds it on screen.
     */
    const reportAgain = () => {
      placed = '';
      report();
    };
    report();
    const observer = new ResizeObserver(report);
    observer.observe(slot);
    window.addEventListener('resize', reportAgain);
    const stopListening = window.electron.ipcRenderer.on(
      'window-state-changed',
      reportAgain,
    );
    return () => {
      observer.disconnect();
      window.removeEventListener('resize', reportAgain);
      stopListening();
    };
  }, [isMac]);

  if (!isMac) {
    return null;
  }
  return <span ref={slotRef} className="traffic-light-slot" aria-hidden />;
};

export default TrafficLightSlot;
