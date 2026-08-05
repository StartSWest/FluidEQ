/*
<AQUA: System-wide parametric audio equalizer interface>
Copyright (C) <2023>  <AQUA Dev Team>
Copyright (C) <2026>  <FluidEQ multiple-output contributors>

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

/**
 * Route the already-running system capture to a second output.
 *
 * Equalizer APO cannot send audio anywhere — it filters an endpoint the audio
 * was already routed to. So a second speaker is fed the only way a renderer
 * can: take the loopback FluidEQ is already capturing for the spectrum, and
 * play it out of another sink. That costs 150-300ms and the UI has to say so.
 *
 * The capture is deliberately passed in rather than opened here. Windows only
 * offers loopback audio through `getDisplayMedia`, which also hands over a
 * full-resolution video track whether or not anything wants one; a second call
 * would mean a second of those, and the first one already cost a long session
 * and several gigabytes before anyone noticed. See `useLiveOutputSpectrum`.
 */

/**
 * The parts of an `<audio>` element this uses.
 *
 * Declared structurally rather than as `HTMLAudioElement` for two reasons:
 * `setSinkId` is not in every TypeScript DOM lib, and jsdom has neither it nor
 * Web Audio, so the rules below could not otherwise be tested at all.
 */
export interface IMirrorSink {
  srcObject: MediaStream | null;
  setSinkId(sinkId: string): Promise<void>;
  play(): Promise<void>;
  pause(): void;
}

/**
 * The two operations the mirror performs on the shared capture node.
 *
 * Written out rather than `Pick<AudioNode, ...>` because the real `connect`
 * returns the node it connected to, purely so calls can be chained. Nothing
 * here chains, and insisting on that return value is what stops a test double
 * from standing in.
 */
export interface IMirrorSource {
  connect(destination: AudioNode): unknown;
  disconnect(destination: AudioNode): unknown;
}

export interface IMirrorContext {
  createMediaStreamDestination(): MediaStreamAudioDestinationNode;
}

/**
 * Something spliced between the capture and the sink — in practice the
 * mirror's own equaliser, from `mirrorEq`.
 *
 * Structural for the same reason as everything else here: jsdom cannot build
 * an audio node, and the splicing is worth asserting.
 */
export interface IMirrorInsert {
  input: AudioNode;
  output: { connect(destination: AudioNode): unknown };
  dispose(): void;
}

export interface IOutputMirrorOptions {
  /** The context the capture is already living in. Not a new one. */
  context: IMirrorContext;
  /** The capture source node, shared with the analyser. */
  source: IMirrorSource;
  /** A Chromium sink id from the name bridge. Never `default`. */
  sinkId: string;
  /**
   * The mirror's own EQ. Omitted means the second device hears the primary
   * device's correction, which is wrong for it — acceptable only as a
   * deliberate "no profile assigned" case, never as a default.
   */
  eq?: IMirrorInsert;
  /** Injectable purely so the tests can watch what happens to it. */
  createSink?: () => IMirrorSink;
}

export interface IOutputMirror {
  readonly sinkId: string;
  stop(): void;
}

const createAudioSink = (): IMirrorSink =>
  // `Audio` is a plain element, not attached to the document: nothing renders
  // it and nothing needs to.
  new Audio() as unknown as IMirrorSink;

/**
 * Start mirroring, or throw without leaving anything running.
 *
 * The ordering here is the whole safety argument, so it is worth being explicit
 * about why it is what it is:
 *
 * - The chain ends at a `MediaStreamAudioDestinationNode`, **never** at
 *   `context.destination`. The context's destination is the default output,
 *   which is the endpoint being captured — connecting to it would feed the
 *   capture with its own output and build a howl-round with every pass, rather
 *   than merely playing the audio twice.
 * - `setSinkId` is awaited **before** `play`. An element that has not been
 *   pointed at a sink plays out of the default device, so playing first and
 *   routing second would put a burst of exactly that feedback into the user's
 *   ears on every start. If the sink cannot be selected, nothing plays at all.
 */
export const startOutputMirror = async ({
  context,
  source,
  sinkId,
  eq,
  createSink = createAudioSink,
}: IOutputMirrorOptions): Promise<IOutputMirror> => {
  if (!sinkId) {
    // Refusing beats guessing. An empty sink id would play out of whatever
    // Windows currently calls default, which is the one endpoint that must
    // never be the target.
    throw new Error('No output was chosen to mirror to.');
  }

  const destination = context.createMediaStreamDestination();
  const sink = createSink();
  // What the shared capture node feeds. With an EQ present the capture goes
  // into the filters and the filters into the stream; without one it goes
  // straight through. Either way the capture node itself is only ever
  // connected to this one thing, so detaching is a single disconnect and the
  // analyser's own branch is never touched.
  const head: AudioNode = eq ? eq.input : destination;
  let isConnected = false;

  const teardown = () => {
    sink.pause();
    sink.srcObject = null;
    if (isConnected) {
      source.disconnect(head);
      isConnected = false;
    }
    eq?.dispose();
  };

  try {
    source.connect(head);
    isConnected = true;
    eq?.output.connect(destination);
    sink.srcObject = destination.stream;
    await sink.setSinkId(sinkId);
    await sink.play();
  } catch (error) {
    teardown();
    throw error;
  }

  return {
    sinkId,
    stop: teardown,
  };
};
