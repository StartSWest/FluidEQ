/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

/**
 * The native host's two decks, brought to what the Library player wants.
 *
 * The core's player (`libraryPlayer.ts`) says what should be playing — the
 * file, whether it plays, the fade to use if it changes, the next file to
 * hold ready — and this brings the host there. The window used to do this
 * beside hidden `<audio>` elements that kept a second clock; there are none
 * here: the host is the only clock now, and a file it cannot
 * open is handed back to the player (`onRefused`), which gives it to the
 * window's element to play instead.
 *
 * ONE STEP AT A TIME, AND THE LAST TRACK ASKED FOR IS THE ONE THAT PLAYS.
 *
 * Every track change used to start its own chain of host commands — load,
 * cue, fade — and nothing waited for the chain before it, so two presses
 * inside one round trip interleaved and whichever chain spoke last decided
 * what played. And the deck for each handoff was taken by alternating, which
 * is wrong while a fade runs: the active deck is the one a fade LEAVES until
 * it ends. Songs 1, 2, 3 clicked in a row loaded 3 over the deck still fading
 * out of 1, the fade asked for next was refused as a fade to itself, and 2
 * played while the player showed 3 (Ivan, 2026-09-23).
 *
 * So `sync` only records what the listener wants, and one worker brings the
 * host to it a step at a time, each finished before the next is chosen from
 * the newest wish: presses that land while the host is busy are answered by
 * the last of them, and a track skipped past before the host got to it costs
 * nothing. The deck is the host's to choose (`loadFor`), because only the
 * host knows whether its fade is over — and a track chosen inside a fade
 * fades in from silence at once while the one being heard goes out from
 * where it was (`feq_player_load`).
 */
import { CROSSFADE_CURVES } from '../../common/dsp/chain';
import { crossfadeShapeTable } from '../../common/dsp/crossfadeShape';
import type {
  IHostDeck,
  IHostDeckTransport,
  IHostDeckWant,
} from './hostDeckTypes';

type TTransition = NonNullable<IHostDeckWant['transition']>;
type TUpcoming = NonNullable<IHostDeckWant['upcoming']>;

const createHostDeck = (
  transport: IHostDeckTransport,
  events: {
    /**
     * Told whenever the host takes the track or lets it go. The rack follows
     * it: a track the host is not playing has no rack of the player's, and
     * the FluidEQ Engine has to keep its copy for it.
     */
    onOwnership: (hostOwns: boolean) => void;
    /**
     * A file the host could not open — a corrupt one, or a format its
     * decoder cannot read — and whether the listener wanted it playing.
     * Both decks are already emptied: in a handoff the other still held the
     * track being left, and a host that went on playing it under somebody
     * else's copy of the new one is two songs at once.
     */
    onRefused: (mediaPath: string, resume: boolean) => void;
    /**
     * The deck the host plays from now holds this file — the moment its
     * clock is this song's. Until then the telemetry still describes the
     * song before, and a fade judged on it would fade a song never started.
     */
    onActive: (mediaPath: string | undefined) => void;
  },
): IHostDeck => {
  /*
   * What the host has been told, changed only by the worker's steps — each
   * one describes the host as the last step left it, never a claim made
   * ahead of a command still on its way.
   */
  /** The track the host was last brought to, or is being brought to now. */
  let loadedPath: string | undefined;
  /**
   * What the host was last told about playing, not a note that it was once
   * started. The worker compares the listener against it, so a stale value
   * is silence: a deck loaded and the host never asked to play.
   */
  let playing = false;
  let hostOwns = false;
  const own = (owns: boolean) => {
    if (owns !== hostOwns) {
      hostOwns = owns;
      events.onOwnership(owns);
    }
  };
  /**
   * The deck the current track is on, as the host answered. Seeks are
   * addressed here, never to a literal: which deck a track lands on is the
   * host's choice.
   */
  let activeDeck = 0;
  /** The next track as last named to the host, which readies it itself. */
  let spareTold: TUpcoming | undefined;

  let wanted: IHostDeckWant | undefined;
  /** A seek the listener asked for, not yet sent, and who waits on it. */
  let seekWanted:
    { positionMs: number; settle: (applied: boolean) => void } | undefined;
  let released = false;
  let working = false;

  const giveUpTrack = async (
    mediaPath: string,
    resume: boolean,
  ): Promise<void> => {
    if (released) {
      return;
    }
    own(false);
    events.onActive(undefined);
    // The host lets go of the next track with its decks (UNLOAD_DECK).
    spareTold = undefined;
    playing = false;
    await transport.unload(0);
    await transport.unload(1);
    await transport.finishPlayback();
    events.onRefused(mediaPath, resume);
  };

  const preparePlayback = async (mediaPath: string): Promise<boolean> => {
    try {
      await transport.preparePlayback();
      return true;
    } catch {
      const resume = wanted?.isPlaying === true;
      await transport.finishPlayback(transport.pause()).catch(() => undefined);
      await giveUpTrack(mediaPath, resume);
      return false;
    }
  };

  /**
   * Cut to a track: the host taking over a song already under way, a track
   * change with no fade configured, or one while paused. On the deck the host
   * chooses, cued in the same command, then made heard.
   */
  const cue = async (
    mediaPath: string,
    isPlaying: boolean,
    positionMs: number,
  ): Promise<void> => {
    const deck = await transport.loadFor(
      'handoff',
      mediaPath,
      positionMs / 1_000,
    );
    if (deck === undefined) {
      await giveUpTrack(mediaPath, isPlaying);
      return;
    }
    if (released) {
      return;
    }
    activeDeck = deck;
    await transport.select(deck);
    if (released) {
      return;
    }
    events.onActive(mediaPath);
    /**
     * Told either way, and recorded either way. A cue that is not playing has
     * to leave the host stopped, or the next track inherits the previous one's
     * transport; and `playing` has to say what the host was told, or a play
     * that arrives a moment later agrees with a stale flag and is never sent.
     */
    if (isPlaying) {
      if (!playing && !(await preparePlayback(mediaPath))) {
        return;
      }
      if (
        released ||
        wanted?.isPlaying !== true ||
        wanted.mediaPath !== mediaPath
      ) {
        return;
      }
      await transport.play();
    } else {
      await transport.pause();
      await transport.finishPlayback();
    }
    if (released) {
      return;
    }
    playing = isPlaying;
    own(true);
  };

  /**
   * Fade to the incoming track, on the deck the host chooses: the free one,
   * or inside a running fade the quieter one, where the load alone makes the
   * new track what the fade goes to. With the host stopped there is nothing
   * to fade out of, and the new track only comes in.
   */
  const handoff = async (
    mediaPath: string,
    transition: TTransition,
  ): Promise<void> => {
    const { durationMs, curve, shape } = transition;
    const startPositionMs = transition.startPositionMs ?? 0;
    if (curve === 'custom') {
      // Before the load: a load into a running fade starts the new fade with
      // whatever shape is pending then, and so does the fade asked for next.
      await transport.setCrossfadeTable([
        ...crossfadeShapeTable(shape, false),
        ...crossfadeShapeTable(shape, true),
      ]);
    }
    // Cued in the same command, before the deck can be heard: a seek sent
    // after the fade has begun empties the incoming read-ahead ring, and the
    // refill is the crack heard on Next.
    const deck = await transport.loadFor(
      'handoff',
      mediaPath,
      startPositionMs / 1_000,
    );
    if (deck === undefined) {
      // A handoff happens only while the listener is playing.
      await giveUpTrack(mediaPath, true);
      return;
    }
    if (released) {
      return;
    }
    const index = CROSSFADE_CURVES.indexOf(curve);
    // A curve the host does not know is equal power, the panel's default,
    // rather than whatever index -1 lands on.
    await transport.crossfade(deck, durationMs, index >= 0 ? index : 0);
    if (released) {
      return;
    }
    activeDeck = deck;
    events.onActive(mediaPath);
    if (!playing) {
      if (!(await preparePlayback(mediaPath))) {
        return;
      }
      if (
        released ||
        wanted?.isPlaying !== true ||
        wanted.mediaPath !== mediaPath
      ) {
        return;
      }
      await transport.play();
    }
    if (released) {
      return;
    }
    playing = true;
    own(true);
  };

  /**
   * The one step that brings the host closest to what is wanted, or nothing.
   *
   * A change of track before anything else, because every other step is
   * about the track that plays; then the transport; then what the listener
   * asked of the playhead; then naming the next track, which nothing is
   * waiting on. Each claims what it is about to do before it returns, so a
   * step that fails is not asked for again on every pass after it.
   */
  const nextStep = (): (() => Promise<void>) | undefined => {
    const want = wanted;
    if (released || want === undefined) {
      return undefined;
    }
    if (want.mediaPath !== loadedPath) {
      const previous = loadedPath;
      const incoming = want.mediaPath;
      loadedPath = incoming;
      if (incoming === undefined) {
        return async () => {
          own(false);
          // An emptied deck is not playing, and the flag has to say so or the
          // next track that arrives already playing agrees with it and is
          // never started.
          playing = false;
          spareTold = undefined;
          events.onActive(undefined);
          // Both, because a fade leaves the previous track on the other deck.
          await transport.unload(0);
          await transport.unload(1);
          await transport.finishPlayback();
        };
      }
      const { transition } = want;
      if (previous !== undefined && want.isPlaying && transition) {
        return () => handoff(incoming, transition);
      }
      /**
       * Where the track starts. With nothing loaded before it, where the
       * player says: a restored session, or a song the host takes over part
       * way. Otherwise at its lead-in when it was readied as the next one
       * with it, and at zero if not.
       */
      let startMs = 0;
      if (previous === undefined) {
        startMs = want.positionMs;
      } else if (spareTold?.path === incoming) {
        startMs = spareTold.startPositionMs;
      }
      const { isPlaying } = want;
      return () => cue(incoming, isPlaying, startMs);
    }
    if (want.isPlaying !== playing && hostOwns) {
      const { isPlaying } = want;
      const mediaPath = loadedPath;
      playing = isPlaying;
      return async () => {
        if (isPlaying) {
          if (mediaPath === undefined || !(await preparePlayback(mediaPath))) {
            return;
          }
          if (released || wanted?.isPlaying !== true) {
            playing = false;
            return;
          }
          await transport.play();
        } else {
          await transport.pause();
          await transport.finishPlayback();
        }
      };
    }
    if (seekWanted !== undefined) {
      const request = seekWanted;
      seekWanted = undefined;
      return async () => {
        const applied = await transport
          .seek(activeDeck, request.positionMs / 1_000)
          // A host that is gone took nothing.
          .catch(() => false);
        request.settle(applied);
      };
    }
    /*
     * The next track, named once for each change of it and only while the
     * host is the one playing: the host readies it on the free deck itself.
     * The track playing now is never its own successor — repeat one restarts
     * in place — and the same file is not named twice.
     */
    const next = want.upcoming;
    if (
      hostOwns &&
      next !== undefined &&
      next.path !== want.mediaPath &&
      (next.path !== spareTold?.path ||
        next.startPositionMs !== spareTold.startPositionMs)
    ) {
      spareTold = next;
      return async () => {
        await transport.loadFor(
          'spare',
          next.path,
          next.startPositionMs / 1_000,
        );
      };
    }
    return undefined;
  };

  /**
   * Run steps until the host is where the listener wants it, one at a time,
   * each finished before the next is chosen: a wish that arrives while a
   * step is on its way is read when that step is done.
   */
  const work = async (): Promise<void> => {
    if (working) {
      return;
    }
    working = true;
    try {
      for (let step = nextStep(); step !== undefined; step = nextStep()) {
        try {
          // eslint-disable-next-line no-await-in-loop -- one step at a time is the point.
          await step();
        } catch {
          // A host that went away mid-step. The next pass decides afresh from
          // what is wanted, rather than this one retrying a command blind.
        }
      }
    } finally {
      working = false;
    }
  };

  return {
    sync: (want) => {
      if (released) {
        return;
      }
      const previous = wanted;
      wanted = want;
      if (previous !== undefined && previous.mediaPath !== want.mediaPath) {
        // A seek asked of the previous track is not this one's.
        seekWanted?.settle(false);
        seekWanted = undefined;
      }
      work().catch(() => undefined);
    },

    seek: (positionMs) =>
      new Promise<boolean>((resolve) => {
        if (released) {
          resolve(false);
          return;
        }
        // A newer seek overtakes one still waiting: only where the bar was
        // let go is worth sending.
        seekWanted?.settle(false);
        seekWanted = { positionMs: Math.max(0, positionMs), settle: resolve };
        work().catch(() => undefined);
      }),

    release: () => {
      if (released) {
        return;
      }
      released = true;
      seekWanted?.settle(false);
      seekWanted = undefined;
      loadedPath = undefined;
      playing = false;
      own(false);
      const stopped = transport.pause();
      transport.finishPlayback(stopped).catch(() => undefined);
      stopped.catch(() => undefined);
      // Both decks, because a crossfade leaves the previous track loaded on
      // the other one, a whole decoded read-ahead buffer for nobody.
      transport.unload(0).catch(() => undefined);
      transport.unload(1).catch(() => undefined);
      activeDeck = 0;
      spareTold = undefined;
    },
  };
};

export default createHostDeck;
