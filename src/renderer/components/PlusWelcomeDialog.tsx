/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

import { useEffect, useRef } from 'react';
import type { TranslationKey } from 'common/i18n';
import {
  markPlusWelcomeSeen,
  usePlusWelcome,
} from '../account/plusWelcomeStore';
import Glyph, { type TCommunityGlyph } from '../community/Glyph';
import { requestPlusTab } from '../plus/plusTabRequest';
import { useTranslation } from '../utils/I18nContext';
import DialogHeader from './DialogHeader';
import '../styles/PlusMemberWelcome.scss';

/**
 * What a membership opens, in the order somebody would meet it: the scenes
 * first, because they are what the gallery is full of and what the tab this
 * dialog leads to shows; then making one; then the two places a scene can go
 * that are not the graph; the board last, which is the only one that needs
 * other people.
 */
const OPENED: readonly {
  glyph: TCommunityGlyph;
  title: TranslationKey;
  line: TranslationKey;
}[] = [
  {
    glyph: 'looks',
    title: 'plusWelcome.scenes.title',
    line: 'plusWelcome.scenes.line',
  },
  {
    glyph: 'studio',
    title: 'plusWelcome.studio.title',
    line: 'plusWelcome.studio.line',
  },
  {
    glyph: 'monitor',
    title: 'plusWelcome.desktop.title',
    line: 'plusWelcome.desktop.line',
  },
  {
    glyph: 'lighting',
    title: 'plusWelcome.lighting.title',
    line: 'plusWelcome.lighting.line',
  },
  {
    glyph: 'board',
    title: 'plusWelcome.board.title',
    line: 'plusWelcome.board.line',
  },
];

/**
 * The moment a membership turns on, said out loud.
 *
 * Paying happens at the merchant, in a browser, so the app hears of it when
 * the membership check comes back — and until this, nothing marked it: the
 * locks simply stopped being locks, and somebody who had just paid was left
 * to find out what they had bought. A dialog rather than a corner notice
 * because it happens once and it is the only thing worth looking at when it
 * does; the gallery is the recommendation and wears the loud button.
 *
 * Whether it shows is decided in the main process, which holds both facts it
 * rests on (`ipc/plusWelcome.ts`). Either button closes it for good — being
 * welcomed twice is worse than not being welcomed at all.
 */
export default function PlusWelcomeDialog() {
  const { t } = useTranslation();
  const welcome = usePlusWelcome();
  const openRef = useRef<HTMLButtonElement>(null);
  const edition = welcome?.edition;

  useEffect(() => {
    if (edition === undefined) {
      return undefined;
    }
    openRef.current?.focus();
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.stopPropagation();
        markPlusWelcomeSeen(edition).catch(() => undefined);
      }
    };
    window.addEventListener('keydown', onKeyDown, true);
    return () => window.removeEventListener('keydown', onKeyDown, true);
  }, [edition]);

  if (edition === undefined) {
    return null;
  }

  const close = () => {
    markPlusWelcomeSeen(edition).catch(() => undefined);
  };

  return (
    <div className="plus-member-welcome-backdrop" role="presentation">
      <div
        className="plus-member-welcome"
        role="dialog"
        aria-modal="true"
        aria-labelledby="plus-welcome-title"
      >
        <DialogHeader
          eyebrow={t('plusWelcome.eyebrow')}
          title={t('plusWelcome.title')}
          titleId="plus-welcome-title"
          closeLabel={t('plusWelcome.later')}
          onClose={close}
        />

        <div className="plus-member-welcome__body">
          <p className="plus-member-welcome__lead">{t('plusWelcome.lead')}</p>

          <ul className="plus-member-welcome__opened">
            {OPENED.map((item) => (
              <li key={item.title} className="plus-member-welcome__item">
                <span className="plus-member-welcome__mark" aria-hidden="true">
                  <Glyph name={item.glyph} />
                </span>
                <span className="plus-member-welcome__text">
                  <span className="plus-member-welcome__item-title">
                    {t(item.title)}
                  </span>
                  <span className="plus-member-welcome__item-line">
                    {t(item.line)}
                  </span>
                </span>
              </li>
            ))}
          </ul>

          <p className="plus-member-welcome__note">
            <Glyph name="shield" />
            {t('plusWelcome.note')}
          </p>
        </div>

        <div className="plus-member-welcome__footer">
          <button type="button" className="button small subtle" onClick={close}>
            {t('plusWelcome.later')}
          </button>
          <button
            ref={openRef}
            type="button"
            className="button small"
            onClick={() => {
              close();
              requestPlusTab();
            }}
          >
            <Glyph name="looks" />
            {t('plusWelcome.open')}
          </button>
        </div>
      </div>
    </div>
  );
}
