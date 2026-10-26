/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

import { useId, useMemo, useRef } from 'react';
import { NO_GAIN_FILTER_TYPES } from 'common/constants';
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
import MiniBands from './MiniBands';
import PlayerIcon from './PlayerIcon';
import PlayerTone from './PlayerTone';
import SmartEqKey from './SmartEqKey';
import { type TPlayerSoundFace, usePlayerSound } from './playerLayout';
import useRowNeed from './useRowNeed';

/**
 * Under the faders: the layout, the EQ mode and Clear. A component of its own
 * so its words are fitted from the moment it is drawn — the row exists only
 * while the faders are the face, and a fit set up beside it would have been
 * watching nothing whenever the section opened on the tone knobs.
 */
const SoundFoot = () => {
  const footRef = useRef<HTMLDivElement>(null);
  useRowNeed(footRef, 'soundFoot', 2);
  return (
    <div className="player-eq__foot player-sound__foot" ref={footRef}>
      <BandLayoutMenu />
      <EqModeSelect />
      <ClearEqButton />
    </div>
  );
};

/**
 * SOUND (Ivan, 2026-10-25): the one amp's equalizer, as a section that folds
 * to its header. The header keeps what is reached for most — the preset,
 * Smart EQ and FluidEQ's own switch — whether it is open or not; open, the
 * tone knobs or the faders, and whether the equalizer is on beside their
 * tabs. Which engine is shaping the sound is the foot's to say (`PlayerFoot`).
 *
 * No curve screen above the faders: the picture at the top of the amp is
 * already one (Ivan: "dont show double graph"). The Stage equalizer's row
 * classes are kept (`player-eq__keys`, `__foot`, `__faces`), so these rows
 * wear the same keys and give up the same words as room runs out.
 */
const PlayerSound = () => {
  const { t } = useTranslation();
  const { filters } = useFluidEqContext();
  const power = useEqualizerPower();
  const isMeasuring = useIsAutoEqRunning();
  const isSaveOn = useSongEqSaveOn();
  const recording = useSongEqRecording();
  const { sound, setSound } = usePlayerSound();
  const headRef = useRef<HTMLDivElement>(null);
  const tabsRef = useRef<HTMLDivElement>(null);
  const bodyId = useId();
  // A long preset name or a long language gives words up first; what the
  // rows still need past that, the amp's width makes room for.
  useRowNeed(headRef, 'soundHead', 1);
  useRowNeed(tabsRef, 'soundTabs');

  const bandCount = useMemo(
    () =>
      Object.values(filters).filter(
        (band) => !NO_GAIN_FILTER_TYPES.includes(band.type),
      ).length,
    [filters],
  );
  const songProgress = Math.min(
    1,
    recording.listenedMs / SONG_EQ_MIN_LISTENED_MS,
  );

  const face = (value: TPlayerSoundFace, label: string) => (
    <button
      type="button"
      className="player-eq__face"
      aria-pressed={sound.face === value}
      onClick={() => setSound({ face: value })}
    >
      {label}
    </button>
  );

  return (
    <section
      className={`player-eq player-sound${sound.isOpen ? '' : ' is-folded'}`}
      aria-label={t('player.eq.aria')}
    >
      <div className="player-eq__keys player-sound__head" ref={headRef}>
        <button
          type="button"
          className="player-sound__fold"
          aria-expanded={sound.isOpen}
          aria-controls={bodyId}
          title={
            sound.isOpen ? t('player.sound.fold') : t('player.sound.unfold')
          }
          onClick={() => setSound({ isOpen: !sound.isOpen })}
        >
          <PlayerIcon name="sound" className="player-icon player-sound__mark" />
          <span className="player-sound__name">{t('player.sound.title')}</span>
          <PlayerIcon
            name="fold"
            className="player-icon player-sound__chevron"
          />
        </button>
        <VoicingQuickPick />
        <SmartEqKey />
        <button
          type="button"
          className="player-sound__power"
          aria-pressed={power.isEnabled}
          aria-label={t('sidebar.systemEq')}
          title={t('player.eq.onHint')}
          disabled={power.isBlockingError}
          onClick={() => {
            power.toggle().catch(() => undefined);
          }}
        >
          <PlayerIcon name="power" />
        </button>
      </div>
      {/* A drawer that slides shut on the head and open again (Ivan,
          2026-10-25: "add nice animation on collapse expand"): the body stays
          laid out so it has a height to slide from, and is inert while shut,
          so nothing in it can be reached by the keyboard. */}
      <div className="player-sound__drawer" id={bodyId} inert={!sound.isOpen}>
        <div className="player-sound__body">
          <div className="player-sound__tabs" ref={tabsRef}>
            <span className="player-eq__faces" role="group">
              {face('tone', t('eq.tone'))}
              {face('bands', t('player.sound.bands', { count: bandCount }))}
            </span>
            {/* Only while Smart EQ keeps measuring, as on the EQ page:
                saving a song files the layer that measurement refines. */}
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
            <span
              className={`player-sound__state${
                power.isEnabled ? '' : ' is-off'
              }`}
            >
              <span className="player-sound__lamp" aria-hidden="true" />
              {power.isEnabled ? t('player.sound.on') : t('player.sound.off')}
            </span>
          </div>
          {sound.face === 'tone' ? (
            <PlayerTone />
          ) : (
            <>
              <MiniBands />
              <SoundFoot />
            </>
          )}
        </div>
      </div>
    </section>
  );
};

export default PlayerSound;
