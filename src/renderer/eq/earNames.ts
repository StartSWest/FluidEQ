import type { TBandChannel, TBandSide } from 'common/constants';

/**
 * How each ear is named on screen: a letter where a band's side has to fit
 * beside a handle or in a band's corner, and a word everywhere it can be read.
 * One table, so the graph, the bands and the menus never spell an ear apart.
 */

export const EAR_LETTER_KEYS = {
  left: 'eq.channels.letter.left',
  right: 'eq.channels.letter.right',
} as const satisfies Record<TBandChannel, string>;

export const EAR_NAME_KEYS = {
  left: 'graph.curve.leftEar',
  right: 'graph.curve.rightEar',
} as const satisfies Record<TBandChannel, string>;

/** The band menu's three lines: "Both ears", "Left ear only", "Right ear only". */
export const SIDE_MENU_KEYS = {
  both: 'eq.channels.both',
  left: 'eq.channels.left',
  right: 'eq.channels.right',
} as const satisfies Record<TBandSide, string>;
