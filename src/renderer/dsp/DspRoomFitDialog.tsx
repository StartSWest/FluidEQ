/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

import { useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { ROOM_HEADS, TRoomHead } from '../../common/dsp/chain';
import { TranslationKey } from '../../common/i18n/en';
import { parseRoomHeadBlock } from '../../common/roomHeadText';
import { readRoomHeadText } from '../utils/equalizerApi';
import { useTranslation } from '../utils/I18nContext';
import { reportError, reportInfo } from '../utils/logger';
import { FIT_PAIRS, TFitAnswer, chosenHead, nextPair } from './roomFit';
import { createFitPlayer, renderFitDemo } from './roomFitAudio';

interface IDspRoomFitDialogProps {
  onPick: (head: TRoomHead) => void;
  onClose: () => void;
}

/** The heads are shipped at this rate among others; the demo renders at it. */
const DEMO_RATE = 48000;

type TDemos = Record<TRoomHead, AudioBuffer>;

const HEAD_NAME: Record<TRoomHead, TranslationKey> = {
  small: 'dsp.room.head.small',
  medium: 'dsp.room.head.medium',
  large: 'dsp.room.head.large',
};

/**
 * Fit: five pairs of the same sound through two heads, "which one sounds
 * more around you", and the head that won. The sounds are rendered once
 * when the dialog opens; a press plays one and nothing else moves.
 */
const DspRoomFitDialog = ({ onPick, onClose }: IDspRoomFitDialogProps) => {
  const { t } = useTranslation();
  const [demos, setDemos] = useState<TDemos | undefined>();
  const [failed, setFailed] = useState(false);
  const [answers, setAnswers] = useState<TFitAnswer[]>([]);
  const [playing, setPlaying] = useState<'a' | 'b' | undefined>();
  const [player] = useState(createFitPlayer);
  // The card hands a new close callback on every render; the effect below
  // must load the heads once, so it reads the latest through a ref.
  const closeRef = useRef(onClose);
  closeRef.current = onClose;

  useEffect(() => {
    let isLive = true;
    const load = async () => {
      const rendered = await Promise.all(
        ROOM_HEADS.map(async (head) => {
          const block = parseRoomHeadBlock(
            await readRoomHeadText(head),
            DEMO_RATE,
          );
          if (!block) {
            throw new Error(`the ${head} head has no ${DEMO_RATE} Hz block`);
          }
          return [head, await renderFitDemo(block)] as const;
        }),
      );
      if (isLive) {
        setDemos(Object.fromEntries(rendered) as TDemos);
      }
    };
    load().catch((error) => {
      reportError('The heads could not be prepared for the fit', error);
      if (isLive) {
        setFailed(true);
      }
    });
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        closeRef.current();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => {
      isLive = false;
      window.removeEventListener('keydown', onKey);
      player.close();
    };
  }, [player]);

  const pair = useMemo(() => nextPair(answers), [answers]);
  const result = pair === undefined ? chosenHead(answers) : undefined;
  const pairLabel = t('dsp.roomFit.pair', {
    n: String(answers.length + 1),
    total: String(FIT_PAIRS),
  });

  const play = (side: 'a' | 'b') => {
    if (!demos || !pair) {
      return;
    }
    setPlaying(side);
    player
      .play(demos[side === 'a' ? pair.a : pair.b])
      .then(() => setPlaying((was) => (was === side ? undefined : was)))
      .catch(() => setPlaying(undefined));
  };
  const answer = (choice: TFitAnswer) => {
    player.stop();
    setPlaying(undefined);
    setAnswers((were) => [...were, choice]);
  };

  return createPortal(
    <div
      className="dsp-import-backdrop"
      role="presentation"
      onClick={(event) => {
        if (event.target === event.currentTarget) {
          onClose();
        }
      }}
    >
      <div
        className="dsp-import dsp-room-fit"
        role="dialog"
        aria-modal="true"
        aria-label={t('dsp.roomFit.title')}
      >
        <h2 className="dsp-import__title">{t('dsp.roomFit.title')}</h2>
        {result !== undefined ? (
          <>
            <p className="dsp-import__hint">
              {t('dsp.roomFit.resultTitle', { head: t(HEAD_NAME[result]) })}
            </p>
            <p className="dsp-import__hint">{t('dsp.roomFit.resultBody')}</p>
            <div className="dsp-import__actions">
              <span className="dsp-import__spacer" />
              <button
                type="button"
                className="button small subtle"
                onClick={() => setAnswers([])}
              >
                {t('dsp.roomFit.again')}
              </button>
              <button
                type="button"
                className="button small"
                onClick={() => {
                  reportInfo(`Fit chose the ${result} head`);
                  onPick(result);
                }}
              >
                {t('dsp.roomFit.use')}
              </button>
            </div>
          </>
        ) : (
          <>
            <p className="dsp-import__hint">{t('dsp.roomFit.hint')}</p>
            <div
              className="dsp-room-fit__progress"
              role="progressbar"
              aria-label={pairLabel}
              aria-valuemin={0}
              aria-valuemax={FIT_PAIRS}
              aria-valuenow={answers.length}
            >
              <i style={{ width: `${(answers.length / FIT_PAIRS) * 100}%` }} />
            </div>
            <p className="dsp-room-fit__pair">{pairLabel}</p>
            {failed ? (
              <p className="dsp-import__error" role="alert">
                {t('dsp.roomFit.error')}
              </p>
            ) : undefined}
            {!demos && !failed ? (
              <p className="dsp-import__hint" role="status">
                {t('dsp.roomFit.loading')}
              </p>
            ) : undefined}
            <div className="dsp-room-fit__plays">
              {(['a', 'b'] as const).map((side) => (
                <button
                  key={side}
                  type="button"
                  className={`button small${playing === side ? ' is-running' : ''}`}
                  disabled={!demos}
                  onClick={() => play(side)}
                >
                  {t(side === 'a' ? 'dsp.roomFit.playA' : 'dsp.roomFit.playB')}
                </button>
              ))}
            </div>
            <div className="dsp-import__actions dsp-room-fit__choices">
              <button
                type="button"
                className="button small subtle"
                disabled={!demos}
                onClick={() => answer('a')}
              >
                {t('dsp.roomFit.chooseA')}
              </button>
              <button
                type="button"
                className="button small subtle"
                disabled={!demos}
                onClick={() => answer('b')}
              >
                {t('dsp.roomFit.chooseB')}
              </button>
              <button
                type="button"
                className="button small subtle"
                disabled={!demos}
                onClick={() => answer('same')}
              >
                {t('dsp.roomFit.same')}
              </button>
              <button
                type="button"
                className="button small subtle dsp-room-fit__cancel"
                onClick={onClose}
              >
                {t('dsp.roomFit.cancel')}
              </button>
            </div>
          </>
        )}
      </div>
    </div>,
    document.body,
  );
};

export default DspRoomFitDialog;
