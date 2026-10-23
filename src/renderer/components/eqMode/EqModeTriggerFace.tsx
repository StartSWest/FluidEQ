/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

import type { ReactNode } from 'react';
import MenuIcon from '../../icons/MenuIcon';
import { useTranslation } from '../../utils/I18nContext';

/**
 * What the EQ mode button shows, whether it opens the menu or the card pinned
 * beside the graph: the same glyph, word and summary, so pinning changes only
 * the mark at its end.
 */
const EqModeTriggerFace = ({
  customized,
  end,
}: {
  customized: boolean;
  /** The menu's chevron, or the pin of the card it shows instead. */
  end: ReactNode;
}) => {
  const { t } = useTranslation();
  return (
    <>
      {/* Named by a glyph as well as by a word, like every other control
          in these toolbars — and it is the glyph that is left once the row
          runs out of room for words (Ivan, 2026-09-22). */}
      <MenuIcon name="settings" className="eq-toolbar__icon" />
      <span className="eq-toolbar__word">{t('eq.mode')}</span>
      <span className="eq-mode-trigger__summary">
        {t(customized ? 'eq.mode.customized' : 'eq.mode.normal')}
      </span>
      {end}
    </>
  );
};

export default EqModeTriggerFace;
