/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

/**
 * The stage the Mic tab's rail has chosen: the Voice stage's own cards for
 * the low cut, the cleaner and the gate, and the DSP page's cards, as they
 * are, for the rest.
 */

import type { IDspSettings } from '../../common/dsp/chain';
import type { IMicLowCutParts } from '../../common/micSound';
import DspStageCards from '../dsp/DspStageCards';
import type { IRoomLive } from '../dsp/useRoomLive';
import type { TMicStage } from './MicStageRail';
import MicCleanerCard from './MicCleanerCard';
import MicLevelCard from './MicLevelCard';
import MicReverbCard from './MicReverbCard';
import type { IMicLevel } from './useMicLevels';
import { MicGateCard, MicLowCutCard } from './MicVoiceCards';

/** The DSP cards' Room feed: a mic has no Room, so nothing is known of one. */
const NO_ROOM: IRoomLive = { state: 'unknown', channels: undefined };

interface IMicStageProps {
  stage: TMicStage;
  settings: IDspSettings;
  isSystemWide: boolean;
  /** The Low cut card's parts as its switch turned them off. */
  lowCutKept: IMicLowCutParts | undefined;
  onPatch: (next: Partial<IDspSettings>) => void;
  onCommit: () => void;
  onSwitchLowCut: (on: boolean) => void;
  /** The engine's latest reading on the mic, for the cards' live parts. */
  latest: React.MutableRefObject<IMicLevel | undefined>;
  live: boolean;
}

const MicStage = ({
  stage,
  settings,
  isSystemWide,
  lowCutKept,
  onPatch,
  onCommit,
  onSwitchLowCut,
  latest,
  live,
}: IMicStageProps) => {
  const { voice } = settings;
  return (
    <div className="mic-stage dsp-stage">
      {stage === 'lowCut' && voice && (
        <MicLowCutCard
          voice={voice}
          kept={lowCutKept}
          onPatch={(next) => onPatch({ voice: next })}
          onCommit={onCommit}
          onSwitch={onSwitchLowCut}
          live={live}
        />
      )}
      {stage === 'gate' && voice && (
        <MicGateCard
          voice={voice}
          onPatch={(next) => onPatch({ voice: next })}
          onCommit={onCommit}
          latest={latest}
          live={live}
        />
      )}
      {stage === 'level' && voice && (
        <MicLevelCard
          voice={voice}
          onPatch={(next) => onPatch({ voice: next })}
          onCommit={onCommit}
          latest={latest}
          live={live}
        />
      )}
      {stage === 'reverb' && (
        <MicReverbCard
          reverb={settings.reverb}
          onPatch={(next) => onPatch({ reverb: next })}
          onCommit={onCommit}
        />
      )}
      {stage === 'denoise' && (
        <MicCleanerCard
          settings={settings}
          onPatch={onPatch}
          onCommit={onCommit}
          latest={latest}
          live={live}
        />
      )}
      {stage !== 'lowCut' &&
        stage !== 'gate' &&
        stage !== 'level' &&
        stage !== 'reverb' &&
        stage !== 'own' &&
        stage !== 'denoise' && (
          <DspStageCards
            section={stage}
            settings={settings}
            onPatch={onPatch}
            onCommit={onCommit}
            isSystemWide={isSystemWide}
            roomLive={NO_ROOM}
          />
        )}
    </div>
  );
};

export default MicStage;
