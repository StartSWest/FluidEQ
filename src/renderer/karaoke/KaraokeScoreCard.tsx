/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

import { useRef } from 'react';
import { createPortal } from 'react-dom';
import { type IKaraokeScoreLine } from '../../common/karaoke/scoring';
import DialogClose from '../components/DialogClose';
import { useTranslation } from '../utils/I18nContext';
import useModalKeys from '../utils/useModalKeys';
import KaraokeScoreMap from './KaraokeScoreMap';
import KaraokeScoreRecap from './KaraokeScoreRecap';
import { type IKaraokeEndCard } from './useKaraokeScore';
import '../styles/Button.scss';

interface IKaraokeScoreCardProps {
  card: IKaraokeEndCard;
  songLabel: string;
  onClose: () => void;
  onPractiseLine: (line: IKaraokeScoreLine) => void;
  onSingAgain: () => void;
}

/**
 * The end of a sung song: the summary and the song's map side by side, as
 * the mockup lays its two cards, one under the other in a narrow window. On
 * the dialogs' solid face, flat; Escape or its × close it.
 */
const KaraokeScoreCard = ({
  card,
  songLabel,
  onClose,
  onPractiseLine,
  onSingAgain,
}: IKaraokeScoreCardProps) => {
  const { t } = useTranslation();
  const surfaceRef = useRef<HTMLDivElement>(null);
  const practiseRef = useRef<HTMLButtonElement>(null);
  const closeRef = useRef<HTMLButtonElement>(null);
  // The loud answer takes focus where there is one; the close otherwise.
  const initialRef = card.summary.hardestLine ? practiseRef : closeRef;
  useModalKeys(surfaceRef, initialRef, { busy: false, onCancel: onClose });

  return createPortal(
    <div
      className="karaoke-score-card-backdrop"
      role="presentation"
      onClick={(event) => {
        if (event.target === event.currentTarget) {
          onClose();
        }
      }}
    >
      <div
        ref={surfaceRef}
        className="karaoke-score-card"
        role="dialog"
        aria-modal="true"
        aria-labelledby="karaoke-score-card-title"
      >
        <DialogClose
          ref={closeRef}
          label={t('karaoke.score.close')}
          onClose={onClose}
        />
        <div className="karaoke-score-card__body">
          <KaraokeScoreRecap
            card={card}
            songLabel={songLabel}
            titleId="karaoke-score-card-title"
            practiseRef={practiseRef}
            onPractiseLine={onPractiseLine}
            onSingAgain={onSingAgain}
          />
          <KaraokeScoreMap card={card} onPractiseLine={onPractiseLine} />
        </div>
      </div>
    </div>,
    document.body,
  );
};

export default KaraokeScoreCard;
