/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

import { useCallback, useEffect, useRef } from 'react';
import type { TranslationKey } from 'common/i18n';
import {
  markPlusWelcomeSeen,
  usePlusWelcome,
} from '../account/plusWelcomeStore';
import Glyph, { type TCommunityGlyph } from '../community/Glyph';
import MenuIcon from '../icons/MenuIcon';
import SceneBand from '../plus/SceneBand';
import { requestPlusTab } from '../plus/plusTabRequest';
import holdFocusReturn from '../utils/focusReturn';
import { useTranslation } from '../utils/I18nContext';
import { reportError } from '../utils/logger';
import { moveTabStop } from '../utils/useModalKeys';
import DialogFrame from './DialogFrame';
import '../styles/PlusMemberWelcome.scss';

/**
 * What a membership opens, in the order somebody would meet it: the scenes
 * first, because they are what the gallery is full of and what the button
 * under them leads to; then making one; then the two places a scene can go
 * that are not the graph; the board last, which is the only one that needs
 * other people.
 *
 * A list, each with its glyph, name and one line, rather than five cards:
 * five bordered boxes side by side were a second frame inside the dialog for
 * each of five sentences.
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
 * so the welcome carries one: the starter playing on whatever they have on,
 * in the rail under the words that say what happened.
 *
 * Whether it shows at all is decided in the main process, which holds both
 * facts it rests on (`ipc/plusWelcome.ts`). Every way out closes it for good
 * — being welcomed twice is worse than not being welcomed at all.
 */
export default function PlusWelcomeDialog() {
  const edition = usePlusWelcome()?.edition;
  return edition === undefined ? null : (
    <PlusWelcome key={edition} edition={edition} />
  );
}

function PlusWelcome({ edition }: { edition: number }) {
  const { t } = useTranslation();
  const surfaceRef = useRef<HTMLDivElement>(null);
  const openRef = useRef<HTMLButtonElement>(null);

  // Closed on screen at once whatever the answer; a failure only means the
  // main process did not record it, and the welcome comes back next launch.
  const close = useCallback(() => {
    markPlusWelcomeSeen(edition).catch((error: unknown) =>
      reportError('recording the Plus welcome as seen', error),
    );
  }, [edition]);

  // The welcome stands over whatever was open when the membership arrived,
  // so its keys are taken in the capture phase and go no further: Escape
  // closed the dialog beneath with it, and Tab walked out into the window
  // behind, which a dialog marked modal must not let it do.
  useEffect(() => {
    const giveFocusBack = holdFocusReturn();
    openRef.current?.focus();
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.stopPropagation();
        close();
      } else if (event.key === 'Tab') {
        event.stopPropagation();
        moveTabStop(surfaceRef.current, event);
      }
    };
    window.addEventListener('keydown', onKeyDown, true);
    return () => {
      window.removeEventListener('keydown', onKeyDown, true);
      giveFocusBack();
    };
  }, [close]);

  return (
    <div className="plus-member-welcome-backdrop" role="presentation">
      <DialogFrame
        ref={surfaceRef}
        className="plus-member-welcome"
        icon={<MenuIcon name="plusTab" />}
        eyebrow={t('plusWelcome.eyebrow')}
        title={t('plusWelcome.title')}
        titleId="plus-welcome-title"
        description={t('plusWelcome.lead')}
        rail={<SceneBand playsScene className="dialog-frame__scene" />}
        closeLabel={t('support.close')}
        onClose={close}
        footer={
          <div className="dialog-frame__actions">
            <button
              type="button"
              className="button small subtle"
              onClick={close}
            >
              {t('plusWelcome.later')}
            </button>
            <button
              ref={openRef}
              type="button"
              className="button small plus-member-welcome__open"
              onClick={() => {
                close();
                requestPlusTab();
              }}
            >
              <Glyph name="looks" />
              {t('plusWelcome.open')}
            </button>
          </div>
        }
      >
        <ul className="plus-member-welcome__list">
          {OPENED.map((item) => (
            <li key={item.title} className="plus-member-welcome__item">
              <span className="plus-member-welcome__mark" aria-hidden="true">
                <Glyph name={item.glyph} />
              </span>
              <span className="plus-member-welcome__label">
                <strong>{t(item.title)}</strong>
                <span>{t(item.line)}</span>
              </span>
            </li>
          ))}
        </ul>

        {/* Where the membership lives once this is closed (Ivan,
            2026-09-16): the panel it was bought from is closed behind this,
            and nothing else in the app says where it went. Then what it
            covers. */}
        <div className="plus-member-welcome__notes">
          <p>
            {t('plusWelcome.where', {
              menu: t('app.actions'),
              account: t('account.menu'),
            })}
          </p>
          <p>{t('plusWelcome.note')}</p>
        </div>
      </DialogFrame>
    </div>
  );
}
