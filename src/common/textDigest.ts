/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

/**
 * A short name for a long text, for keying a session-long map by content
 * without the map holding the content.
 *
 * The length and an FNV-1a hash of the UTF-16 code units, in base 36. Two
 * different texts share one only when they are the same length and their
 * hashes collide, which among the few thousand keys a session makes is too
 * rare to plan for — and nothing may use this where a collision would be
 * worse than a cache answering for the wrong entry.
 */
const textDigest = (text: string): string => {
  let hash = 0x811c9dc5;
  for (let index = 0; index < text.length; index += 1) {
    // eslint-disable-next-line no-bitwise -- FNV-1a is XOR and 32-bit multiplication by definition
    hash = Math.imul(hash ^ text.charCodeAt(index), 0x01000193);
  }
  // eslint-disable-next-line no-bitwise -- read the 32 bits back as unsigned
  return `${text.length.toString(36)}.${(hash >>> 0).toString(36)}`;
};

export default textDigest;
