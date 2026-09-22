/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

import { useCallback, useEffect, useRef, useState } from 'react';
import { SONG_EQ_MIN_LISTENED_MS } from 'common/songEqRecorder';
import {
  setSongEqSaveOn,
  useSongEqRecording,
  useSongEqSaveOn,
} from '../audio/songEqSession';
import BandLayoutMenu from '../components/BandLayoutMenu';
import ClearEqButton from '../components/ClearEqButton';
import EqModeSelect from '../components/EqModeSelect';
import VoicingQuickPick from '../components/VoicingQuickPick';
import useIsAutoEqRunning from '../utils/autoEqRunning';
import { useFluidEqContext } from '../utils/FluidEqContext';
import { useTranslation } from '../utils/I18nContext';
import useEqualizerPower from '../utils/useEqualizerPower';
import EqScreen, { IBandFocus } from './EqScreen';
import MiniBands, { PREAMP_FOCUS, bandLabel } from './MiniBands';
import MenuIcon from '../icons/MenuIcon';
import PlayerTone from './PlayerTone';
import SmartEqKey from './SmartEqKey';
import { setPlayerWidthNeed } from './playerLayout';
import useRowFit from './useRowFit';

type TEqFace = 'bands' | 'tone';

const FACE_KEY = 'fluideq.player.eqFace';

const readFace = (): TEqFace => {
  try {
    return window.localStorage.getItem(FACE_KEY) === 'tone' ? 'tone' : 'bands';
  } catch {
    return 'bands';
  }
};

/**
 * The player's equalizer: the EQ page's rows of buttons, on one deck.
 *
 * Its own keys along the top — FluidEQ on or off, Smart EQ and its mode,
 * Save for this song while Smart EQ keeps measuring — and the EQ page's own
 * Presets picker beside them. The screen under them names what else is
 * applied and draws what is heard; under that, one of two faces: the preamp
 * and the bands, or the EQ page's Bass, Mid and Treble. Along the foot, the
 * choice of face and the page's own band layouts, EQ mode and Clear EQ: the
 * same controls, not copies, so they cannot drift apart.
 */
const EqDeck = () => {
  const { t } = useTranslation();
  const { filters, preAmp } = useFluidEqContext();
  const power = useEqualizerPower();
  const isMeasuring = useIsAutoEqRunning();
  const isSaveOn = useSongEqSaveOn();
  const recording = useSongEqRecording();
  const [focusKey, setFocusKey] = useState<string>();
  const [face, setFace] = useState<TEqFace>(readFace);
  // Each row gives its words up only when it has measured that it must
  // (`useRowFit`): the keys row has one thing to give — Smart EQ's mode —
  // and the foot two steps, the names and then the values. What each row
  // still needs with all of that gone is the deck's part of the window's
  // floor (`setPlayerWidthNeed`): the wider row, plus everything the deck
  // and the body draw around a row, which is the same in one column or two.
  const keysRef = useRef<HTMLDivElement>(null);
  const footRef = useRef<HTMLDivElement>(null);
  const needs = useRef({ keys: 0, foot: 0 });
  const publishNeed = useCallback(() => {
    const row = footRef.current ?? keysRef.current;
    const deck = row?.closest<HTMLElement>('.player-eq');
    const body = row?.closest<HTMLElement>('.player-body');
    if (!row || !deck || !body) {
      return;
    }
    const bodyStyle = getComputedStyle(body);
    const around =
      deck.getBoundingClientRect().width -
      row.clientWidth +
      parseFloat(bodyStyle.paddingLeft) +
      parseFloat(bodyStyle.paddingRight);
    setPlayerWidthNeed(
      'rows',
      Math.max(needs.current.keys, needs.current.foot) + around,
    );
  }, []);
  const onKeysNeed = useCallback(
    (width: number) => {
      needs.current.keys = width;
      publishNeed();
    },
    [publishNeed],
  );
  const onFootNeed = useCallback(
    (width: number) => {
      needs.current.foot = width;
      publishNeed();
    },
    [publishNeed],
  );
  useRowFit(keysRef, 1, onKeysNeed);
  useRowFit(footRef, 2, onFootNeed);
  // The deck's say ends with the deck: closed, the window may be as narrow
  // as the rest of the player allows.
  useEffect(() => () => setPlayerWidthNeed('rows', undefined), []);

  const held = focusKey === undefined ? undefined : filters[focusKey];
  let focus: IBandFocus | undefined;
  if (focusKey === PREAMP_FOCUS) {
    focus = { label: t('player.eq.pre'), gain: preAmp };
  } else if (held) {
    focus = { label: bandLabel(held.frequency), gain: held.gain };
  }
  const songProgress = Math.min(
    1,
    recording.listenedMs / SONG_EQ_MIN_LISTENED_MS,
  );

  const chooseFace = (next: TEqFace) => {
    setFace(next);
    setFocusKey(undefined);
    try {
      window.localStorage.setItem(FACE_KEY, next);
    } catch {
      // Remembered where storage allows; the switch works either way.
    }
  };
  // Both quiet, in either state: which one is chosen is said by the key's own
  // "on" face (`.player-eq__faces`), not by the app's loud accent button —
  // neither view of the equaliser is the one being recommended.
  const faceButton = (value: TEqFace, label: string) => (
    <button
      type="button"
      className="button small subtle player-eq__face"
      aria-pressed={face === value}
      onClick={() => chooseFace(value)}
    >
      {/* The faders, and the sound they shape. These two keep their words at
          every width — they are the choice of what the deck IS, and a pair of
          glyphs with no names is a riddle (Ivan, 2026-09-22). */}
      <MenuIcon name={value === 'tone' ? 'waveform' : 'layout'} />
      {label}
    </button>
  );

  return (
    <section className="player-eq" aria-label={t('player.eq.aria')}>
      <div className="player-eq__keys" ref={keysRef}>
        <button
          type="button"
          className="button small subtle player-led"
          aria-pressed={power.isEnabled}
          disabled={power.isBlockingError}
          title={t('player.eq.onHint')}
          onClick={() => {
            power.toggle().catch(() => undefined);
          }}
        >
          <span className="player-led__lamp" aria-hidden="true" />
          {t('player.eq.on')}
        </button>
        <SmartEqKey />
        {/* Only while Smart EQ keeps measuring, as on the EQ page: saving a
            song files the layer that measurement refines, and nothing else
            ever writes one. */}
        {isMeasuring && (
          <button
            type="button"
            className={`button small subtle player-led${
              recording.willSave ? ' is-saving' : ''
            }`}
            aria-pressed={isSaveOn}
            title={t('songEq.saveAria')}
            onClick={() => setSongEqSaveOn(!isSaveOn)}
          >
            <span className="player-led__lamp" aria-hidden="true" />
            {t('player.eq.song')}
            <span className="player-led__meter" aria-hidden="true">
              <span style={{ width: `${songProgress * 100}%` }} />
            </span>
          </button>
        )}
        <VoicingQuickPick />
      </div>
      <EqScreen focus={focus} />
      {face === 'tone' ? <PlayerTone /> : <MiniBands onFocus={setFocusKey} />}
      <div className="player-eq__foot" ref={footRef}>
        <span className="player-eq__faces" role="group">
          {faceButton('bands', t('tabs.eqMain'))}
          {faceButton('tone', t('eq.tone'))}
        </span>
        <BandLayoutMenu />
        <EqModeSelect />
        <ClearEqButton />
      </div>
    </section>
  );
};

export default EqDeck;
