/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

import { IDspSettings } from '../../common/dsp/chain';
import { useTranslation } from '../utils/I18nContext';
import Switch from '../widgets/Switch';
import DspBassForgeCard from './DspBassForgeCard';
import DspBassPunchCard from './DspBassPunchCard';
import { ProcessorCard } from './DspControls';
import DspCrossfadeCard from './DspCrossfadeCard';
import DspDeEsserCard from './DspDeEsserCard';
import DspDenoiseCard from './DspDenoiseCard';
import DspDimensionCard from './DspDimensionCard';
import DspDynamicsCard from './DspDynamicsCard';
import DspEqBar from './DspEqBar';
import DspEqCard from './DspEqCard';
import DspExciterCard from './DspExciterCard';
import DspFootstepsCard from './DspFootstepsCard';
import DspMasterCard from './DspMasterCard';
import DspMaximizerCard from './DspMaximizerCard';
import DspNormalizerCard from './DspNormalizerCard';
import DspRoomCard from './DspRoomCard';
import { masterLoudnessBreakdown } from './inputNormalizer';
import { TDspSection } from './sections';
import {
  requestDspNoiseRescan,
  useDspInputAnalysis,
  useDspSampleRate,
} from './store';
import { IRoomLive } from './useRoomLive';
import useVoiceModel from './useVoiceModel';

export interface IDspStageCardsProps {
  /** Which stage's card. */
  section: TDspSection;
  /** The rack the card edits: the DSP page's, or a game's own. */
  settings: IDspSettings;
  /**
   * An edit of the rack. `preservePreset` keeps the rack's preset name — a
   * playback transition is not part of the sound.
   */
  onPatch: (next: Partial<IDspSettings>, preservePreset?: boolean) => void;
  /** A control let go: where the value is saved. */
  onCommit: () => void;
  /** Under the FluidEQ Engine, where the rack runs on everything. */
  isSystemWide: boolean;
  /** What the engine says the Room is doing (`useDspPageRoomLive`). */
  roomLive: IRoomLive;
}

/**
 * One stage's card, for whichever surface edits a rack: the DSP page and
 * the Gaming tab render the same cards from here, so a stage has one editor
 * and not two (Ivan, 2026-11-02, the per-game sound). The host owns the page
 * around it — the rail, the header, the disabled state of the stage area.
 */
const DspStageCards = ({
  section,
  settings,
  onPatch,
  onCommit,
  isSystemWide,
  roomLive,
}: IDspStageCardsProps) => {
  const { t } = useTranslation();
  const {
    normalizer,
    denoise,
    deEsser,
    crossfade,
    eq,
    footsteps,
    exciter,
    bassForge,
    bassPunch,
    dimension,
    maximizer,
    master,
    room,
  } = settings;
  /**
   * The rate the filters will actually run at, from the engine. Not a
   * nominal 48 kHz: the same shelf placed at 16 kHz behaves differently at
   * 44.1 than at 48, and that difference is precisely what a curve drawn from
   * coefficients exists to show.
   */
  const sampleRate = useDspSampleRate();
  const inputAnalysis = useDspInputAnalysis();
  const voiceModel = useVoiceModel();

  switch (section) {
    case 'normalizer':
      return (
        <DspNormalizerCard
          normalizer={normalizer}
          analysisState={inputAnalysis}
          onPatch={(next) => onPatch({ normalizer: next })}
          onCommit={onCommit}
        />
      );
    case 'denoise':
      return (
        <DspDenoiseCard
          denoise={denoise}
          isSystemWide={isSystemWide}
          analysisState={inputAnalysis}
          model={voiceModel.model}
          onDownloadModel={voiceModel.download}
          onCancelModel={voiceModel.cancel}
          onRescan={() => requestDspNoiseRescan(inputAnalysis.trackId)}
          onPatch={(next) => onPatch({ denoise: next })}
          onCommit={onCommit}
        />
      );
    case 'deEsser':
      return (
        <DspDeEsserCard
          deEsser={deEsser}
          onPatch={(next) => onPatch({ deEsser: next })}
          onCommit={onCommit}
        />
      );
    case 'crossfade':
      return (
        <DspCrossfadeCard
          crossfade={crossfade}
          // Playback transitions are independent from the selected rack
          // sound, so editing one does not turn the chain label Custom.
          onPatch={(next) => onPatch({ crossfade: next }, true)}
          onCommit={onCommit}
        />
      );
    case 'eq':
      return (
        <ProcessorCard
          id="dsp-eq"
          titleKey="dsp.eq.title"
          isEnabled={eq.enabled}
          onToggle={() => {
            onPatch({ eq: { ...eq, enabled: !eq.enabled, isolate: false } });
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
                  onPatch({ eq: { ...eq, isolate: !eq.isolate } });
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
              onChange={(next) => onPatch({ eq: next })}
              onCommit={onCommit}
            />
          }
        >
          <DspEqCard
            eq={eq}
            sampleRate={sampleRate}
            onChange={(next) => onPatch({ eq: next })}
            onCommit={onCommit}
          />
        </ProcessorCard>
      );
    case 'footsteps':
      return (
        <DspFootstepsCard
          game={{ footsteps, room }}
          onPatch={(next) => onPatch(next)}
          onCommit={onCommit}
        />
      );
    case 'exciter':
      return (
        <DspExciterCard
          exciter={exciter}
          onPatch={(next) => onPatch({ exciter: next })}
          onCommit={onCommit}
        />
      );
    case 'bassForge':
      return (
        <DspBassForgeCard
          bassForge={bassForge}
          onPatch={(next) => onPatch({ bassForge: next })}
          onCommit={onCommit}
        />
      );
    case 'bassPunch':
      return (
        <DspBassPunchCard
          bassPunch={bassPunch}
          onPatch={(next) => onPatch({ bassPunch: next })}
          onCommit={onCommit}
        />
      );
    case 'dimension':
      return (
        <DspDimensionCard
          dimension={dimension}
          onPatch={(next) => onPatch({ dimension: next })}
          onCommit={onCommit}
        />
      );
    case 'room':
      return (
        <DspRoomCard
          room={room}
          live={roomLive}
          onPatch={(next) => onPatch({ room: next })}
          onCommit={onCommit}
        />
      );
    case 'dynamics':
      return (
        <DspDynamicsCard
          dynamics={settings.dynamics}
          onPatch={(next) => onPatch({ dynamics: next })}
          onCommit={onCommit}
        />
      );
    case 'maximizer':
      return (
        <DspMaximizerCard
          maximizer={maximizer}
          onPatch={(next) => onPatch({ maximizer: next })}
          onCommit={onCommit}
        />
      );
    case 'master':
      return (
        <DspMasterCard
          master={master}
          loudness={masterLoudnessBreakdown(
            master,
            normalizer,
            inputAnalysis.analysis,
          )}
          onPatch={(next) => onPatch({ master: next })}
          onCommit={onCommit}
        />
      );
    default:
      return null;
  }
};

export default DspStageCards;
