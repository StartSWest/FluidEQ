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
import BrandMark from '../icons/BrandMark';
import SceneBand from '../plus/SceneBand';
import { requestPlusTab } from '../plus/plusTabRequest';
import { useTranslation } from '../utils/I18nContext';
import '../styles/PlusMemberWelcome.scss';

/**
 * What a membership opens, in the order somebody would meet it: the scenes
 * first, because they are what the gallery is full of and what the button
 * under them leads to; then making one; then the two places a scene can go
 * that are not the graph; the board last, which is the only one that needs
 * other people.
 *
 * Five cards across, the way fluideq.com lays its visualizers out, rather
 * than five rows down a narrow panel: they are five places to go, and a
 * column of bordered rows is the shape of a settings page.
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
 * locks simply stopped being locks. What somebody has just bought is scenes,
 * so the welcome is one: the starter playing on whatever they have on, with
 * the words over it. A row of icons describing visualizers, in an app whose
 * whole product is visualizers, was the wrong thing to show them.
 *
 * Whether it shows at all is decided in the main process, which holds both
 * facts it rests on (`ipc/plusWelcome.ts`). Either button closes it for good —
 * being welcomed twice is worse than not being welcomed at all.
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
        <SceneBand playsScene className="plus-member-welcome__stage">
          <div className="plus-member-welcome__titles">
            <BrandMark className="plus-member-welcome__brand" />
            <span className="plus-member-welcome__eyebrow">
              {t('plusWelcome.eyebrow')}
            </span>
            <h2 id="plus-welcome-title" className="plus-member-welcome__title">
              {t('plusWelcome.title')}
            </h2>
          </div>

          <button
            type="button"
            className="plus-member-welcome__close"
            aria-label={t('plusWelcome.later')}
            onClick={close}
          >
            <Glyph name="close" />
          </button>
        </SceneBand>

        <div className="plus-member-welcome__body">
          <p className="plus-member-welcome__lead">{t('plusWelcome.lead')}</p>

          <ul className="plus-member-welcome__cards">
            {OPENED.map((item) => (
              <li key={item.title} className="plus-member-welcome__card">
                <span className="plus-member-welcome__art" aria-hidden="true">
                  <Glyph name={item.glyph} />
                </span>
                <span className="plus-member-welcome__label">
                  <strong>{t(item.title)}</strong>
                  <small>{t(item.line)}</small>
                </span>
              </li>
            ))}
          </ul>

          {/* Where the membership lives once this is closed (Ivan,
              2026-09-16): the panel it was bought from is closed behind
              this, and nothing else in the app says where it went. */}
          <p className="plus-member-welcome__note">
            <Glyph name="person" />
            {t('plusWelcome.where', {
              menu: t('app.actions'),
              account: t('account.menu'),
            })}
          </p>
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
