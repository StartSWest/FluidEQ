/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

import { useId } from 'react';
import { useTranslation } from '../utils/I18nContext';
import EqDeck from './EqDeck';
import QueueDeck from './QueueDeck';
import { useLibraryDeck } from './libraryDeck';
import { usePlayerSheet, type TPlayerSheetTab } from './playerLayout';

interface IPlayerSheetProps {
  onOpenLibrary: () => void;
}

/**
 * The glass sheet along the foot of the amp (the Stage, Ivan 2026-09-27):
 * the equalizer and what plays next as its two pages, one tab each, and a
 * handle along its top that lowers it to its tabs — the picture gets the
 * room — and raises it again.
 *
 * One page at a time, at one height: the sheet is as tall as the equalizer
 * needs, and the queue lists as much of itself as fits in the same room, so
 * turning the page never moves anything else in the window.
 */
const PlayerSheet = ({ onOpenLibrary }: IPlayerSheetProps) => {
  const { t } = useTranslation();
  const { sheet, setSheet } = usePlayerSheet();
  const library = useLibraryDeck();
  const panelId = useId();
  const hasQueue = library !== undefined && library.total > 0;
  const isQueue = sheet.tab === 'queue';

  const tab = (value: TPlayerSheetTab, label: string, count?: string) => (
    <button
      type="button"
      role="tab"
      aria-selected={sheet.tab === value}
      aria-controls={panelId}
      className={`player-sheet__tab${sheet.tab === value ? ' is-on' : ''}`}
      // A tab pressed while the sheet is lowered raises it on that page.
      onClick={() => setSheet({ tab: value, isOpen: true })}
    >
      {label}
      {count && <span className="player-sheet__count">{count}</span>}
    </button>
  );

  return (
    <section
      className={`player-sheet${sheet.isOpen ? '' : ' is-lowered'}${
        isQueue ? ' is-queue' : ''
      }`}
      aria-label={t('player.sheet.aria')}
    >
      <button
        type="button"
        className="player-sheet__handle"
        aria-expanded={sheet.isOpen}
        aria-controls={panelId}
        aria-label={
          sheet.isOpen ? t('player.sheet.lower') : t('player.sheet.raise')
        }
        title={sheet.isOpen ? t('player.sheet.lower') : t('player.sheet.raise')}
        onClick={() => setSheet({ isOpen: !sheet.isOpen })}
      >
        <span className="player-sheet__grabber" aria-hidden="true" />
      </button>
      <div className="player-sheet__tabs" role="tablist">
        {tab('eq', t('player.eq.aria'))}
        {tab(
          'queue',
          t('library.upNext'),
          hasQueue ? `${library.position + 1} / ${library.total}` : undefined,
        )}
      </div>
      {/* The equalizer's page is what makes the sheet as tall as it is, so it
          stays laid out under the queue's, out of sight; the queue's lies
          over it in exactly that room. */}
      {sheet.isOpen && (
        <div className="player-sheet__pages" id={panelId}>
          <div
            className={`player-sheet__page${isQueue ? ' is-away' : ''}`}
            role="tabpanel"
            aria-hidden={isQueue}
          >
            <EqDeck />
          </div>
          {isQueue && (
            <div className="player-sheet__page is-over" role="tabpanel">
              <QueueDeck onOpenLibrary={onOpenLibrary} />
            </div>
          )}
        </div>
      )}
    </section>
  );
};

export default PlayerSheet;
