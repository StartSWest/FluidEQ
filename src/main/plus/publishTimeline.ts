/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

import type { IAuthorised } from './galleryApi';

/**
 * Where a publication's time went, as one line of the app's log (Ivan,
 * 2026-11-08: "can we increase publishing performance it takes a while",
 * "add logs to that too and server timings"). Nothing about a publication
 * was logged before, so "it takes a while" had no answer but the database's
 * own timestamps.
 *
 * Each phase is the time since the one before. The server's functions say
 * how long each of their own steps took in a Server-Timing header
 * (fluideq-premium `_shared/steptiming.ts`), which every request the
 * publication makes passes through `auth` to be kept, so the server's share
 * is on the same line as the app's. A server from before that header simply
 * adds nothing.
 *
 * The line carries the scene's id, which is public in the gallery, its
 * version, sizes and times: never the pack, a picture or a token. It goes
 * into bug reports.
 */

interface IPublishTimelineOptions {
  now?: () => number;
}

const seconds = (ms: number) =>
  ms >= 1000 ? `${(ms / 1000).toFixed(1)} s` : `${Math.round(ms)} ms`;

/** `auth;dur=120, sign;dur=40` as `auth 120 ms, sign 40 ms`. */
const readServerTiming = (header: string) =>
  header
    .split(',')
    .flatMap((entry) => {
      const [name, ...params] = entry.trim().split(';');
      const duration = params
        .map((param) => /^\s*dur=([\d.]+)\s*$/.exec(param))
        .find((match) => match !== null);
      return name && duration
        ? [`${name} ${seconds(Number(duration[1]))}`]
        : [];
    })
    .join(', ');

export const createPublishTimeline = ({
  now = () => performance.now(),
}: IPublishTimelineOptions = {}) => {
  const started = now();
  let last = started;
  const phases: string[] = [];
  const server: string[] = [];
  let scene: string | undefined;
  let detail: string | undefined;

  return {
    /** The time since the phase before, under this name. */
    phase: (name: string) => {
      const at = now();
      phases.push(`${name} ${seconds(at - last)}`);
      last = at;
    },
    /** What is being published, once it is known. */
    name: (sceneId: string, version: number, size?: string) => {
      scene = `${sceneId} v${version}`;
      detail = size;
    },
    /** The same authorisation, keeping each answer's Server-Timing. */
    timed: (auth: IAuthorised): IAuthorised => {
      const send = auth.fetchImpl ?? fetch;
      return {
        ...auth,
        fetchImpl: async (input, init) => {
          const response = await send(input, init);
          const header = response.headers.get('server-timing');
          if (header) {
            const url = new URL(
              typeof input === 'string' || input instanceof URL
                ? String(input)
                : input.url,
            );
            const fn = url.pathname.split('/').filter(Boolean).pop() ?? '';
            const steps = readServerTiming(header);
            if (steps) {
              server.push(`${fn}: ${steps}`);
            }
          }
          return response;
        },
      };
    },
    /** The whole line, ending in how it ended. */
    line: (outcome: string) =>
      [
        `Studio publish ${scene ?? '(no scene read)'}${detail ? ` (${detail})` : ''}: `,
        phases.join(', '),
        `; total ${seconds(now() - started)}; ${outcome}.`,
        server.length > 0 ? ` Server - ${server.join('; ')}.` : '',
      ].join(''),
  };
};

export type TPublishTimeline = ReturnType<typeof createPublishTimeline>;
