/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

import { useCallback, useEffect, useRef, useState } from 'react';
import { IDspSettings, clampDspSettings } from '../../common/dsp/chain';
import { TranslationKey } from '../../common/i18n/en';
import DspBassForgeCard from './DspBassForgeCard';
import DspBassPunchCard from './DspBassPunchCard';
import { ProcessorCard } from './DspControls';
import DspEqBar from './DspEqBar';
import DspEqCard from './DspEqCard';
import DspCrossfadeCard from './DspCrossfadeCard';
import DspExciterCard from './DspExciterCard';
import DspDimensionCard from './DspDimensionCard';
import DspMasterCard from './DspMasterCard';
import DspMaximizerCard from './DspMaximizerCard';
import DspDenoiseCard, { IDspVoiceModelState } from './DspDenoiseCard';
import DspNormalizerCard from './DspNormalizerCard';
import DspRoomCard from './DspRoomCard';
import { roomLiveOf } from './useRoomLive';
import DspChainPresetBar from './DspChainPresetBar';
import DspHeldLock from './DspHeldLock';
import DspScopeNotice from './DspScopeNotice';
import GameModeSwitch from '../components/GameModeSwitch';
import LatencyReadout from '../components/LatencyReadout';
import TitleRate from '../components/TitleRate';
import DspSideTabs from './DspSideTabs';
import { rackSuspension, useRackGate } from './rackPlacement';
import { TDspSection } from './sections';
import { useTranslation } from '../utils/I18nContext';
import {
  refreshAudioEngineStatus,
  useKnownAudioEngineStatus,
} from '../utils/useAudioEngineStatus';
import {
  useListenedDelay,
  useListenedOutput,
} from '../utils/useListenedOutput';
import Switch from '../widgets/Switch';
import {
  TDspEngineState,
  requestDspNoiseRescan,
  publishSystemDspChain,
  useDspNativeState,
  useDspSampleRate,
  useDspInputAnalysis,
} from './store';
import '../styles/Dsp.scss';
import { masterLoudnessBreakdown } from './inputNormalizer';
import { readOpenDspSection, writeOpenDspSection } from './openSection';
import { useNativeMeters } from './useNativeBackend';
import { usePlaybackOwner } from '../audio/playbackOwner';
import { useTransportIdentitySources } from '../audio/transportSource';
import { useRemoteAudioRole } from '../remoteAudio/remoteAudioValueContext';

interface IDspPanelProps {
  settings: IDspSettings;
  /** Applied immediately, so a drag is audible while it happens. */
  onChange: (next: IDspSettings) => void;
  /** Called when a knob is released — this is where the value is saved. */
  onCommit: () => void;
  /**
   * What the engine is doing, in three states rather than two.
   *
   * `idle` is not a failure and must not read as one: the engine lives in
   * `LibraryPlayerProvider`, which does not mount until the Library has been
   * opened, so opening this tab first leaves it genuinely unstarted.
   */
  engineState: TDspEngineState;
  /**
   * Open the engine dialog from the scope notice.
   *
   * Optional because the dialog does not exist yet: the link renders only
   * once something can answer it, so the page never offers a control that
   * does nothing.
   */
  onOpenEngineDialog?: () => void;
}

/**
 * The five sections that own an isolate switch. Each id IS its settings key.
 *
 * One list rather than a branch per stage, because a branch per stage is what
 * shipped broken: the two clearing paths below named denoise, EQ and the
 * Exciter, and neither was extended when Bass Forge and Bass Punch grew
 * isolate switches of their own. Leaving either page with the monitor on left
 * the whole rack playing that stage's contribution and nothing else, with the
 * switch that did it out of sight.
 *
 * `readStored` in `store.ts` already drops all five on load, which is the
 * evidence this list is the one that fell behind rather than the other.
 */
const ISOLATING_SECTIONS = [
  'denoise',
  'eq',
  'exciter',
  'bassForge',
  'bassPunch',
] as const;

type TIsolatingSection = (typeof ISOLATING_SECTIONS)[number];

const isIsolatingSection = (id: TDspSection): id is TIsolatingSection =>
  (ISOLATING_SECTIONS as readonly TDspSection[]).includes(id);

const isSoloing = (of: IDspSettings) =>
  ISOLATING_SECTIONS.some((section) => of[section].isolate);

const withoutIsolate = (from: IDspSettings): IDspSettings => ({
  ...from,
  denoise: { ...from.denoise, isolate: false },
  eq: { ...from.eq, isolate: false },
  exciter: { ...from.exciter, isolate: false },
  bassForge: { ...from.bassForge, isolate: false },
  bassPunch: { ...from.bassPunch, isolate: false },
});

/**
 * The DSP chain's controls.
 *
 * The scope notice is visible text in the header rather than a tooltip, and
 * that is not decoration. Every other pill in the EQ group configures
 * Equalizer APO and therefore all system audio; this one processes only what
 * FluidEQ itself plays. A user who assumes otherwise does not report a
 * misunderstanding — they report the feature as broken.
 */
const DspPanel = ({
  settings,
  onChange,
  onCommit,
  engineState,
  onOpenEngineDialog,
}: IDspPanelProps) => {
  const { t } = useTranslation();
  // Which engine is carrying the audio, which decides whether the rack this
  // page edits runs on everything or only on the Library player. Read from
  // what the window holds rather than asked on every opening of the tab: each
  // ask ran the engine helper, a registry probe and a hash of the engine files
  // for the answer `AppContent` keeps current, and every action that changes
  // the engine re-reads it there.
  const audioEngine = useKnownAudioEngineStatus();
  const isSystemWide = audioEngine?.engine === 'fluid';
  useEffect(() => {
    // Opening this page under the engine is the moment to make sure the rack
    // on disk is the rack in this window. Everything else only sends when a
    // control moves, which is no help to a machine whose rack file was never
    // written or was written by a different installation.
    if (isSystemWide) {
      publishSystemDspChain();
    }
  }, [isSystemWide]);
  useEffect(() => {
    // `DeviceProfiles` raises this whenever Windows moves the default output,
    // and a reattach is also how this window finds out the engine itself
    // changed — main can switch engines while this tab is open, and nothing
    // else here would notice. Re-fetching is what lets `isSystemWide` above
    // flip and republish the rack.
    const onOutputChanged = () => {
      refreshAudioEngineStatus();
    };
    window.addEventListener('fluideq-output-changed', onOutputChanged);
    return () => {
      window.removeEventListener('fluideq-output-changed', onOutputChanged);
    };
  }, []);
  /**
   * Native analysis belongs to the surface that draws it.
   *
   * Keeping this beside the player left three FFTs, a scope capture, large
   * host frames and every meter-store write running while the DSP tab was not
   * mounted. This panel is mounted only while its tab is visible, so its
   * lifetime is the exact demand signal the host needs.
   */
  useNativeMeters();
  const {
    normalizer,
    denoise,
    crossfade,
    eq,
    exciter,
    bassForge,
    bassPunch,
    dimension,
    maximizer,
    master,
    room,
  } = settings;
  /**
   * Which channels the rack is actually on, which is not always the switch.
   *
   * The Room folds every channel of the output around the listener's head, so
   * it takes all of them however the switch is set — see `encodeChainSettings`,
   * which is where the rack itself is told. The header shows what is
   * happening rather than what was asked for.
   */
  const allChannels = settings.surround.allChannels || room.enabled;
  /** Why the switch reads as it does: the Room's reason comes first. */
  const surroundHint = (): TranslationKey => {
    if (room.enabled) {
      return 'dsp.surround.roomHint';
    }
    return allChannels ? 'dsp.surround.onHint' : 'dsp.surround.offHint';
  };
  const listened = useListenedOutput(isSystemWide);
  const roomLive = roomLiveOf(listened);
  const delay = useListenedDelay(listened);
  /**
   * The rate the filters will actually run at, from the engine.
   *
   * Not a nominal 48 kHz: the same shelf placed at 16 kHz behaves differently
   * at 44.1 than at 48, and that difference is precisely what a curve drawn
   * from coefficients exists to show. Drawing at a rate the audio is not using
   * would hide the one error the display is for.
   */
  const sampleRate = useDspSampleRate();
  const nativeState = useDspNativeState();
  const playingOwner = usePlaybackOwner();
  const sources = useTransportIdentitySources();
  // The role and not the whole Share Audio value, which changes with every
  // network sample and redrew this entire page four times a second while a
  // connection was up.
  const remoteAudioRole = useRemoteAudioRole();
  /**
   * Library playback wins even while Share Audio is listening: the receiver
   * role describes a connection, not the source feeding the native rack.
   * Requiring an ownership claim also locked out a paused/cued Library deck
   * and the gap before native playback publishes its claim. Keep that deck
   * editable unless another source has actually taken over. The Library's
   * published play state covers the native handoff without relying on DOM
   * events from its deliberately paused fallback element.
   */
  const hasLibraryPlayback =
    playingOwner === 'library' ||
    (playingOwner === undefined &&
      (sources.library?.isPlaying === true ||
        (sources.library !== undefined &&
          sources.system?.isPlaying !== true &&
          remoteAudioRole !== 'listener')));
  /**
   * Whether the rack a listener can actually turn on and off right now.
   *
   * Under FluidEQ Engine the chain runs inside audiodg.exe, independent of
   * whatever this window's Library deck is doing — the whole point of the
   * system-wide rack is that it keeps running with nothing playing. Gating it
   * on `hasLibraryPlayback` regardless of engine left every control on this
   * page — the preset bar, the master switch, the "Enabled" readout, every
   * stage — dimmed on a fresh window under the engine, while the pill above
   * them was already saying the rack ran on everything. Equalizer APO keeps
   * the original rule: that rack only exists inside the Library player's own
   * host, so it is live only while that host is actually engaged.
   */
  // And under the FluidEQ Engine, not while it is off: FluidEQ switched off
  // or the engine not running leaves the rack running nowhere, and a page
  // whose every control still answered would say otherwise.
  const suspension = rackSuspension(useRackGate());
  const isRackEngaged =
    suspension === undefined &&
    (isSystemWide || (hasLibraryPlayback && nativeState === 'engaged'));
  const isRackLive = settings.enabled && isRackEngaged;
  /**
   * Availability only gates the controls. The saved sound and host lifetime
   * survive a source change; tearing the engine down around a pause caused
   * multiplying processes and doubled audio.
   */
  const areControlsUsable = isRackLive;
  // No headroom meter here: it is published with every host frame, a hundred
  // times a second, and subscribing to it at this level re-rendered the
  // header, the rail and whichever processor was open on every one of them —
  // measured at 90–100 renders a second on every page, Master or not. The
  // Master page's graph, the one thing that shows it, reads it itself.
  const inputAnalysis = useDspInputAnalysis();
  const loudness = masterLoudnessBreakdown(
    master,
    normalizer,
    inputAnalysis.analysis,
  );
  // Which processor has the page. Local state: it is where the user is
  // looking, not part of the chain, and nothing outside this panel needs it.
  // Where it was left, not where the rack starts: see `openSection.ts`.
  const [section, setSection] = useState<TDspSection>(() =>
    readOpenDspSection('normalizer'),
  );
  const isStageDisabled =
    section === 'crossfade' ? !hasLibraryPlayback : !areControlsUsable;

  /**
   * The Voice model's download, which is a fact about the machine.
   *
   * Local rather than in the DSP store because it is not a setting and does
   * not travel to the engine: it is whether a file exists on this disk, and
   * the panel is the only thing that asks.
   */
  const [voiceModel, setVoiceModel] = useState<IDspVoiceModelState>({
    state: 'missing',
    fraction: 0,
  });

  /**
   * The two bridge calls this panel needs, each checked for individually.
   *
   * Not just "is there a bridge": this panel is rendered by tests that have no
   * preload at all AND by ones that supply a partial one, so the object being
   * present says nothing about the method being there. An absent call means
   * the model state is simply unknown, which is what `missing` already says —
   * no separate state, and no throw during a render.
   */
  const readModelState = window.electron?.ipcRenderer?.readDspDenoiseModelState;
  const downloadModel = window.electron?.ipcRenderer?.downloadDspDenoiseModel;

  useEffect(() => {
    if (typeof readModelState !== 'function') {
      return undefined;
    }
    let cancelled = false;
    readModelState()
      .then((present) => {
        if (!cancelled && present) {
          setVoiceModel({ state: 'ready', fraction: 1 });
        }
        return present;
      })
      .catch(() => undefined);
    return () => {
      cancelled = true;
    };
  }, [readModelState]);

  const downloadVoiceModel = useCallback(() => {
    if (typeof downloadModel !== 'function') {
      return;
    }
    setVoiceModel({ state: 'downloading', fraction: 0 });
    downloadModel((received, total) => {
      setVoiceModel({
        state: 'downloading',
        fraction: total > 0 ? received / total : 0,
      });
    })
      .then((ok) => {
        // `ok` is false when the bytes arrived but the engine has not taken
        // them yet — a host that is not running. The file is still on disk, so
        // the state is re-read rather than assumed failed.
        setVoiceModel(
          ok
            ? { state: 'ready', fraction: 1 }
            : { state: 'missing', fraction: 0 },
        );
        return ok;
      })
      .catch(() => setVoiceModel({ state: 'missing', fraction: 0 }));
  }, [downloadModel]);

  /**
   * Isolate is an audition state owned by the page that exposes its switch.
   *
   * Keep the latest external-store snapshot for the panel-unmount cleanup. A
   * user can leave the whole DSP workspace without first changing the local
   * section, and ordinary playback must be restored in that path too.
   */
  const latest = useRef({ settings, onChange, onCommit });
  latest.current = { settings, onChange, onCommit };
  useEffect(
    () => () => {
      const {
        settings: last,
        onChange: change,
        onCommit: commit,
      } = latest.current;
      if (!isSoloing(last)) {
        return;
      }
      change(withoutIsolate(last));
      commit();
    },
    [],
  );

  /** Every change passes through the shared settings trust boundary. */
  const patch = (next: Partial<IDspSettings>, preservePreset = false) =>
    onChange(
      clampDspSettings({
        ...settings,
        ...next,
        presetId: preservePreset ? settings.presetId : '',
      }),
    );

  /**
   * Clear the monitor before its control disappears behind another page.
   *
   * Gated on the section being LEFT owning the solo, not on any stage having
   * one: a solo can only be switched on from its own page, so the two are
   * almost always the same thing — but firing on the wider condition also
   * fires when a page is ENTERED, which puts a settings write in front of the
   * user's next click and changes what that click reports back.
   *
   * `preservePreset` is set, because leaving a page is not editing it. Without
   * it `patch` blanks the CHAIN's `presetId` — so switching tabs with a
   * monitor on marked the whole rack Custom. Each card's own Isolate switch
   * already bypasses `patch` for exactly this reason.
   */
  const selectSection = (next: TDspSection) => {
    if (next === section) {
      return;
    }
    if (isIsolatingSection(section) && settings[section].isolate) {
      patch(withoutIsolate(settings), true);
      onCommit();
    }
    setSection(next);
    writeOpenDspSection(next);
  };

  return (
    <div className="dsp-panel">
      <header className="dsp-header">
        <div className="dsp-header-line">
          <h2 className="dsp-title">
            {t('dsp.title')}
            {engineState === 'running' && isRackEngaged ? (
              <TitleRate rate={sampleRate} />
            ) : undefined}
          </h2>
          <DspChainPresetBar
            settings={settings}
            disabled={!isRackEngaged}
            onChange={onChange}
            onCommit={onCommit}
          />
          {/* The two switches of the whole rack, wrapped as one: at a narrow
              width they leave the first row together and stay at the right,
              where separately the power switch went to a row of its own at
              the left. The surround switch is beside the rack's own switch,
              not on the Master card: it is a setting of the whole rack —
              which channels of a surround output it runs on — and a card
              that is switched off with its stage would have taken it off
              with it. Its two words say which channels, the way the power's
              say on or off; the longer sentence is the tooltip. */}
          <div className="dsp-header-switches">
            {/* One capsule, the same one the equaliser's page wears: the
                switch is what moves the figure beside it, and standing apart
                — the switch up here and the delay down in the scope row —
                they read as two unrelated things rather than as a cause and
                its number. */}
            {isSystemWide ? (
              <div className="engine-strip">
                <GameModeSwitch
                  installedVersion={audioEngine?.fluid.dllVersion}
                  reportedGameMode={listened.output?.gameMode}
                />
                {delay ? (
                  <LatencyReadout
                    latency={delay.latency}
                    gameMode={delay.gameMode}
                  />
                ) : null}
              </div>
            ) : null}
            <div
              className="dsp-global-power dsp-surround"
              title={t(surroundHint())}
            >
              {/* Held by the Room, and said inside the group that is held:
                  see `DspHeldLock` for the two ways a sentence on a line of
                  its own got this wrong. */}
              {room.enabled ? <DspHeldLock /> : undefined}
              <span
                className={`dsp-global-power-state${
                  allChannels ? ' is-on' : ''
                }`}
                aria-hidden="true"
              >
                {allChannels
                  ? t('dsp.surround.allChannels')
                  : t('dsp.surround.frontPair')}
              </span>
              <Switch
                id="dsp-surround-all-channels"
                isOn={allChannels}
                // Held on, and held still, while the Room is running: it takes
                // every channel to place them around the head, so a switch
                // that still moved would be saying something the rack is not
                // doing. The stored choice is untouched and comes back when
                // the Room goes off.
                isDisabled={!isRackEngaged || room.enabled}
                handleToggle={() => {
                  patch({
                    surround: { allChannels: !settings.surround.allChannels },
                  });
                  onCommit();
                }}
                ariaLabel={t('dsp.surround.title')}
              />
            </div>
            <div className="dsp-global-power">
              <span
                className={`dsp-global-power-state${isRackLive ? ' is-on' : ''}`}
                aria-hidden="true"
              >
                {isRackLive ? t('dsp.enabled') : t('dsp.bypassed')}
              </span>
              <Switch
                id="dsp-global-toggle"
                isOn={isRackLive}
                isDisabled={!isRackEngaged}
                handleToggle={() => {
                  patch({ enabled: !settings.enabled }, true);
                  onCommit();
                }}
                ariaLabel={t('dsp.title')}
              />
            </div>
          </div>
        </div>
        <DspScopeNotice
          status={audioEngine}
          suspension={suspension}
          isRackEngaged={isRackEngaged}
          onOpenEngineDialog={onOpenEngineDialog}
        />
        {engineState === 'failed' ? (
          <p className="dsp-unavailable">{t('dsp.unavailable')}</p>
        ) : undefined}
        {/* In the header rather than in the Master card, where it used to be.
            The card is one of eight side-tab sections, so the notice was only
            ever seen by a user who happened to open Master — and a failure the
            listener cannot see is the failure being silent.

            `alert`, not `status`, and red rather than amber, because it is an
            error: every stage is off. It said the EQ, dynamics and limiter
            "still apply" long after `useDspEngine` made the worklet a permanent
            passthrough, so the one line whose whole job is to tell the listener
            what is happening to their music was the last thing still claiming
            there was a fallback.

            Suppressed when the browser audio graph has failed too, because
            then `dsp.unavailable` directly above says the same thing and two
            red paragraphs saying it twice is worse than one saying it once.

            And not under the FluidEQ Engine. There the rack runs in the engine
            and its controls stay live; a Library player whose own engine failed
            plays through its media elements while the engine keeps the rack
            running on that sound (see `rackPlacement.ts`). A line saying every
            stage is off and the controls are disabled was false twice over. */}
        {nativeState === 'failed' &&
        engineState !== 'failed' &&
        !isSystemWide ? (
          <p className="dsp-engine-down" role="alert">
            {t('dsp.engineDown')}
          </p>
        ) : undefined}
      </header>

      <div className="dsp-body">
        <DspSideTabs
          active={section}
          onSelect={selectSection}
          filtersDisabled={!areControlsUsable}
          playbackDisabled={!hasLibraryPlayback}
          enabled={{
            normalizer: normalizer.mode !== 'off',
            denoise: denoise.enabled,
            crossfade: crossfade.enabled,
            eq: eq.enabled,
            exciter: exciter.enabled,
            bassForge: bassForge.enabled,
            bassPunch: bassPunch.enabled,
            dimension: dimension.enabled,
            room: room.enabled,
            maximizer: maximizer.enabled,
            master: master.enabled,
          }}
        />

        <div
          className={`dsp-stage${isStageDisabled ? ' is-disabled' : ''}`}
          inert={isStageDisabled ? true : undefined}
          aria-disabled={isStageDisabled}
        >
          {section === 'normalizer' && (
            <DspNormalizerCard
              normalizer={normalizer}
              analysisState={inputAnalysis}
              onPatch={(next) => patch({ normalizer: next })}
              onCommit={onCommit}
            />
          )}

          {section === 'denoise' && (
            <DspDenoiseCard
              denoise={denoise}
              isSystemWide={isSystemWide}
              analysisState={inputAnalysis}
              model={voiceModel}
              onDownloadModel={downloadVoiceModel}
              onRescan={() => requestDspNoiseRescan(inputAnalysis.trackId)}
              onPatch={(next) => patch({ denoise: next })}
              onCommit={onCommit}
            />
          )}

          {section === 'crossfade' && (
            <DspCrossfadeCard
              crossfade={crossfade}
              // Playback transitions are independent from the selected rack
              // sound, so editing one does not turn the chain label Custom.
              onPatch={(next) => patch({ crossfade: next }, true)}
              onCommit={onCommit}
            />
          )}

          {section === 'eq' && (
            <ProcessorCard
              id="dsp-eq"
              titleKey="dsp.eq.title"
              isEnabled={eq.enabled}
              onToggle={() => {
                patch({
                  eq: { ...eq, enabled: !eq.enabled, isolate: false },
                });
                onCommit();
              }}
              beforePower={
                <div
                  className="dsp-monitor-isolate"
                  title={
                    eq.isolate ? t('dsp.eq.isolateOn') : t('dsp.eq.isolateHint')
                  }
                >
                  <span
                    className={`dsp-monitor-isolate-label${
                      eq.isolate ? ' is-on' : ''
                    }`}
                    aria-hidden="true"
                  >
                    {t('dsp.eq.isolate')}
                  </span>
                  <Switch
                    id="dsp-eq-isolate"
                    isOn={eq.isolate}
                    isDisabled={!eq.enabled}
                    handleToggle={() => {
                      patch({ eq: { ...eq, isolate: !eq.isolate } });
                      onCommit();
                    }}
                    ariaLabel={t('dsp.eq.isolate')}
                  />
                </div>
              }
              toolbar={
                <DspEqBar
                  eq={eq}
                  sampleRate={sampleRate}
                  onChange={(next) => patch({ eq: next })}
                  onCommit={onCommit}
                />
              }
            >
              <DspEqCard
                eq={eq}
                sampleRate={sampleRate}
                onChange={(next) => patch({ eq: next })}
                onCommit={onCommit}
              />
            </ProcessorCard>
          )}

          {section === 'exciter' && (
            <DspExciterCard
              exciter={exciter}
              onPatch={(next) => patch({ exciter: next })}
              onCommit={onCommit}
            />
          )}

          {section === 'bassForge' && (
            <DspBassForgeCard
              bassForge={bassForge}
              onPatch={(next) => patch({ bassForge: next })}
              onCommit={onCommit}
            />
          )}

          {section === 'bassPunch' && (
            <DspBassPunchCard
              bassPunch={bassPunch}
              onPatch={(next) => patch({ bassPunch: next })}
              onCommit={onCommit}
            />
          )}

          {section === 'dimension' && (
            <DspDimensionCard
              dimension={dimension}
              onPatch={(next) => patch({ dimension: next })}
              onCommit={onCommit}
            />
          )}

          {section === 'room' && (
            <DspRoomCard
              room={room}
              live={roomLive}
              onPatch={(next) => patch({ room: next })}
              onCommit={onCommit}
            />
          )}

          {section === 'maximizer' && (
            <DspMaximizerCard
              maximizer={maximizer}
              onPatch={(next) => patch({ maximizer: next })}
              onCommit={onCommit}
            />
          )}

          {section === 'master' && (
            <DspMasterCard
              master={master}
              loudness={loudness}
              onPatch={(next) => patch({ master: next })}
              onCommit={onCommit}
            />
          )}
        </div>
      </div>
    </div>
  );
};

export default DspPanel;
