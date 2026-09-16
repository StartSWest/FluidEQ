/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

/**
 * What FluidEQ calls itself to the account service.
 *
 * The sign-in service records the user agent of each signed-in computer on
 * that computer's session, and always has — the Plus terms say so. Until now
 * the app sent Node's own default, `node`, so every session claimed to be a
 * bare runtime and the admin's account list could not say which FluidEQ
 * anybody was running. This is the whole fix: one header, no new storage, no
 * report from the app about where it is.
 *
 * Kept here rather than read from Electron where it is sent, because
 * `authClient.ts` and `session.ts` are plain modules that unit tests import
 * directly: an `electron` import in either would take the account tests with
 * it. Main sets it once at startup instead.
 */

const FALLBACK = 'FluidEQ';

let agent = FALLBACK;

/** Only what a version number can hold; anything else is left out. */
const version = (value: string) =>
  /^[0-9]+(\.[0-9]+){0,3}([-+][0-9A-Za-z.-]{1,32})?$/.test(value)
    ? value
    : undefined;

/** Letters and digits: `win32`, `darwin`, `linux`, and nothing surprising. */
const platform = (value: string) =>
  /^[a-z0-9]{1,16}$/.test(value) ? value : undefined;

/**
 * Names this build to the account service — `FluidEQ/1.7.2 (win32)`. Called
 * once by main; every value is checked here because both end up in a header.
 */
export const setClientAgent = (appVersion: string, appPlatform: string) => {
  const name = version(appVersion);
  const where = platform(appPlatform);
  agent = name ? `${FALLBACK}/${name}${where ? ` (${where})` : ''}` : FALLBACK;
};

export const clientAgent = () => agent;
