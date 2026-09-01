/* FluidEQ Karaoke Maker toolbar icons. GPL-3.0-or-later. */

const PATHS = {
  project: 'M12 15V4m0 0L8 8m4-4 4 4M5 14v4a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2v-4',
  lyrics: 'M6 3.5h8l4 4V20H6V3.5zM14 3.5v4h4M9 11h6M9 15h6',
  timing: 'M12 4a8 8 0 1 0 0 16 8 8 0 0 0 0-16zM12 7v5l3.5 2M4 12H2m20 0h-2',
  hand: 'M8 11V7a1.5 1.5 0 0 1 3 0v4-1.5M11 10V5.5a1.5 1.5 0 0 1 3 0V11m0-3.5a1.5 1.5 0 0 1 3 0V12m0-2a1.5 1.5 0 0 1 3 0v4c0 4-3 7-7 7h-1c-3 0-5-1.5-6.5-4L3 13.5a1.5 1.5 0 0 1 2.4-1.8L8 14',
  select: 'M4 8V4h4M16 4h4v4M20 16v4h-4M8 20H4v-4M8 9h8v6H8z',
  noteAdd:
    'M6 18V7l10-2v10M6 7l10-2M6 18a2.5 2 0 1 1-5 0 2.5 2 0 0 1 5 0zm10-3a2.5 2 0 1 1-5 0 2.5 2 0 0 1 5 0zM20 4v6m-3-3h6',
  split: 'M7 5v5m0 4v5M17 5v5m0 4v5M4 12h16M10 9l4 3-4 3',
  remove: 'M5 7h14M9 7V4h6v3M7 7l1 13h8l1-13M10 11v5M14 11v5',
  clearLyrics:
    'M6 3.5h8l4 4V20H6V3.5zM14 3.5v4h4M9 11h5M9 15h3M15.5 13.5l4 4m0-4-4 4',
  clearNotes:
    'M5 18V7l10-2v10M5 7l10-2M5 18a2.5 2 0 1 1-5 0 2.5 2 0 0 1 5 0zm10-3a2.5 2 0 1 1-5 0 2.5 2 0 0 1 5 0zM18 5l4 4m0-4-4 4',
  analyze: 'M3 13h3l2-6 3 11 3-13 3 8h4',
  align: 'M4 7h9M4 12h16M4 17h11M16 5l4 3-4 3',
  melody:
    'M12 4l1.6 4.4L18 10l-4.4 1.6L12 16l-1.6-4.4L6 10l4.4-1.6L12 4zM18 15l.8 2.2L21 18l-2.2.8L18 21l-.8-2.2L15 18l2.2-.8L18 15z',
  transcribe: 'M5 18L9 6h2l4 12M7 13h6M16 8h5M18.5 8v10',
  stem: 'M6 18V7l10-2v10M6 18a2.5 2 0 1 1-5 0 2.5 2 0 0 1 5 0zm10-3a2.5 2 0 1 1-5 0 2.5 2 0 0 1 5 0z',
  vocal:
    'M9 14a3 3 0 0 0 3-3V6a3 3 0 0 0-6 0v5a3 3 0 0 0 3 3zM4 11a5 5 0 0 0 9 3M9 16v4M6.5 20h5M17 6h4M17 10h4M17 14h4',
  edit: 'M5 17.5V20h2.5L18 9.5 14.5 6 4 16.5zM13 7.5l3.5 3.5',
  export: 'M12 4v11m0-11L8 8m4-4 4 4M5 14v4a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2v-4',
  preview:
    'M3 12s3.4-6 9-6 9 6 9 6-3.4 6-9 6-9-6-9-6zM12 9a3 3 0 1 0 0 6 3 3 0 0 0 0-6z',
  previewHide:
    'M4.2 8.1C3.4 9.1 3 10.2 3 12c0 0 3.4 6 9 6 1.5 0 2.8-.4 4-1M7.4 6.6A10 10 0 0 1 12 6c5.6 0 9 6 9 6a10 10 0 0 1-1.4 2.2M9.9 9.9A3 3 0 0 0 14.1 14M4 4l16 16',
  back: 'M19 12H5m0 0 6-6m-6 6 6 6',
  undo: 'M9 7H4v-5M4.5 7.5A8 8 0 1 1 5 17',
  // Undo's arrow exactly, around a clock face: the same gesture as Undo, but
  // going back to a point in time rather than by a step.
  restore: 'M9 7H4v-5M4.5 7.5A8 8 0 1 1 5 17M12 8v4.5l3 2',
  redo: 'M15 7h5v-5m-.5 5.5A8 8 0 1 0 19 17',
  apply: 'M5 12.5l4.2 4.2L19 7',
  fullscreen: 'M9 4H4v5m11-5h5v5M9 20H4v-5m11 5h5v-5',
  fullscreenExit:
    'M5 16h3v3h2v-5H5v2Zm3-8H5v2h5V5H8v3Zm6 11h2v-3h3v-2h-5v5Zm2-11V5h-2v5h5V8h-3Z',
  close: 'M6 6l12 12M18 6L6 18',
  previous: 'M15 5l-7 7 7 7',
  next: 'M9 5l7 7-7 7',
  copy: 'M8 8h11v11H8V8zM5 16H4V5h11v1',
  paste: 'M9 5h6M9 4v3h6V4M7 6H5v14h14V6h-2M10 11h4m-2-2v4',
  detach:
    'M9.5 14.5l-1 1a3 3 0 0 1-4.2-4.2l2.8-2.8a3 3 0 0 1 4.2 0M14.5 9.5l1-1a3 3 0 0 1 4.2 4.2l-2.8 2.8a3 3 0 0 1-4.2 0M9 15l6-6M4 4l16 16',
} as const;

export type TKaraokeMakerToolIcon = keyof typeof PATHS;

/**
 * Glyphs whose ink does not sit on the middle of the 24x24 grid, and the
 * shift that puts it there.
 *
 * Measured with `getBBox` in the running window, not judged by eye: `stem`
 * draws between x=1 and x=16, which is 3.5 units left of centre — about 2.5px
 * at the size the transport draws it — and `melody` is 1.5 the other way.
 * Inside a square toolbar button that reads as a wonky icon; inside the
 * round fader button beside a row of centred transport keys it is obvious.
 * Every other glyph here is within half a unit and is left alone.
 *
 * A transform rather than rewritten path data: these paths mix absolute and
 * relative commands, so shifting them by hand is a dozen chances to move one
 * coordinate and not its neighbour.
 */
const NUDGES: Partial<Record<TKaraokeMakerToolIcon, string>> = {
  melody: 'translate(-1.5 -0.5)',
  stem: 'translate(3.5 -0.5)',
};

interface IKaraokeMakerToolIconProps {
  name: TKaraokeMakerToolIcon;
}

const KaraokeMakerToolIcon = ({ name }: IKaraokeMakerToolIconProps) => (
  <svg
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="1.65"
    strokeLinecap="round"
    strokeLinejoin="round"
    aria-hidden="true"
    focusable="false"
  >
    <path
      d={PATHS[name]}
      transform={NUDGES[name]}
      fill={name === 'fullscreenExit' ? 'currentColor' : undefined}
      stroke={name === 'fullscreenExit' ? 'none' : undefined}
    />
  </svg>
);

export default KaraokeMakerToolIcon;
