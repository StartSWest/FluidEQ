/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

import { useEffect, useRef } from 'react';
import type { TranslationKey } from '../../common/i18n';
import { useTranslation } from '../utils/I18nContext';
import { TDropNotice, clearDropNotice, useDropNotice } from './dropNotice';

const MESSAGE_KEYS: Record<TDropNotice, TranslationKey> = {
  empty: 'library.drop.empty',
  already: 'library.drop.already',
  failed: 'library.drop.failed',
};

/**
 * What a drop that put nothing on Up next did, over the queue's foot.
 *
 * The scan's own card, in the scan card's place and look: a folder dropped
 * is read under that card, and what the drop came to is said where the
 * card stood. Dismissed by its button, and gone of itself when the next
 * thing happens — another drop (`useMusicDrop`), or the song or Up next
 * changing, measured from when the word appeared. No timer.
 */
const QueueDropNotice = ({
  position,
  total,
}: {
  position: number | undefined;
  total: number | undefined;
}) => {
  const { t } = useTranslation();
  const notice = useDropNotice();
  /** Where the queue stood when the word appeared. */
  const shownAtRef = useRef<{ position?: number; total?: number } | undefined>(
    undefined,
  );
  useEffect(() => {
    if (notice === undefined) {
      shownAtRef.current = undefined;
      return;
    }
    const shownAt = shownAtRef.current;
    if (shownAt === undefined) {
      shownAtRef.current = { position, total };
      return;
    }
    if (shownAt.position !== position || shownAt.total !== total) {
      clearDropNotice();
    }
  }, [notice, position, total]);

  if (notice === undefined) {
    return null;
  }
  return (
    <div className="library-scan-progress player-queue__notice" role="status">
      <div className="library-scan-progress__copy">
        <strong>{t(MESSAGE_KEYS[notice])}</strong>
      </div>
      <button
        type="button"
        className="button small subtle"
        onClick={clearDropNotice}
      >
        {t('app.dismiss')}
      </button>
    </div>
  );
};

export default QueueDropNotice;
