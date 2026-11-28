/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

import { type KeyboardEvent, useId, useRef } from 'react';
import { hasTone } from 'common/tone';
import BandLayoutMenu from '../components/BandLayoutMenu';
import ClearEqButton from '../components/ClearEqButton';
import CurvesPicker from '../components/CurvesPicker';
import EqModeSelect from '../components/EqModeSelect';
import VoicingQuickPick from '../components/VoicingQuickPick';
import SaveEqMenu from '../eq/autoEq/SaveEqMenu';
import EqToolGroup from '../eq/EqToolGroup';
import { cutCorners, isToneInUse } from '../eq/toneCuts';
import MenuIcon from '../icons/MenuIcon';
import { useFluidEqContext, useFluidEqLayers } from '../utils/FluidEqContext';
import { useTranslation } from '../utils/I18nContext';
import useEqualizerPower from '../utils/useEqualizerPower';
import MiniBands from './MiniBands';
import PlayerAddBand from './PlayerAddBand';
import PlayerIcon from './PlayerIcon';
import PlayerTone from './PlayerTone';
import PlayerToolRow from './PlayerToolRow';
import type { TPlayerPage } from './PlayerMarkMenu';
import SmartEqKey from './SmartEqKey';
import { type TPlayerSoundFace, usePlayerSound } from './playerLayout';
import useRowNeed from './useRowNeed';

/** Your EQ first and the Tone after it, as the EQ page's tabs stand. */
const FACES: readonly TPlayerSoundFace[] = ['bands', 'tone'];

const FACE_ICON: Record<TPlayerSoundFace, 'eqBars' | 'waveform'> = {
  bands: 'eqBars',
  tone: 'waveform',
};

/**
 * Under the faders, the EQ page's Your EQ tools in the page's order (Ivan,
 * 2026-11-27: "same order as in the full app"): BANDS — how many, Add,
 * Clear, Save EQ; VIEW — the curves and the EQ mode; Smart at the end, where
 * the page keeps Auto EQ.
 *
 * Every one opens over the amp, anchored to itself (Ivan, 2026-11-27: "it
 * tries to show on side pane not good for amp"): the EQ mode is the menu,
 * never the page's pinnable one, whose pinned card stands in the full app's
 * sound panel; and the Curves menu's way to a headphone correction takes the
 * amp back to the full app's page for it rather than opening that page
 * unseen behind the amp.
 */
const BandsTools = ({
  onOpenPage,
}: {
  onOpenPage: (page: TPlayerPage) => void;
}) => {
  const { t } = useTranslation();
  return (
    <PlayerToolRow>
      <EqToolGroup caption={t('eq.tools.bands')}>
        <BandLayoutMenu formatLabel={String} />
        <PlayerAddBand />
        <ClearEqButton label={t('eq.tools.clear')} />
        <SaveEqMenu />
      </EqToolGroup>
      <span className="eq-layer-tabs__rule" aria-hidden="true" />
      <EqToolGroup caption={t('eq.tools.view')}>
        <CurvesPicker onAddCorrection={() => onOpenPage('presets')} />
        <EqModeSelect />
      </EqToolGroup>
      <SmartEqKey />
    </PlayerToolRow>
  );
};

/**
 * SOUND (Ivan, 2026-10-25): the one amp's equalizer, as a section that folds
 * to its head. The head is the EQ page's tabs — Your EQ with its band count,
 * the Tone with whether it is on — then the preset and FluidEQ's own switch,
 * and the fold at its right end, as Up next's is (Ivan, 2026-11-27: "instead
 * of having sound", "we save space for your EQ and tone there"). Open: the
 * faders or the tone dials, and under them that tab's tools.
 *
 * No curve screen above the faders: the picture at the top of the amp is
 * already one (Ivan: "dont show double graph").
 */
const PlayerSound = ({
  onOpenPage,
}: {
  onOpenPage: (page: TPlayerPage) => void;
}) => {
  const { t } = useTranslation();
  const { filters } = useFluidEqContext();
  const { tone, eqCuts } = useFluidEqLayers();
  const power = useEqualizerPower();
  const { sound, setSound } = usePlayerSound();
  const headRef = useRef<HTMLDivElement>(null);
  const tabRefs = useRef<Partial<Record<TPlayerSoundFace, HTMLButtonElement>>>(
    {},
  );
  const bodyId = useId();
  // The tabs give up what they hold, then their words, before the amp's
  // width has to rise for the head (`_miniPlayerEqRows.scss`).
  useRowNeed(headRef, 'soundHead', 2);

  const isToneOn = isToneInUse(tone, eqCuts);
  const label: Record<TPlayerSoundFace, string> = {
    bands: t('eq.tabs.bands'),
    tone: t('eq.tone'),
  };
  // What each tab holds, as the page's tabs say it: every band, and On, Off
  // or where the cuts stand when they are all the Tone is doing.
  const meta: Record<TPlayerSoundFace, string> = {
    bands: String(Object.keys(filters).length),
    tone: isToneOn
      ? ((hasTone(tone) ? undefined : cutCorners(eqCuts)) ??
        t('eq.tabs.toneOn'))
      : t('eq.tabs.toneOff'),
  };

  // A tab opens the drawer too: picking what to see is asking to see it.
  const open = (face: TPlayerSoundFace) => {
    setSound({ face, isOpen: true });
    tabRefs.current[face]?.focus();
  };
  const onKeyDown = (event: KeyboardEvent<HTMLButtonElement>) => {
    const at = FACES.indexOf(sound.face);
    const step: Record<string, number> = {
      ArrowRight: (at + 1) % FACES.length,
      ArrowLeft: (at + FACES.length - 1) % FACES.length,
      Home: 0,
      End: FACES.length - 1,
    };
    const next = step[event.key];
    if (next === undefined) {
      return;
    }
    event.preventDefault();
    open(FACES[next]);
  };

  return (
    <section
      className={`player-eq player-sound${sound.isOpen ? '' : ' is-folded'}`}
      aria-label={t('player.eq.aria')}
    >
      <div className="player-eq__keys player-sound__head" ref={headRef}>
        {/* FluidEQ's own switch leads the row, ahead of what it switches
            (Ivan, 2026-11-27: "put the EQ power button to the left"). */}
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
        <div
          className="eq-layer-tabs__list player-sound__tabs"
          role="tablist"
          aria-label={t('eq.tabs.aria')}
        >
          {FACES.map((face) => (
            <button
              key={face}
              ref={(element) => {
                tabRefs.current[face] = element ?? undefined;
              }}
              type="button"
              role="tab"
              className="eq-layer-tabs__tab"
              aria-selected={sound.isOpen && sound.face === face}
              aria-controls={bodyId}
              tabIndex={sound.face === face ? 0 : -1}
              title={label[face]}
              onClick={() => open(face)}
              onKeyDown={onKeyDown}
            >
              <MenuIcon name={FACE_ICON[face]} className="eq-toolbar__icon" />
              <span className="eq-layer-tabs__word">{label[face]}</span>
              <span
                className={`eq-layer-tabs__meta${
                  face === 'tone' && !isToneOn ? ' is-off' : ''
                }`}
              >
                {meta[face]}
              </span>
            </button>
          ))}
        </div>
        <VoicingQuickPick />
        <button
          type="button"
          className="player-shelf__key player-sound__fold"
          aria-expanded={sound.isOpen}
          aria-controls={bodyId}
          aria-label={
            sound.isOpen ? t('player.sound.fold') : t('player.sound.unfold')
          }
          title={
            sound.isOpen ? t('player.sound.fold') : t('player.sound.unfold')
          }
          onClick={() => setSound({ isOpen: !sound.isOpen })}
        >
          <PlayerIcon
            name="fold"
            className="player-icon player-sound__chevron"
          />
        </button>
      </div>
      {/* A drawer that slides shut on the head and open again (Ivan,
          2026-10-25: "add nice animation on collapse expand"): the body stays
          laid out so it has a height to slide from, and is inert while shut,
          so nothing in it can be reached by the keyboard. */}
      <div
        className="player-sound__drawer"
        id={bodyId}
        role="tabpanel"
        inert={!sound.isOpen}
      >
        <div className="player-sound__body">
          {sound.face === 'tone' ? (
            <PlayerTone />
          ) : (
            <>
              <MiniBands />
              <BandsTools onOpenPage={onOpenPage} />
            </>
          )}
        </div>
      </div>
    </section>
  );
};

export default PlayerSound;
