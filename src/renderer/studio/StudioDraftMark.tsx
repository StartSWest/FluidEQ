/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

import Glyph from '../community/Glyph';
import { useTranslation } from '../utils/I18nContext';
import '../styles/StudioDraft.scss';

/**
 * Over a scene on the Studio's stage that is not published yet: a proof's
 * hatching across the picture and a tag saying what lifts it (Ivan,
 * 2026-10-18: "algo que sea rudo: ellos pueden hacer, pero necesitan
 * publicar para poder ver"). The stage keeps everything a maker tests with —
 * full screen included, because a scene that holds at 1080p and falls apart
 * at 4K is found there — and the mark stays on in it, so a draft is never a
 * clean visualizer to keep on screen. Inside the stage's frame, so full
 * screen carries it; it takes no pointer, so the scene's hands still work.
 */
export default function StudioDraftMark() {
  const { t } = useTranslation();
  return (
    <div className="studio-draft" role="note">
      <span className="studio-draft__tag">
        <span className="studio-draft__badge">{t('studio.draft.badge')}</span>
        <span className="studio-draft__line">
          <Glyph name="upload" />
          {t('studio.draft.line')}
        </span>
      </span>
    </div>
  );
}
