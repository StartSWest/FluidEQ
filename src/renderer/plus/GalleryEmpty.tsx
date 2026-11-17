/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

import type { ReactNode } from 'react';
import Glyph, { type TCommunityGlyph } from '../community/Glyph';

interface IGalleryEmptyProps {
  /** The front frame's glyph: what the gallery would show here. */
  glyph: TCommunityGlyph;
  /** Says it, in the card's lead line. */
  children: ReactNode;
  /** `alert` where the list could not be had; nothing for an empty list. */
  role?: 'alert';
}

/**
 * A gallery list with nothing to show, or none to be had - as the Library's
 * empty state draws one (`.library-empty`): its fanned sleeves turned to the
 * shape a scene has, three 16:9 frames with the glyph on the front one, over
 * the words and what to do (Ivan, 2026-11-17: "everything there needs to
 * look like the Library"). It was a round tinted mark over a line of text,
 * or an amber bar across the page for a list that could not load.
 */
export default function GalleryEmpty({
  glyph,
  children,
  role,
}: IGalleryEmptyProps) {
  return (
    <div className="library-empty gallery-empty" role={role}>
      <div className="library-empty__card">
        <div
          className="library-empty__art gallery-empty__art"
          aria-hidden="true"
        >
          <span className="library-empty__sleeve library-empty__sleeve--left gallery-empty__frame" />
          <span className="library-empty__sleeve library-empty__sleeve--right gallery-empty__frame" />
          <span className="library-empty__sleeve library-empty__sleeve--front gallery-empty__frame">
            <Glyph name={glyph} />
          </span>
        </div>
        {children}
      </div>
    </div>
  );
}
