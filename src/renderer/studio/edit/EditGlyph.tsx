/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

import Glyph, { type TCommunityGlyph } from '../../community/Glyph';

export type TEditGlyph =
  | 'ask'
  | 'solo'
  | 'lock'
  | 'unlock'
  | 'eye'
  | 'eye-off'
  | 'copy'
  | 'group'
  | 'rename'
  | 'parent'
  | 'delete'
  | 'add'
  | 'save'
  | 'discard'
  | 'view-top'
  | 'view-front'
  | 'view-side'
  | 'keep-view';

/** Edit mode's actions that already have the window's own picture. */
const SHARED: Partial<Record<TEditGlyph, TCommunityGlyph>> = {
  lock: 'lock',
  copy: 'copy',
  delete: 'delete',
  save: 'check',
  'keep-view': 'camera',
};

/** The face of the views' cube that each one is seen from. */
const CUBE_FACES = {
  'view-top': 'M10 3l6.5 3.5L10 10 3.5 6.5Z',
  'view-front': 'M3.5 6.5 10 10v7l-6.5-3.5Z',
  'view-side': 'M16.5 6.5 10 10v7l6.5-3.5Z',
} as const;

/**
 * Edit mode's pictures, one per thing its panels let the member do. Drawn on
 * the app's own 20-unit grid, stroked in `currentColor` at the app's weight
 * (`community/Glyph.tsx`), whose pictures it uses where one already says the
 * thing — the lock, the copy, the bin, the tick and the camera — so the same
 * action looks the same everywhere in the window.
 */
export default function EditGlyph({
  name,
  className,
}: {
  name: TEditGlyph;
  className?: string;
}) {
  const shared = SHARED[name];
  if (shared) {
    return <Glyph name={shared} className={className} />;
  }
  const art = (() => {
    switch (name) {
      case 'ask':
        // A speech bubble and the spark of the AI answering it.
        return (
          <>
            <path d="M3.5 5.5h7a2 2 0 0 1 2 2v4a2 2 0 0 1-2 2H7.3l-2.8 2.3v-2.3h-1a2 2 0 0 1-2-2v-4a2 2 0 0 1 2-2Z" />
            <path d="M15.2 2.2q.4 2.4 2.6 2.8-2.2.4-2.6 2.8-.4-2.4-2.6-2.8 2.2-.4 2.6-2.8Z" />
          </>
        );
      case 'solo':
        // One thing lit in its ring, the rest left dim round it: shown alone.
        // A spotlight drawn from above read as a flask at 15 pixels.
        return (
          <>
            <circle cx="10" cy="10" r="2.6" fill="currentColor" />
            <circle cx="10" cy="10" r="5.6" />
            <g fill="currentColor" stroke="none" opacity="0.4">
              <circle cx="3" cy="3" r="1.3" />
              <circle cx="17" cy="3" r="1.3" />
              <circle cx="3" cy="17" r="1.3" />
              <circle cx="17" cy="17" r="1.3" />
            </g>
          </>
        );
      case 'unlock':
        // The lock with its shackle swung open: free to move.
        return (
          <>
            <path d="M6.5 9V6.5a3.5 3.5 0 0 1 6.8-1.2" />
            <rect x="4.5" y="9" width="11" height="8" rx="1.8" />
          </>
        );
      case 'eye':
        return (
          <>
            <path d="M2 10s3-5.4 8-5.4 8 5.4 8 5.4-3 5.4-8 5.4S2 10 2 10Z" />
            <circle cx="10" cy="10" r="2.4" />
          </>
        );
      case 'eye-off':
        return (
          <>
            <path d="M2 10s3-5.4 8-5.4 8 5.4 8 5.4-3 5.4-8 5.4S2 10 2 10Z" />
            <circle cx="10" cy="10" r="2.4" />
            <path d="M3.5 16.5l13-13" />
          </>
        );
      case 'group':
        // Two things inside one dashed frame: gathered as one.
        return (
          <>
            <rect
              x="2.5"
              y="2.5"
              width="15"
              height="15"
              rx="2.2"
              strokeDasharray="2.4 2.2"
            />
            <rect x="5.5" y="5.5" width="5" height="5" rx="1" />
            <rect x="9.5" y="9.5" width="5" height="5" rx="1" />
          </>
        );
      case 'rename':
        // A pen writing on a line: a new name.
        return (
          <>
            <path d="M5 14.5 5.6 12l6.9-6.9a1.4 1.4 0 0 1 2 2L7.6 14Z" />
            <path d="M3 17.5h14" opacity="0.6" />
          </>
        );
      case 'parent':
        // Up and out to what holds it.
        return (
          <path d="M15.5 16.5v-5.5a3 3 0 0 0-3-3H4.5M8 4.5 4.5 8 8 11.5" />
        );
      case 'add':
        return <path d="M10 4v12M4 10h12" />;
      case 'discard':
        // Turned back: the scene as it was.
        return (
          <>
            <path d="M4.8 8.2A5.8 5.8 0 1 1 5.6 14" />
            <path d="M4.2 3.6v4.8H9" />
          </>
        );
      case 'view-top':
      case 'view-front':
      case 'view-side':
        // A cube, the face it is seen from filled in.
        return (
          <>
            <path d={CUBE_FACES[name]} fill="currentColor" fillOpacity="0.45" />
            <path d="M10 3l6.5 3.5v7L10 17l-6.5-3.5v-7ZM3.5 6.5 10 10l6.5-3.5M10 10v7" />
          </>
        );
      default:
        return null;
    }
  })();
  return (
    <svg
      className={className}
      viewBox="0 0 20 20"
      width="20"
      height="20"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      focusable="false"
    >
      {art}
    </svg>
  );
}
