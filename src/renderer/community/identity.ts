import type { CSSProperties } from 'react';

/**
 * One colour per person, everywhere they appear.
 *
 * A chat in which every avatar is the same teal disc is a chat in which nobody
 * can tell who said what without reading every name. The handle is hashed to
 * a hue, and the hue rides on the element as a custom property so the
 * stylesheet can build the avatar, the name and the podium ring from one
 * number with no colour ever written down in TSX.
 *
 * A small polynomial hash over the code units: cheap, stable across sessions
 * and machines, and spread evenly enough that two people rarely share a
 * shade. The hue is stepped in twelfths so neighbouring handles land visibly
 * apart rather than two degrees from each other.
 */
export const hueOf = (handle: string): number => {
  // Plain arithmetic rather than the usual xor-and-shift, kept exact by
  // reducing modulo a prime each step: the hash only has to spread handles
  // across the wheel, not be FNV byte for byte.
  let hash = 7;
  for (let i = 0; i < handle.length; i += 1) {
    hash = (hash * 131 + handle.charCodeAt(i)) % 1000003;
  }
  return (hash % 12) * 30 + (Math.floor(hash / 12) % 20);
};

/** `style={identityStyle(handle)}` on anything that wears the person's colour. */
export const identityStyle = (handle: string): CSSProperties =>
  ({ '--identity-hue': `${hueOf(handle)}deg` }) as CSSProperties;
