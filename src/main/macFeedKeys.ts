/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

/**
 * The update feed keys a Mac copy trusts, and the only ones: the Mac's own.
 *
 * Made on the Mac that builds the Mac release (`pnpm mac-feed-key new`,
 * which writes its public half here); the private half never leaves that
 * Mac's login Keychain. It is apart from the Windows and Linux release key
 * (`UPDATE_FEED_KEYS`), which no Mac copy trusts and this does not change.
 */
const MAC_OWN_FEED_KEYS: Readonly<Record<string, string>> = {
  // mac-feed-key: new keys go above this line
};

export default MAC_OWN_FEED_KEYS;
