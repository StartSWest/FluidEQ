/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>

This program is free software: you can redistribute it and/or modify
it under the terms of the GNU General Public License as published by
the Free Software Foundation, either version 3 of the License, or
(at your option) any later version.

This program is distributed in the hope that it will be useful,
but WITHOUT ANY WARRANTY; without even the implied warranty of
MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
GNU General Public License for more details.

You should have received a copy of the GNU General Public License
along with this program.  If not, see <https://www.gnu.org/licenses/>.
*/

import { useEffect, useRef } from 'react';
import {
  useLiveAudioCapture,
  useLiveAudioControl,
} from './audio/LiveAudioContext';
import meterUrl from './audio/headroom-meter.worklet';
import { useCurrentEngine } from './utils/audioEngineContext';
import { useFluidEqContext } from './utils/FluidEqContext';
import { sendSmartHeadroomMeasurement } from './utils/equalizerApi';
import ApoHeadroomSupervisor from './utils/apoHeadroomSupervisor';

/**
 * One part of the chain as text, spelled as it was inside the array this
 * used to serialise whole: a part that is absent reads as `null` there, so an
 * absent part that comes back as `null` is not an edit here either.
 */
const partText = (part: unknown): string => JSON.stringify(part) ?? 'null';

const SmartHeadroomEngine = () => {
  const engine = useCurrentEngine();
  const chain = useFluidEqContext();
  const {
    filters,
    graphicEq,
    eqMode,
    curveEqMode,
    eqBandQ,
    curveBandQ,
    curveSmoothing,
    isEqDoubleOn,
    driver,
    headphone,
    voicing,
    smartEq,
    convolution,
    customFx,
    bypassed,
  } = chain;
  /**
   * Each part of the chain as it stood at the last edit that counted, and its
   * text.
   *
   * This whole chain used to be serialised on every render — the headphone
   * correction, the custom file's bands and Smart EQ's among it — and the
   * context renders this with every band step, preamp change, selection and
   * hover. A part is now read as text only when its reference moves, and
   * still compared as text before it counts: `refreshState` hands every part
   * a new object whether or not anything in it changed, and each of those
   * counted as an edit would send the supervisor to reassess a chain nobody
   * touched.
   */
  const lastChain = useRef<{ parts: unknown[]; texts: string[] } | undefined>(
    undefined,
  );
  const runningSupervisor = useRef<ApoHeadroomSupervisor | undefined>(
    undefined,
  );
  const {
    isAutoPreAmpOn,
    isEnabled,
    smartHeadroomTrimDb,
    smartHeadroomProgramme,
  } = chain;
  const { capture, isActive } = useLiveAudioControl();
  const initial = useRef({
    trim: smartHeadroomTrimDb,
    programme: smartHeadroomProgramme,
  });
  initial.current = {
    trim: smartHeadroomTrimDb,
    programme: smartHeadroomProgramme,
  };
  const enabled = engine === 'apo' && isAutoPreAmpOn && isEnabled;
  useLiveAudioCapture(enabled, 'work');

  useEffect(() => {
    if (
      !enabled ||
      !isActive ||
      !capture ||
      capture.context.state === 'closed'
    ) {
      return undefined;
    }
    const { context } = capture;
    let acknowledgedAt = context.currentTime;
    const { trim: initialTrim = 0, programme } = initial.current;
    const clearProgramme = Boolean(programme?.length);
    const supervisor = new ApoHeadroomSupervisor(initialTrim, clearProgramme);
    runningSupervisor.current = supervisor;
    let disposed = false;
    let source: MediaStreamAudioSourceNode | undefined;
    let meter: AudioWorkletNode | undefined;
    let mute: GainNode | undefined;
    let cancelRequest: (() => void) | undefined;
    const start = async () => {
      await context.audioWorklet.addModule(meterUrl);
      if (disposed || context.state === 'closed') {
        return;
      }
      source = context.createMediaStreamSource(capture.source.mediaStream);
      meter = new AudioWorkletNode(context, 'fluideq-headroom-meter', {
        numberOfInputs: 1,
        numberOfOutputs: 1,
        outputChannelCount: [1],
        channelCountMode: 'max',
      });
      meter.port.onmessage = ({ data }: MessageEvent<unknown>) => {
        if (disposed || !data || typeof data !== 'object') {
          return;
        }
        const frame = data as {
          peakDbfs?: unknown;
          durationMs?: unknown;
          startedAt?: unknown;
        };
        if (
          typeof frame.peakDbfs !== 'number' ||
          typeof frame.durationMs !== 'number' ||
          typeof frame.startedAt !== 'number' ||
          !Number.isFinite(frame.startedAt) ||
          frame.startedAt < acknowledgedAt
        ) {
          return;
        }
        const trim = supervisor.observe(frame.peakDbfs, frame.durationMs);
        if (trim === undefined) {
          return;
        }
        cancelRequest = sendSmartHeadroomMeasurement([], trim, (applied) => {
          if (!disposed && applied) {
            acknowledgedAt = context.currentTime;
            supervisor.acknowledge(trim);
          }
        });
      };
      mute = context.createGain();
      mute.gain.value = 0;
      if (clearProgramme) {
        cancelRequest = sendSmartHeadroomMeasurement(
          [],
          initialTrim,
          (applied) => {
            if (!disposed && applied) {
              acknowledgedAt = context.currentTime;
              supervisor.acknowledge(initialTrim);
            }
          },
        );
      }
      source.connect(meter);
      meter.connect(mute);
      mute.connect(context.destination);
    };
    start().catch((error: unknown) => {
      console.error(
        'APO headroom measurement unavailable; static reserve remains active',
        error,
      );
    });
    return () => {
      disposed = true;
      if (runningSupervisor.current === supervisor) {
        runningSupervisor.current = undefined;
      }
      cancelRequest?.();
      source?.disconnect();
      mute?.disconnect();
      if (meter) {
        meter.port.onmessage = null;
        meter.port.close();
        meter.disconnect();
      }
    };
  }, [capture, enabled, isActive]);

  useEffect(() => {
    const parts = [
      filters,
      graphicEq,
      eqMode,
      curveEqMode,
      eqBandQ,
      curveBandQ,
      curveSmoothing,
      isEqDoubleOn,
      driver,
      headphone,
      voicing,
      smartEq,
      convolution,
      customFx,
      bypassed,
    ];
    const last = lastChain.current;
    const texts = parts.map((part, at) =>
      last && Object.is(part, last.parts[at]) ? last.texts[at] : partText(part),
    );
    if (last && texts.some((text, at) => text !== last.texts[at])) {
      runningSupervisor.current?.notifyEdit();
    }
    lastChain.current = { parts, texts };
  }, [
    filters,
    graphicEq,
    eqMode,
    curveEqMode,
    eqBandQ,
    curveBandQ,
    curveSmoothing,
    isEqDoubleOn,
    driver,
    headphone,
    voicing,
    smartEq,
    convolution,
    customFx,
    bypassed,
  ]);

  return null;
};

export default SmartHeadroomEngine;
