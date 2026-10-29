/* Copyright (C) 2026 Ivan Carmenates Garcia. SPDX-License-Identifier: GPL-3.0-or-later */

import { useState } from 'react';
import { useAccount } from '../account/accountStore';
import Glyph from '../community/Glyph';
import { useGalleryList } from '../plus/galleryStore';
import { gallerySeenAt, scenesNewSince } from '../plus/gallerySeen';
import { useTranslation } from '../utils/I18nContext';
import openLookPickerPlace from './lookPickerPlaces';

/** The gallery's newest page, the one the count is read from. */
const NEWEST = { sort: 'new' } as const;

/**
 * The Visualizers column's last line, under the reader's own scenes: the way
 * to more of them in the gallery, and how many went up since the gallery was
 * last opened (Ivan, 2026-10-29: "even if they have scenes add a line on the
 * button get more from the lib", "if there are new ones on the lib show n new
 * ones"). The quiet button normally; the accent's while something is new,
 * because then it is the thing to press. Counted from the gallery's newest
 * page, which the gallery loads anyway; a reader who cannot list it sees the
 * line with no count.
 */
export default function LookPickerMore({ onLeave }: { onLeave: () => void }) {
  const { t } = useTranslation();
  const account = useAccount();
  const [seenAt] = useState(() => gallerySeenAt());
  const { list } = useGalleryList(NEWEST);
  const fresh = scenesNewSince(list.scenes, seenAt);

  return (
    <div className="look-picker__more">
      <span className="look-picker__more-lead">
        {t('graph.picker.more.lead')}
      </span>
      <button
        type="button"
        className={fresh > 0 ? 'button small' : 'button small subtle'}
        onClick={() =>
          openLookPickerPlace(
            'gallery',
            onLeave,
            account.status === 'signed-in',
          )
        }
      >
        <Glyph name="looks" />
        {t('graph.picker.discover.explore')}
        {fresh > 0 && (
          <span className="look-picker__more-new">
            {t('graph.picker.more.new', { count: fresh })}
          </span>
        )}
      </button>
    </div>
  );
}
