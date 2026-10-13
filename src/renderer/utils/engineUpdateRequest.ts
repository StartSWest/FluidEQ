/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

/**
 * Ask the shell for the engine update card, from anywhere in the window.
 *
 * The card is offered by itself once a launch (`useEngineUpdate`), and "Not
 * now" holds until the app next starts; after that, a band menu saying a
 * one-ear band plays on both ears until the engine is updated had nothing
 * to press (Ivan, 2026-10-13: "is not asking for installing the update").
 * The shell owns the update and its lock, so the ask travels as an event,
 * as the band menu's own request does, and the card it opens is the same
 * one with its own Update button and Windows prompt.
 */

export const ENGINE_UPDATE_REQUEST_EVENT = 'fluideq-engine-update-request';

export const requestEngineUpdate = (): void => {
  window.dispatchEvent(new CustomEvent(ENGINE_UPDATE_REQUEST_EVENT));
};
