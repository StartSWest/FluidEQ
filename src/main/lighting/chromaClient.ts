/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

import http from 'http';
import { OFFICIAL_SITE_URL } from '../../common/branding';
import type { TSynapseState } from '../../common/lighting/lightingModel';
import {
  CHROMA_CHANNELS,
  type TChromaChannel,
} from '../../common/lighting/lampLayouts';
import { CHROMA_RESULT, chromaEffectBody } from './chromaEffects';

/**
 * Razer Chroma's local service, from the app's side.
 *
 * A separate program the app talks to over HTTP on this machine — nothing of
 * Razer's is linked or shipped — the door Razer opened for other apps to
 * light its devices. What the service does was measured against Razer Chroma
 * 4.0.821 rather than taken from its reference, which is wrong in places:
 *
 *  - A session lives 30 seconds past the last request of ANY kind, so a
 *    stream of effects keeps it alive and there is no heartbeat to run. Once
 *    the frames stop — music paused, a free look — Razer lets it lapse and the
 *    devices go back to the member's own lighting.
 *  - Its address refuses connections for 60–85 ms after it is handed out,
 *    and a session that has lapsed also refuses. Refusal after the first
 *    success is the signal to start again.
 *  - Every session registers the title as an app in Razer Chroma and copies a
 *    program for it into Razer's data folder. The title is therefore fixed
 *    forever: one "FluidEQ" entry, never one per launch.
 *  - Channels answer in about 15 ms each and in parallel, so each channel is
 *    its own lane: one request in flight, the newest frame waiting, older ones
 *    dropped.
 *
 * Nothing here counts down. Retries are counted in lighting frames, which
 * arrive only while there is something to light.
 */

export const CHROMA_BASE_URL = 'http://localhost:54235/razer/chromasdk';

interface IHttpReply {
  status: number;
  body: string;
}

/** Rejects when nothing answered at all — refused, reset, aborted. */
export type TChromaHttp = (
  method: 'GET' | 'POST' | 'PUT' | 'DELETE',
  url: string,
  body: string | undefined,
  signal: AbortSignal | undefined,
) => Promise<IHttpReply>;

const agent = new http.Agent({ keepAlive: true, maxSockets: 8 });

export const nodeChromaHttp: TChromaHttp = (method, url, body, signal) =>
  new Promise((resolve, reject) => {
    const request = http.request(
      url,
      {
        method,
        agent,
        signal,
        headers: body
          ? {
              'Content-Type': 'application/json',
              'Content-Length': Buffer.byteLength(body),
            }
          : undefined,
      },
      (response) => {
        let text = '';
        response.setEncoding('utf8');
        response.on('data', (chunk: string) => {
          if (text.length < 16_384) {
            text += chunk;
          }
        });
        response.on('end', () =>
          resolve({ status: response.statusCode ?? 0, body: text }),
        );
        response.on('error', reject);
      },
    );
    request.on('error', reject);
    request.end(body);
  });

const REGISTRATION = JSON.stringify({
  title: 'FluidEQ',
  description: 'Your devices take the colours of the scene playing in FluidEQ',
  author: { name: 'FluidEQ', contact: OFFICIAL_SITE_URL },
  device_supported: CHROMA_CHANNELS,
  category: 'application',
});

/** About five seconds of frames before asking a silent service again. */
const RETRY_FRAMES = 150;
/** About a second and a half for a new session's address to start answering. */
const WARMUP_FRAMES = 45;
/** About ten seconds before trying a channel Razer said has no device. */
const ABSENT_FRAMES = 300;

const readJson = (text: string): unknown => {
  try {
    return JSON.parse(text);
  } catch {
    return undefined;
  }
};

const resultOf = (text: string): number | undefined => {
  const parsed = readJson(text);
  return typeof parsed === 'object' &&
    parsed !== null &&
    'result' in parsed &&
    typeof (parsed as { result: unknown }).result === 'number'
    ? (parsed as { result: number }).result
    : undefined;
};

const uriOf = (text: string): string | undefined => {
  const parsed = readJson(text);
  if (typeof parsed !== 'object' || parsed === null || !('uri' in parsed)) {
    return undefined;
  }
  const { uri } = parsed as { uri: unknown };
  // Only ever this machine: an address from anywhere else is not Razer's.
  return typeof uri === 'string' && /^http:\/\/localhost:\d+\//.test(`${uri}/`)
    ? uri.replace(/\/+$/, '')
    : undefined;
};

export interface IChromaClient {
  /** Once per lighting frame, before that frame's `send`s. */
  frame(): void;
  send(channel: TChromaChannel, rgb: Uint8Array, keys?: Uint32Array): void;
  /** Hand the devices back: end the session now rather than letting it lapse. */
  release(): void;
  /** Whether the service answers, without starting a session. */
  probe(): void;
  state(): TSynapseState;
}

interface ILane {
  inFlight: boolean;
  waiting: { rgb: Uint8Array; keys?: Uint32Array } | undefined;
  absentFrames: number;
}

export const createChromaClient = (
  onState: (state: TSynapseState) => void,
  request: TChromaHttp = nodeChromaHttp,
): IChromaClient => {
  let state: TSynapseState = 'unknown';
  let session: { uri: string; abort: AbortController } | undefined;
  let warmupFrames = 0;
  let initialising = false;
  let retryFrames = 0;
  // Bumped whenever a session ends, so a reply from the old one cannot touch
  // the new one.
  let generation = 0;
  const lanes = new Map<TChromaChannel, ILane>(
    CHROMA_CHANNELS.map((channel) => [
      channel,
      { inFlight: false, waiting: undefined, absentFrames: 0 },
    ]),
  );

  const setState = (next: TSynapseState) => {
    if (next !== state) {
      state = next;
      onState(next);
    }
  };

  const endSession = () => {
    generation += 1;
    session?.abort.abort();
    session = undefined;
    lanes.forEach((lane) => {
      lane.inFlight = false;
      lane.waiting = undefined;
    });
  };

  const forget = (uri: string) => {
    request('DELETE', uri, undefined, undefined).catch(() => undefined);
  };

  const start = async () => {
    initialising = true;
    const mine = generation;
    let uri: string | undefined;
    try {
      uri = uriOf(
        (await request('POST', CHROMA_BASE_URL, REGISTRATION, undefined)).body,
      );
    } catch {
      initialising = false;
      retryFrames = RETRY_FRAMES;
      setState('not-running');
      return;
    }
    initialising = false;
    if (mine !== generation) {
      // Released while starting: end the session that was just made.
      if (uri) {
        forget(uri);
      }
      return;
    }
    if (!uri) {
      // Refused a session — too many apps, or a service in a state that will
      // not make one. Ask again later.
      retryFrames = RETRY_FRAMES;
      return;
    }
    session = { uri, abort: new AbortController() };
    warmupFrames = WARMUP_FRAMES;
  };

  const pump = async (channel: TChromaChannel): Promise<void> => {
    const lane = lanes.get(channel);
    const current = session;
    if (!lane || !current || lane.inFlight || !lane.waiting) {
      return;
    }
    const { rgb, keys } = lane.waiting;
    lane.waiting = undefined;
    lane.inFlight = true;
    const mine = generation;
    let body: string;
    try {
      ({ body } = await request(
        'PUT',
        `${current.uri}/${channel}`,
        chromaEffectBody(channel, rgb, keys),
        current.abort.signal,
      ));
    } catch {
      if (mine !== generation) {
        return;
      }
      lane.inFlight = false;
      // Still starting up, the next frame tries again; otherwise the session
      // lapsed or the service went away.
      if (warmupFrames === 0) {
        endSession();
      }
      return;
    }
    if (mine !== generation) {
      return;
    }
    lane.inFlight = false;
    warmupFrames = 0;
    const result = resultOf(body);
    if (result === CHROMA_RESULT.resourceDisabled) {
      setState('apps-off');
    } else {
      if (result === CHROMA_RESULT.deviceNotConnected) {
        lane.absentFrames = ABSENT_FRAMES;
      }
      setState('running');
    }
    await pump(channel);
  };

  return {
    frame: () => {
      if (retryFrames > 0) {
        retryFrames -= 1;
      }
      if (warmupFrames > 0) {
        warmupFrames -= 1;
      }
      lanes.forEach((lane) => {
        if (lane.absentFrames > 0) {
          lane.absentFrames -= 1;
        }
      });
      if (!session && !initialising && retryFrames === 0) {
        start().catch(() => undefined);
      }
    },
    send: (channel, rgb, keys) => {
      const lane = lanes.get(channel);
      if (!session || !lane || lane.absentFrames > 0) {
        return;
      }
      // Copied: the caller reuses its buffer for the next frame.
      lane.waiting = { rgb: rgb.slice(), keys: keys?.slice() };
      pump(channel).catch(() => undefined);
    },
    release: () => {
      const uri = session?.uri;
      endSession();
      retryFrames = 0;
      if (uri) {
        forget(uri);
      }
    },
    probe: () => {
      const ask = async () => {
        try {
          const reply = await request(
            'GET',
            CHROMA_BASE_URL,
            undefined,
            undefined,
          );
          if (state !== 'apps-off') {
            setState(reply.status === 200 ? 'running' : 'not-running');
          }
        } catch {
          setState('not-running');
        }
      };
      ask().catch(() => undefined);
    },
    state: () => state,
  };
};
