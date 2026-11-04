/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

import log from 'electron-log';
import {
  getDefaultState,
  IAudioDevice,
  IDeviceProfileSettings,
  IState,
} from '../common/constants';
import { clampDspSettings, IDspSettings } from '../common/dsp/chain';
import { appendPresetTone, encodeChainSettings } from '../common/dsp/chainWire';
import { presetToneOf } from '../common/dsp/presetTone';
import {
  ENGINE_READS_NONE,
  engineReadsOf,
  IEngineReads,
} from '../common/dsp/engineLine';
import { groupPlaysMatched } from '../common/filterDesign';
import {
  engineTakesOutputConfig,
  outputConfigGuid,
} from '../common/outputConfigFiles';
import {
  getStateForAudioDevice,
  IActiveStateOverride,
  TPresetDirForDevice,
} from './deviceProfiles';
import { outputDesignsOf } from './outputDesigns';
import { writeSystemDspChain } from './systemDspChain';

export interface IOutputDspFlush {
  configDirPath: string;
  settings: IDeviceProfileSettings;
  presetDirForDevice: TPresetDirForDevice;
  activeOverride?: IActiveStateOverride;
  /** Include the playback output, routed receivers and other known endpoints. */
  outputs?: readonly IAudioDevice[];
  isEnabled?: boolean;
  /** The file layout to prepare: never below 1.19, whatever is installed. */
  dllVersion?: string;
  /**
   * The engine actually installed (`IMainSession.installedEngineVersion`).
   * Footsteps needs 1.25; Dynamics needs 1.27. Unknown trailers are omitted
   * so an older engine can still run every stage it understands.
   */
  engineVersion?: () => Promise<string | undefined>;
  /** Latest audible rack: a song loan, live drag or the Library's rack gate. */
  dspOverrides?: ReadonlyMap<string, IDspSettings>;
  /** Audible EQ/layers for outputs whose editor is no longer selected. */
  stateOverrides?: ReadonlyMap<string, IState>;
  /** The Library runs the main rack in its host while receivers keep theirs. */
  systemRackEnabled?: (deviceId: string) => boolean;
}

interface IOutputSound {
  deviceId: string;
  state: IState;
}

/**
 * Which of the rack's newer trailers the installed engine reads — Footsteps
 * and Dynamics. Answered none where its version cannot be read, as the
 * rack message's own path answers: an older engine plays the rest of the
 * rack without a trailer, and none of it with one.
 *
 * Decided from the engine installed, never from `dllVersion`, the layout
 * prepared: that is 1.19 on every flush, so every output's rack lost
 * Footsteps and Isolate on an engine that runs both (2026-11-01).
 */
const installedEngineReads = async (
  engineVersion: IOutputDspFlush['engineVersion'],
): Promise<IEngineReads> => {
  try {
    return engineReadsOf(await engineVersion?.());
  } catch (error) {
    log.warn(
      'Writing the racks without their newer stages: no engine version',
      error,
    );
    return ENGINE_READS_NONE;
  }
};

/**
 * Rebuild every endpoint from its own sound on launch, engine switch or flush.
 * A missing rack is explicitly bypassed until migration supplies its value;
 * the old shared rack is never an implicit default for another output.
 */
export const flushOutputDsp = async ({
  configDirPath,
  settings,
  presetDirForDevice,
  activeOverride,
  outputs = [],
  isEnabled = true,
  dllVersion = '1.19',
  engineVersion,
  dspOverrides,
  stateOverrides,
  systemRackEnabled,
}: IOutputDspFlush): Promise<void> => {
  // No DLL before 1.19 reads endpoint files. Prepare the minimum supported
  // format even while an older DLL still plays its separate legacy rack.
  const outputVersion = engineTakesOutputConfig(dllVersion)
    ? dllVersion
    : '1.19';
  const sounds = new Map<string, IOutputSound>();
  const outputById = new Map(outputs.map((output) => [output.id, output]));
  const add = (deviceId: string, endpoint: string, state?: IState) => {
    const guid = outputConfigGuid(endpoint);
    if (guid) {
      sounds.set(guid, {
        deviceId,
        state:
          state ??
          stateOverrides?.get(deviceId) ??
          getStateForAudioDevice(settings, deviceId, presetDirForDevice),
      });
    }
  };

  Object.values(settings.assignments).forEach((assignment) =>
    add(
      assignment.deviceId,
      outputById.get(assignment.deviceId)?.guid || assignment.deviceGuid,
    ),
  );
  outputs.forEach((output) => {
    const guid = outputConfigGuid(output.guid);
    if (guid && !sounds.has(guid)) {
      add(output.id, guid, stateOverrides?.get(output.id) ?? getDefaultState());
    }
  });
  if (activeOverride) {
    const deviceId = activeOverride.deviceId ?? '';
    const guid =
      outputConfigGuid(activeOverride.devicePattern) ??
      outputConfigGuid(outputById.get(deviceId)?.guid ?? '') ??
      outputConfigGuid(settings.assignments[deviceId]?.deviceGuid ?? '');
    if (guid) {
      add(deviceId || guid, guid, activeOverride.state);
    }
  }

  // Capture and submit every snapshot before the first await. The endpoint
  // writer serializes its dependencies and rejects a superseded request, so
  // a slow room read cannot undo a newer rack edit on the same output.
  const writes = [...sounds].map(([guid, output]) => {
    const state = {
      ...output.state,
      // This is the app-wide master switch; cached output states may have
      // been captured while it was off and cannot keep their own stale copy.
      isEnabled,
    };
    const audibleDsp = dspOverrides?.get(output.deviceId) ?? state.dsp;
    const rack = clampDspSettings(audibleDsp ?? { enabled: false });
    rack.enabled =
      state.isEnabled &&
      audibleDsp !== undefined &&
      rack.enabled &&
      (systemRackEnabled?.(output.deviceId) ?? true);
    const designs = outputDesignsOf(state);
    const line = encodeChainSettings(rack);
    const values = rack.enabled
      ? appendPresetTone(
          line,
          presetToneOf(state, {
            eq: groupPlaysMatched(outputVersion, designs.trebleDesigns.eq),
            curves: groupPlaysMatched(
              outputVersion,
              designs.trebleDesigns.curves,
            ),
          }),
        )
      : line;
    // An engine before a stage refuses the line with its trailer and
    // bypasses the whole rack; without the trailer it plays the rest. Asked
    // in the write's own turn, so this call registers before any await.
    return writeSystemDspChain(configDirPath, values, guid, designs, () =>
      installedEngineReads(engineVersion),
    );
  });
  await Promise.all(writes);
};
