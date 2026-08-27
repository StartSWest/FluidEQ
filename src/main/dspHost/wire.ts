/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

/**
 * The binary frames the native host speaks, from this side.
 *
 * The layouts are fixed by `native/dsp-host/src/wire.h`, where a `static_assert`
 * holds each size. These numbers are the same numbers written a second time,
 * because a TypeScript decoder cannot ask a C compiler what `sizeof` returned —
 * so if one of those assertions ever fails, this file is what changes.
 *
 * Little-endian throughout. Every platform FluidEQ ships on is little-endian
 * and the frames are memcpy'd on the other side; a big-endian port would need
 * a byte-swap on the host, not a second code path here.
 */

/** Must match FEQ_WIRE_PROTOCOL_VERSION. */
export const HOST_WIRE_PROTOCOL_VERSION = 1;

export const HANDSHAKE_BYTES = 104;
export const COMMAND_BYTES = 32;
export const ACK_BYTES = 32;
export const TELEMETRY_BYTES = 88;

export const MAGIC_HANDSHAKE = 0x48514546;
export const MAGIC_COMMAND = 0x43514546;
export const MAGIC_ACK = 0x41514546;
export const MAGIC_TELEMETRY = 0x54514546;

export const HOST_COMMANDS = {
  hello: 1,
  start: 2,
  stop: 3,
  setParameter: 4,
  applySnapshot: 5,
  runOfflineBlocks: 6,
  shutdown: 7,
  setDiagnosticSignal: 8,
  /** The whole chain, bands included. See `encodeChainSettings`. */
  applyChain: 9,
  loadDeck: 10,
  unloadDeck: 11,
  setPlaying: 12,
  seekDeck: 13,
  selectDeck: 14,
  crossfade: 15,
  setTrackGains: 16,
} as const;

/** `parameterId` for `setDiagnosticSignal`; `value` carries the frequency. */
export const DIAGNOSTIC_SIGNALS = {
  silence: 0,
  sine: 1,
} as const;

export type THostCommand = (typeof HOST_COMMANDS)[keyof typeof HOST_COMMANDS];

export const HOST_STATUS = {
  applied: 0,
  rejected: 1,
  unsupported: 2,
} as const;

export interface IHostHandshake {
  protocolVersion: number;
  parameterSchemaVersion: number;
  abiVersion: number;
  parameterCount: number;
  coreVersion: string;
  architecture: string;
  buildRevision: string;
  /** "wasapi-shared", or "unsupported" on a platform with no backend yet. */
  backend: string;
}

export interface IHostAck {
  status: number;
  requestId: number;
  acceptedRevision: number;
  appliedAtSampleFrame: number;
  sanitizedValue: number;
}

export interface IHostTelemetry {
  sequence: number;
  appliedRevision: number;
  framesProcessed: number;
  latencyFrames: number;
  peak: [number, number];
  callbackP50Us: number;
  callbackP99Us: number;
  /** Device periods that went unserved. Only the device thread can see these. */
  xruns: number;
  drops: number;
  repairedSamples: number;
  sampleRate: number;
  channels: number;
}

/** A C `char[]` is NUL-padded, not NUL-terminated when it exactly fits. */
const readFixedString = (
  view: DataView,
  offset: number,
  length: number,
): string => {
  const bytes = new Uint8Array(view.buffer, view.byteOffset + offset, length);
  const end = bytes.indexOf(0);
  return Buffer.from(bytes.subarray(0, end < 0 ? length : end)).toString(
    'utf8',
  );
};

export const encodeCommand = (command: {
  command: THostCommand;
  requestId: number;
  settingsRevision?: number;
  parameterId?: number;
  parameterIndex?: number;
  value?: number;
}): Buffer => {
  const frame = Buffer.alloc(COMMAND_BYTES);
  const view = new DataView(frame.buffer, frame.byteOffset, frame.byteLength);
  view.setUint32(0, MAGIC_COMMAND, true);
  view.setUint16(4, HOST_WIRE_PROTOCOL_VERSION, true);
  view.setUint16(6, command.command, true);
  view.setUint32(8, command.requestId, true);
  view.setUint32(12, command.settingsRevision ?? 0, true);
  view.setUint32(16, command.parameterId ?? 0, true);
  // -1 rather than 0 for "no index": 0 is band one, and a missing index that
  // decays to it silently edits the first band of the rack.
  view.setInt32(20, command.parameterIndex ?? -1, true);
  view.setFloat64(24, command.value ?? 0, true);
  return frame;
};

/** The doubles that follow an `applySnapshot` command, in table order. */
export const encodeSnapshotPayload = (values: readonly number[]): Buffer => {
  const payload = Buffer.alloc(values.length * 8);
  const view = new DataView(
    payload.buffer,
    payload.byteOffset,
    payload.byteLength,
  );
  values.forEach((value, at) => view.setFloat64(at * 8, value, true));
  return payload;
};

/**
 * The whole chain as a flat array of doubles, bands last.
 *
 * The same layout `chainParams` writes for the parity fixtures and
 * `feq_chain_settings_decode` reads at runtime. One layout rather than two: the
 * twenty-seven whole-chain fixtures push settings through that decoder against
 * the real worklet, so this is exercised by them rather than being a second
 * encoder that agrees with the first until a field is added to one of them.
 *
 * Everything before the bands sits at a fixed offset, which is why the lead is
 * asserted rather than assumed — a scalar added above and forgotten here would
 * push every band along by one and still decode into something plausible.
 */
export const CHAIN_PARAM_LEAD = 69;

export const encodeChainPayload = (values: readonly number[]): Buffer => {
  if (values.length < CHAIN_PARAM_LEAD) {
    throw new Error(
      `chain payload: ${values.length} values, expected at least ${CHAIN_PARAM_LEAD}`,
    );
  }
  return encodeSnapshotPayload(values);
};

/** Two doubles: the input gain and the master loudness gain, both in dB. */
export const encodeTrackGainsPayload = (
  inputGainDb: number,
  masterLoudnessGainDb: number,
): Buffer => encodeSnapshotPayload([inputGainDb, masterLoudnessGainDb]);

export const decodeHandshake = (frame: Buffer): IHostHandshake | undefined => {
  if (frame.length < HANDSHAKE_BYTES) {
    return undefined;
  }
  const view = new DataView(frame.buffer, frame.byteOffset, frame.byteLength);
  if (view.getUint32(0, true) !== MAGIC_HANDSHAKE) {
    return undefined;
  }
  return {
    protocolVersion: view.getUint32(4, true),
    parameterSchemaVersion: view.getUint32(8, true),
    abiVersion: view.getUint32(12, true),
    parameterCount: view.getUint32(16, true),
    coreVersion: readFixedString(view, 24, 24),
    architecture: readFixedString(view, 48, 16),
    buildRevision: readFixedString(view, 64, 24),
    backend: readFixedString(view, 88, 16),
  };
};

export const decodeAck = (frame: Buffer): IHostAck | undefined => {
  if (frame.length < ACK_BYTES) {
    return undefined;
  }
  const view = new DataView(frame.buffer, frame.byteOffset, frame.byteLength);
  if (view.getUint32(0, true) !== MAGIC_ACK) {
    return undefined;
  }
  return {
    status: view.getUint16(6, true),
    requestId: view.getUint32(8, true),
    acceptedRevision: view.getUint32(12, true),
    appliedAtSampleFrame: Number(view.getBigUint64(16, true)),
    sanitizedValue: view.getFloat64(24, true),
  };
};

export const decodeTelemetry = (frame: Buffer): IHostTelemetry | undefined => {
  if (frame.length < TELEMETRY_BYTES) {
    return undefined;
  }
  const view = new DataView(frame.buffer, frame.byteOffset, frame.byteLength);
  if (view.getUint32(0, true) !== MAGIC_TELEMETRY) {
    return undefined;
  }
  return {
    appliedRevision: view.getUint32(4, true),
    sequence: Number(view.getBigUint64(8, true)),
    framesProcessed: Number(view.getBigUint64(16, true)),
    latencyFrames: view.getUint32(24, true),
    peak: [view.getFloat32(32, true), view.getFloat32(36, true)],
    callbackP50Us: view.getFloat64(40, true),
    callbackP99Us: view.getFloat64(48, true),
    xruns: Number(view.getBigUint64(56, true)),
    drops: Number(view.getBigUint64(64, true)),
    repairedSamples: Number(view.getBigUint64(72, true)),
    sampleRate: view.getUint32(80, true),
    channels: view.getUint32(84, true),
  };
};

/**
 * How many bytes the frame starting here occupies, or 0 if it is unknown.
 *
 * The stream carries three different frame kinds at three different lengths,
 * so a reader cannot slice on a fixed stride. It reads the magic first and is
 * told how far the next one begins — and an unrecognised magic means the
 * stream has desynchronised, which is a fault to report rather than a byte to
 * skip past hoping to resynchronise on the next one.
 */
export const frameLengthFor = (magic: number): number => {
  switch (magic) {
    case MAGIC_HANDSHAKE:
      return HANDSHAKE_BYTES;
    case MAGIC_ACK:
      return ACK_BYTES;
    case MAGIC_TELEMETRY:
      return TELEMETRY_BYTES;
    default:
      return 0;
  }
};
