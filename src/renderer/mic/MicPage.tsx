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
  micRackDelayMs,
  TMicProfileId,
} from '../../common/mic/micProfiles';
import type { TranslationKey } from '../../common/i18n';
import DspStageCards from '../dsp/DspStageCards';
import { IRoomLive } from '../dsp/useRoomLive';
import MenuIcon from '../icons/MenuIcon';
import { attachFluidEngine } from '../utils/audioEngineApi';
import { useTranslation } from '../utils/I18nContext';
import { reportError } from '../utils/logger';
import { openWindowsSoundSettings } from '../utils/soundSettings';
import {
  refreshAudioEngineStatus,
  useKnownAudioEngineStatus,
} from '../utils/useAudioEngineStatus';
import RichPick from '../widgets/RichPick';
import MicStageRail, { TMicStage } from './MicStageRail';
import { MicCleanerCard, MicGateCard, MicLowCutCard } from './MicVoiceCards';
import MicVoicePicture from './MicVoicePicture';
import MicLiveBar from './MicLiveBar';
import useMicEffects from './useMicEffects';
import useMicLevels, { TMicListen } from './useMicLevels';
import useMicSound from './useMicSound';

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
};

/** The DSP cards' Room feed: a mic has no Room, so nothing is known of one. */
const NO_ROOM: IRoomLive = { state: 'unknown', channels: undefined };

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
  const status = useKnownAudioEngineStatus();
  const sound = useMicSound();
  const { mic, microphones, entry } = sound;
  const [stage, setStage] = useState<TMicStage>('lowCut');
  const [setup, setSetup] = useState<TSetup>('idle');
  const isFluid = status?.engine === 'fluid';
  const attached = isFluid && mic?.attached === true;
  const effects = useMicEffects(attached ? mic?.guid : undefined, status);
  // The tab records the mic only where the engine can be on it: attached,
  // and Windows' enhancements not known to be off.
  const listening = attached && effects !== 'off';
  const levels = useMicLevels(mic?.guid, mic?.name ?? '', listening);
  const live = listening && levels.state === 'live';
  const { settings } = entry;
  const { voice } = settings;
  const gateDb =
    voice?.enabled && voice.gateEnabled ? voice.gateThresholdDb : undefined;

  if (!mic) {
    return (
      <div className="mic-page mic-page--empty">
        <div className="mic-empty">
          <MenuIcon name="microphoneSettings" className="mic-empty__icon" />
          <h2 className="mic-empty__title">{t('mic.empty.title')}</h2>
          <p className="mic-empty__body">{t('mic.empty.body')}</p>
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
      return t('mic.live', { ms: Math.round(micRackDelayMs(settings)) });
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
    <div className="mic-page">
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
              group === 'mic'
                ? t('mic.profile.group.mic')
                : t('mic.profile.group.use')
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
      </header>

      {listening && (
        <MicLiveBar
          key={mic.guid}
          latest={levels.latest}
          live={live}
          gateDb={gateDb}
          makeupDb={
            settings.dynamics.enabled ? settings.dynamics.makeupDb : undefined
          }
          limiterOn={settings.maximizer.enabled}
          stream={levels.stream}
        />
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

      <div className="mic-body">
        <MicStageRail
          heading={mic.name}
          active={stage}
          settings={settings}
          onSelect={setStage}
        />
        <div className="mic-stage dsp-stage">
          {stage === 'lowCut' && voice && (
            <MicLowCutCard
              voice={voice}
              onPatch={(next) => sound.patch({ voice: next })}
              onCommit={sound.commit}
            />
          )}
          {stage === 'gate' && voice && (
            <MicGateCard
              voice={voice}
              onPatch={(next) => sound.patch({ voice: next })}
              onCommit={sound.commit}
            />
          )}
          {stage === 'denoise' && (
            <MicCleanerCard
              denoise={settings.denoise}
              onPatch={(next) => sound.patch({ denoise: next })}
              onCommit={sound.commit}
            />
          )}
          {stage !== 'lowCut' && stage !== 'gate' && stage !== 'denoise' && (
            <DspStageCards
              section={stage}
              settings={settings}
              onPatch={(next) => sound.patch(next)}
              onCommit={sound.commit}
              isSystemWide={isFluid}
              roomLive={NO_ROOM}
            />
          )}
        </div>
      </div>
    </div>
  );
};

export default MicPage;
