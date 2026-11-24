/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

/**
 * The Mic tab (Ivan, 2026-11-20): each microphone's own sound, played by the
 * FluidEQ Engine on the microphone itself so every app hears it.
 *
 * The header says only three things — which mic and whether it is live, a
 * picture of the voice, and the profile — and the stages sit on the DSP
 * page's own rail and cards below. The mic is always low lag, like game
 * mode, so the line under its name says what it adds.
 */

import { useState } from 'react';
import {
  isMicProfileId,
  micProfileGroup,
  MIC_PROFILE_IDS,
  TMicProfileGroup,
  TMicProfileId,
} from '../../common/mic/micProfiles';
import type { TranslationKey } from '../../common/i18n';
import MenuIcon from '../icons/MenuIcon';
import { attachFluidEngine } from '../utils/audioEngineApi';
import { useTranslation } from '../utils/I18nContext';
import { reportError } from '../utils/logger';
import { openWindowsSoundSettings } from '../utils/soundSettings';
import {
  useAudioEngineStatus,
  refreshAudioEngineStatus,
} from '../utils/useAudioEngineStatus';
import { useRailWidth } from '../library/LibraryRailSplitter';
import RichPick from '../widgets/RichPick';
import StudioRail, { useRailPinned } from '../widgets/StudioRail';
import {
  MIC_RAIL_INITIAL_WIDTH,
  MIC_RAIL_PINNED_KEY,
  MIC_RAIL_WIDTH_KEY,
} from './micRail';
import MicStage from './MicStage';
import MicStageRail, { micStageOn, TMicStage } from './MicStageRail';
import MicDelayReadout from './MicDelayReadout';
import MicMonitor from './MicMonitor';
import micStageSwitch from './micStageSwitch';
import useMicEngineHealth from './useMicEngineHealth';
import { DspPresetScopeProvider } from '../dsp/presetScope';
import MicVoicePicture from './MicVoicePicture';
import MicLiveBar from './MicLiveBar';
import useMicEffects from './useMicEffects';
import useMicLevels, { TMicListen } from './useMicLevels';
import useMicSound from './useMicSound';
import MicOwnEffectsCard from './MicOwnEffectsCard';
import useMicOwnEffects from './useMicOwnEffects';
import useWindowSeesMic from './useWindowSeesMic';

/**
 * Each profile's name and line, spelled out: the guard that finds keys no
 * code reads cannot see a key put together from an id.
 */
const PROFILE_WORDS: Record<
  TMicProfileId,
  { name: TranslationKey; hint: TranslationKey }
> = {
  stream: { name: 'mic.profile.stream', hint: 'mic.profile.stream.hint' },
  podcast: { name: 'mic.profile.podcast', hint: 'mic.profile.podcast.hint' },
  chat: { name: 'mic.profile.chat', hint: 'mic.profile.chat.hint' },
  sing: { name: 'mic.profile.sing', hint: 'mic.profile.sing.hint' },
  broadcast: {
    name: 'mic.profile.broadcast',
    hint: 'mic.profile.broadcast.hint',
  },
  noisy: { name: 'mic.profile.noisy', hint: 'mic.profile.noisy.hint' },
  meet: { name: 'mic.profile.meet', hint: 'mic.profile.meet.hint' },
  laptop: { name: 'mic.profile.laptop', hint: 'mic.profile.laptop.hint' },
  headset: { name: 'mic.profile.headset', hint: 'mic.profile.headset.hint' },
  singPlate: {
    name: 'mic.profile.singPlate',
    hint: 'mic.profile.singPlate.hint',
  },
  singHall: { name: 'mic.profile.singHall', hint: 'mic.profile.singHall.hint' },
  singRoom: { name: 'mic.profile.singRoom', hint: 'mic.profile.singRoom.hint' },
  streamAir: {
    name: 'mic.profile.streamAir',
    hint: 'mic.profile.streamAir.hint',
  },
  radio: { name: 'mic.profile.radio', hint: 'mic.profile.radio.hint' },
  phone: { name: 'mic.profile.phone', hint: 'mic.profile.phone.hint' },
  whisper: { name: 'mic.profile.whisper', hint: 'mic.profile.whisper.hint' },
  megaphone: {
    name: 'mic.profile.megaphone',
    hint: 'mic.profile.megaphone.hint',
  },
};

/** The profile picker's headings, by group. */
const PROFILE_GROUP_WORDS: Record<TMicProfileGroup, TranslationKey> = {
  use: 'mic.profile.group.use',
  mic: 'mic.profile.group.mic',
  singing: 'mic.profile.group.singing',
  fx: 'mic.profile.group.fx',
};

const MicGlyph = () => (
  <MenuIcon name="microphoneSettings" className="rich-pick__glyph" />
);

type TSetup = 'idle' | 'working' | 'declined' | 'failed';

/** The live line while the tab's own recording is not yet heard. */
const LISTEN_WORDS: Record<Exclude<TMicListen, 'live'>, TranslationKey> = {
  idle: 'mic.state.opening',
  opening: 'mic.state.opening',
  'no-input': 'mic.state.noInput',
  blocked: 'mic.state.blocked',
  waiting: 'mic.state.waiting',
};

/** What the set-up notice says under its title, after each press. */
const SETUP_WORDS: Record<TSetup, TranslationKey> = {
  idle: 'mic.setup.body',
  working: 'mic.setup.body',
  declined: 'mic.setup.declined',
  failed: 'mic.setup.failed',
};

const MicPage = () => {
  const { t } = useTranslation();
  // Asked again on every visit: the list it carries is Windows' at the
  // moment the helper ran, and one read mid-restart listed no mics at all.
  const { status } = useAudioEngineStatus();
  const sound = useMicSound();
  const windowSeesMic = useWindowSeesMic();
  const own = useMicOwnEffects(sound.mic);
  const { mic, microphones, entry } = sound;
  const [stage, setStage] = useState<TMicStage>('lowCut');
  const [setup, setSetup] = useState<TSetup>('idle');
  const railWidth = useRailWidth(MIC_RAIL_WIDTH_KEY, MIC_RAIL_INITIAL_WIDTH);
  const [isRailPinned, setRailPinned] = useRailPinned(MIC_RAIL_PINNED_KEY);
  const isFluid = status?.engine === 'fluid';
  const attached = isFluid && mic?.attached === true;
  const effects = useMicEffects(attached ? mic?.guid : undefined, status);
  // The tab records the mic only where the engine can be on it: attached,
  // and Windows' enhancements not known to be off.
  const listening = attached && effects !== 'off';
  // Recorded for as long as the tab shows the mic, not for as long as each
  // status read agrees it is attached: a read that disagreed for a moment
  // closed the recording and opened it again, and every reopen is Windows
  // building the mic's effect again. Not attached, nothing is processed and
  // the line says why; the recording itself harms nothing.
  const levels = useMicLevels(
    mic?.guid,
    mic?.name ?? '',
    mic !== undefined,
    status,
  );
  const live = listening && levels.state === 'live';
  // The engine's own word on the mic: its delay stage by stage, Windows'
  // block, how often the cleaner fell behind.
  const health = useMicEngineHealth(attached ? mic?.guid : undefined);
  const { settings } = entry;
  const { voice } = settings;
  const gateDb =
    voice?.enabled && voice.gateEnabled ? voice.gateThresholdDb : undefined;

  if (!mic) {
    return (
      <div className="mic-page mic-page--empty">
        {/* Unseen until the window has asked Windows for its devices, so
            neither sentence flashes before the right one. */}
        <div
          className="mic-empty"
          style={
            windowSeesMic === undefined ? { visibility: 'hidden' } : undefined
          }
        >
          <MenuIcon name="microphoneSettings" className="mic-empty__icon" />
          {windowSeesMic ? (
            <>
              <h2 className="mic-empty__title">{t('mic.empty.backTitle')}</h2>
              <p className="mic-empty__body">{t('mic.empty.backBody')}</p>
              <button
                type="button"
                className="button small subtle"
                onClick={() => {
                  refreshAudioEngineStatus().catch((error: unknown) =>
                    reportError('looking for the microphones again', error),
                  );
                }}
              >
                {t('mic.empty.lookAgain')}
              </button>
            </>
          ) : (
            <>
              <h2 className="mic-empty__title">{t('mic.empty.title')}</h2>
              <p className="mic-empty__body">{t('mic.empty.body')}</p>
            </>
          )}
        </div>
      </div>
    );
  }

  const profileId = isMicProfileId(entry.profileId)
    ? entry.profileId
    : undefined;
  const profileName = (id: TMicProfileId) => t(PROFILE_WORDS[id].name);
  const liveLine = (() => {
    if (!isFluid) {
      return t('mic.notFluid.title');
    }
    if (!attached) {
      return t('mic.notSetUp');
    }
    if (effects === 'off') {
      return t('mic.effectsOff.short');
    }
    if (levels.state === 'live') {
      return t('mic.live');
    }
    return t(LISTEN_WORDS[levels.state]);
  })();
  const lineTone = (() => {
    if (live) {
      return ' is-live';
    }
    if (
      effects === 'off' ||
      levels.state === 'no-input' ||
      levels.state === 'blocked'
    ) {
      return ' is-warn';
    }
    return '';
  })();

  // Each delay-adding stage's share, as the engine measures it.
  const delayOf = (stage: string) => {
    const latency = health?.latency;
    const part = latency?.parts.find((each) => each.stage === stage);
    return latency && part && latency.rate > 0
      ? (part.frames * 1000) / latency.rate
      : undefined;
  };
  const measured = (health?.latency?.rate ?? 0) > 0;
  const delays: Partial<Record<TMicStage, number>> | undefined = measured
    ? {
        denoise: delayOf('restoration'),
        deEsser: delayOf('deEsser'),
        maximizer: delayOf('maximizer'),
      }
    : undefined;
  const toggleStage = (id: TMicStage) => {
    if (id === 'own') {
      own.switchTo(!own.state.on);
      return;
    }
    if (id === 'lowCut') {
      sound.switchLowCut(!micStageOn(settings, 'lowCut'));
      return;
    }
    sound.patch(micStageSwitch(id, settings));
    sound.commit();
  };
  const toggleMaster = () => {
    sound.patch({ enabled: !settings.enabled });
    sound.commit();
  };

  const setUp = () => {
    setSetup('working');
    attachFluidEngine(mic.guid)
      .then((result) => {
        if (result.ok) {
          setSetup('idle');
          return refreshAudioEngineStatus();
        }
        setSetup(result.declined ? 'declined' : 'failed');
        return undefined;
      })
      .catch((error: unknown) => {
        reportError('setting the engine up on a microphone', error);
        setSetup('failed');
      });
  };

  return (
    // The DSP page's and the Gaming Lab's frame: the stages down the studio
    // rail every such page shares, and the page beside it on the card,
    // scrolling inside itself (Ivan, 2026-11-22: "the mic page doesn't have
    // the card bg").
    <div className="mic-page">
      <StudioRail
        rail={railWidth}
        isPinned={isRailPinned}
        onPinnedChange={setRailPinned}
        heading={t('mic.tab')}
      >
        <MicStageRail
          heading={mic.name}
          active={stage}
          settings={settings}
          onSelect={setStage}
          onToggle={toggleStage}
          onMaster={toggleMaster}
          delays={delays}
          latest={levels.latest}
          live={live}
          ownEffects={{ on: own.state.on, available: own.available }}
          onOwnToggle={() => own.switchTo(!own.state.on)}
        />
      </StudioRail>
      <div className="mic-page__main">
        <header className="mic-head">
          <div className="mic-head__who">
            <RichPick
              className="mic-head__pick"
              entries={microphones.map((each) => ({
                id: each.guid,
                name: each.name || each.guid,
                hint: each.attached ? t('mic.list.on') : t('mic.list.off'),
                group: 'mics',
                icon: <MicGlyph />,
              }))}
              groupLabel={() => t('mic.list.heading')}
              activeId={mic.guid}
              onPick={sound.select}
              placeholder={mic.name}
              placeholderIcon={<MicGlyph />}
              triggerAriaLabel={t('mic.label')}
              triggerTitle={t('mic.pickHint')}
            />
            <span className={`mic-head__live${lineTone}`} role="status">
              <span className="mic-head__lamp" aria-hidden="true" />
              {liveLine}
            </span>
          </div>
          <MicVoicePicture history={levels.history} gateDb={gateDb} />
          <div className="mic-head__sound">
            <RichPick
              className="mic-head__profile"
              entries={MIC_PROFILE_IDS.map((id) => ({
                id,
                name: profileName(id),
                hint: t(PROFILE_WORDS[id].hint),
                group: micProfileGroup(id),
                icon: <MicGlyph />,
              }))}
              groupLabel={(group) =>
                t(
                  PROFILE_GROUP_WORDS[group as TMicProfileGroup] ??
                    'mic.profile.group.use',
                )
              }
              activeId={profileId ?? ''}
              onPick={(id) => {
                if (isMicProfileId(id)) {
                  sound.pickProfile(id);
                }
              }}
              placeholder={
                profileId ? profileName(profileId) : t('mic.profile.label')
              }
              placeholderIcon={<MicGlyph />}
              triggerAriaLabel={t('mic.profile.label')}
              triggerTitle={t('mic.profile.pickHint')}
              triggerExtra={
                entry.tuned ? (
                  <span className="mic-head__tuned">
                    {t('mic.profile.tuned')}
                  </span>
                ) : undefined
              }
            />
            {entry.tuned && profileId && (
              <button
                type="button"
                className="button small subtle"
                onClick={() => sound.pickProfile(profileId)}
              >
                {t('mic.reset', { profile: profileName(profileId) })}
              </button>
            )}
          </div>
          <MicDelayReadout health={health} />
        </header>

        {listening && (
          <MicLiveBar
            key={mic.guid}
            latest={levels.latest}
            live={live}
            gateRangeDb={gateDb === undefined ? undefined : voice?.gateRangeDb}
            cleanerOn={micStageOn(settings, 'denoise')}
            makeupDb={
              settings.dynamics.enabled ? settings.dynamics.makeupDb : undefined
            }
            limiterOn={settings.maximizer.enabled}
          >
            <MicMonitor key={mic.guid} stream={levels.stream} />
          </MicLiveBar>
        )}
        {attached && effects === 'off' && (
          <div className="mic-notice" role="status">
            <p className="mic-notice__text">
              <strong>{t('mic.effectsOff.title', { mic: mic.name })}</strong>
              <span>{t('mic.effectsOff.body')}</span>
            </p>
            <button
              type="button"
              className="button small"
              onClick={openWindowsSoundSettings}
            >
              {t('mic.effectsOff.button')}
            </button>
          </div>
        )}
        {isFluid && !mic.attached && (
          <div className="mic-notice" role="status">
            <p className="mic-notice__text">
              <strong>{t('mic.setup.title', { mic: mic.name })}</strong>
              <span>{t(SETUP_WORDS[setup])}</span>
            </p>
            <button
              type="button"
              className="button small"
              disabled={setup === 'working'}
              onClick={setUp}
            >
              {setup === 'working'
                ? t('mic.setup.working')
                : t('mic.setup.button')}
            </button>
          </div>
        )}
        {!isFluid && (
          <div className="mic-notice" role="status">
            <p className="mic-notice__text">
              <strong>{t('mic.notFluid.title')}</strong>
              <span>{t('mic.notFluid.body')}</span>
            </p>
          </div>
        )}

        {/* The borrowed DSP cards offer the Mic tab's own presets. */}
        {stage === 'own' && (
          <div className="mic-stage dsp-stage">
            <MicOwnEffectsCard
              mic={mic}
              press={own.press}
              onSwitch={own.switchTo}
            />
          </div>
        )}
        {stage !== 'own' && (
          <DspPresetScopeProvider scope="mic">
            <MicStage
              stage={stage}
              settings={settings}
              isSystemWide={isFluid}
              lowCutKept={sound.entry.lowCutKept}
              onPatch={sound.patch}
              onCommit={sound.commit}
              onSwitchLowCut={sound.switchLowCut}
              latest={levels.latest}
              live={live}
            />
          </DspPresetScopeProvider>
        )}
      </div>
    </div>
  );
};

export default MicPage;
