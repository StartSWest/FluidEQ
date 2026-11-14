/**
 * The window tells main whether a reading page (the Forum) has the keyboard,
 * as `[true]` or `[false]` on this channel.
 *
 * Main reads Ctrl and +, − and 0 before the page does, to zoom the whole
 * window, and swallows them. While a reading page has focus those keys size
 * its text instead (`forumTextSize.ts`), so main lets them through to it;
 * everywhere else they zoom the window exactly as before.
 */
export const READING_ZOOM_KEYS_CHANNEL = 'reading-zoom-keys';

/** The key that zooms in, out or back, as main and the page both read it. */
export type TZoomKey = 'in' | 'out' | 'reset';

/**
 * Which zoom key a keystroke is, if any. The plus key is unshifted `=` on
 * most layouts and `+` on the numpad or with Shift, so all three mean in;
 * matching `code` too covers layouts where the character is elsewhere. Alt
 * excluded: AltGr reports Control on some layouts, and it is how a European
 * keyboard types these characters.
 */
export const zoomKeyOf = (input: {
  key: string;
  code: string;
  control: boolean;
  alt: boolean;
}): TZoomKey | undefined => {
  if (!input.control || input.alt) {
    return undefined;
  }
  if (input.key === '+' || input.key === '=' || input.code === 'NumpadAdd') {
    return 'in';
  }
  if (
    input.key === '-' ||
    input.key === '_' ||
    input.code === 'NumpadSubtract'
  ) {
    return 'out';
  }
  if (input.key === '0' || input.code === 'Numpad0') {
    return 'reset';
  }
  return undefined;
};
