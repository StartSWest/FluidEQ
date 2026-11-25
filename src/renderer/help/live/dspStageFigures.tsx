/* Copyright (C) 2026 Ivan Carmenates Garcia. SPDX-License-Identifier: GPL-3.0-or-later */

import { DSP_DEFAULTS } from 'common/dsp/chain';
import { roomPresetSettings } from 'common/dsp/roomPresets';
import { NOISE_PROFILE_BANDS } from 'common/dsp/noiseProfile';
import DspDenoiseCard from '../../dsp/DspDenoiseCard';
import DspRoomCard from '../../dsp/DspRoomCard';
import type { IDspInputAnalysisState } from '../../dsp/meterStore';
import type { IRoomLive } from '../../dsp/useRoomLive';
import '../../styles/Dsp.scss';

/**
 * Two of the rack's stages for their own chapters (`helpChapters/dsp.ts`),
 * drawn by the cards the DSP page renders for them, each handed made-up
 * settings and a made-up report instead of the reader's rack and the
 * engine's live answer. Nothing is read from the reader's rack, and nothing
 * acts: the figure is inert (`HelpLiveSurface`).
 */

const nothing = () => undefined;

/**
 * A scanned Library track with hiss and a little 50 Hz hum: the floor rises
 * a decibel a band towards the treble, as tape hiss does, and the mains
 * fundamental and two partials stand over it.
 */
const SCANNED: IDspInputAnalysisState = {
  trackId: 'help-denoise',
  status: 'ready',
  fraction: 1,
  analysis: {
    version: 3,
    truePeakDbtp: -0.8,
    integratedLufs: -15.2,
    maxShortTermLufs: -11.6,
    noise: {
      bandsDb: Array.from(
        { length: NOISE_PROFILE_BANDS },
        (_, band) => -92 + band * 0.9,
      ),
      floorDbfs: -71.4,
      humHz: 50,
      humPartials: [
        { hz: 50, excessDb: 9.5 },
        { hz: 100, excessDb: 6 },
        { hz: 150, excessDb: 3.5 },
      ],
      clicksPerMinute: 4,
    },
  },
};

/**
 * Adaptive: a scanned floor waits for the engine's word that it holds one
 * (a live meter flag), and without it the card says the track has no saved
 * scan above the very readings that show it measured.
 */
const DENOISE = {
  ...DSP_DEFAULTS.denoise,
  enabled: true,
  profileSource: 'adaptive' as const,
  hum: { ...DSP_DEFAULTS.denoise.hum, enabled: true },
};

/**
 * The Denoise chapter's card: hiss and hum on, under Library playback, where
 * the card shows the track's source analysis beside the live readings.
 */
export function DenoiseDrawing() {
  return (
    <div className="dsp-panel">
      <div className="dsp-stage">
        <DspDenoiseCard
          denoise={DENOISE}
          isSystemWide={false}
          analysisState={SCANNED}
          model={{ state: 'ready', fraction: 1 }}
          onDownloadModel={nothing}
          onCancelModel={nothing}
          onRescan={nothing}
          onPatch={nothing}
          onCommit={nothing}
        />
      </div>
    </div>
  );
}

/**
 * A 7.1 game playing into the featured Game world room: every speaker on the
 * ring is fed, so none is drawn asleep.
 */
const ROOM = {
  ...roomPresetSettings({ ...DSP_DEFAULTS.room, enabled: true }, 'gameWorldV2'),
  enabled: true,
};
const SEVEN_ONE: IRoomLive = { state: '7.1', channels: 8 };

/** The Room chapter's card. */
export function RoomDrawing() {
  return (
    <div className="dsp-panel">
      <div className="dsp-stage">
        <DspRoomCard
          room={ROOM}
          live={SEVEN_ONE}
          onPatch={nothing}
          onCommit={nothing}
        />
      </div>
    </div>
  );
}
