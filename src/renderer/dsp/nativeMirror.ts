/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

/**
 * The native engine shadowing the player, rather than replacing it.
 *
 * The obvious way to make the C++ path audible is to rip `<audio>` out of the
 * library player. It is also the wrong way, twice over.
 *
 * Wrong for the A/B, first: two paths that differ in their queue handling, their
 * position reporting and their gapless logic are not a comparison of two DSP
 * engines. Everything except the audio has to stay identical or the difference
 * being listened for is buried under a dozen others.
 *
 * And wrong for the risk: `LibraryPlayerContext` is two thousand lines of
 * transport, restore, crossfade and queue behaviour earned one bug at a time.
 * Rewriting it to prove a DSP port is a large change to code that is not what
 * is being ported.
 *
 * So the element keeps the jobs the host cannot do — the queue, the library,
 * the restore, the file it is on — and hands over the ones it can. The native
 * host is told the same file, the same position and the same play state, and
 * it makes the sound.
 *
 * It used to keep the CLOCK as well, muted but still running, and that was the
 * expensive half of the arrangement in two ways. It decoded every track a
 * second time for numbers nobody heard; and two clocks can disagree, which
 * they did — a deck cued at the position the previous track had reached played
 * from the middle while the seek bar read zero, each side telling the truth
 * about a different player.
 *
 * The host reports its deck's position, duration and state in telemetry now,
 * so the element is muted AND paused once a deck holds the track. It stays
 * loaded, because it is the fallback: a host that cannot open a file — a
 * corrupt one, or any file at all on a platform whose decoder and device
 * backend are not written yet — hands the sound straight back to a deck that
 * is already holding the bytes.
 *
 * The crossfade is mirrored too, and it is the one place where "shadow the
 * element" is not enough. The player's overlap runs two muted elements while
 * the native side has its own two decks, so a handoff that only synced
 * `mediaPath` reloaded the single deck in use and cut — the native engine had
 * no crossfade at all, on an engine whose crossfader was written and tested.
 * A track change while playing, with a fade configured, is a handoff here.
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
 * played while the player showed 3 — and clicking 3 again did nothing, the
 * mirror believing it loaded (Ivan, 2026-09-23).
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
import { watchElementClock } from './elementClock';
import { muteForMirror } from './mirrorElements';
import { INativeBackendController } from './nativeBackend';
import { INativeMirror, INativeMirrorState } from './nativeMirrorTypes';

type TTransition = NonNullable<INativeMirrorState['transition']>;
type TUpcoming = NonNullable<INativeMirrorState['upcoming']>;

const createNativeMirror = (
  controller: INativeBackendController,
  elements: readonly HTMLMediaElement[],
  /**
   * Told whenever the host takes the track or hands it back. The rack follows
   * it (`rackPlacement.ts`): a file the host could not open plays on the
   * elements, with no rack of their own, and the FluidEQ Engine has to keep
   * its copy for them — which it cannot know from `isPlaying` alone.
   */
  onOwnership?: (hostOwnsTransport: boolean) => void,
): INativeMirror => {
  const { standDown: standDownElements, handBack } = muteForMirror(elements);

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
   * is silence: a deck loaded, the elements stood down, and the host never
   * asked to play.
   */
  let playing = false;
  /** True once a native deck has loaded and the elements have stood down. */
  let hostOwnsTransport = false;
  const own = (owns: boolean) => {
    if (owns !== hostOwnsTransport) {
      hostOwnsTransport = owns;
      onOwnership?.(owns);
    }
  };
  /**
   * The deck the current track is on, as the host answered. Seeks are
   * addressed here, never to a literal: which deck a track lands on is the
   * host's choice (`loadFor`).
   */
  let activeDeck = 0;
  /** The next track as last named to the host, which readies it itself. */
  let spareTold: TUpcoming | undefined;
  // Full level, said once. The host keeps a level of its own for the elements
  // it stands in for, and the app no longer has one under the system's.
  controller.transport.setVolume(1).catch(() => undefined);

  /* What the listener wants, read afresh by the worker at every step. */
  let wanted: INativeMirrorState | undefined;
  /** A seek the listener asked for, not yet sent, and who waits on it. */
  let seekWanted:
    { positionMs: number; settle: (applied: boolean) => void } | undefined;
  /** A jump of the element's clock while it was still the authority. */
  let driftWanted: number | undefined;
  let released = false;
  let working = false;
  const clock = watchElementClock();

  /**
   * A track the host cannot play, handed to the elements whole.
   *
   * A format the native decoder cannot read: a corrupt file, or a platform
   * whose own decoder has not been written yet. Sitting in silence while
   * claiming to be the native engine is the worst of the options; handing
   * the sound back is the honest one. Both decks are emptied, not only the
   * one that refused it: in a handoff the other still holds the track being
   * left, and a host that went on playing it under the elements' copy of the
   * new one is two songs at once.
   */
  const giveUpTrack = async (resume: boolean): Promise<void> => {
    if (released) {
      // `release` has handed back and emptied the decks already.
      return;
    }
    own(false);
    // The host lets go of the next track with its decks (UNLOAD_DECK).
    spareTold = undefined;
    handBack(resume);
    await controller.transport.unload(0);
    await controller.transport.unload(1);
  };

  /**
   * Cut to a track: the engine switched on under a song already playing, a
   * track change with no fade configured, or one while paused.
   *
   * On the deck the host chooses, cued in the same command — the free deck,
   * which holds this track already when it was readied as the next one — and
   * then made heard, the track leaving going out under the host's short ramp.
   */
  const cue = async (
    mediaPath: string,
    isPlaying: boolean,
    positionMs: number,
  ): Promise<void> => {
    const deck = await controller.transport.loadFor(
      'handoff',
      mediaPath,
      positionMs / 1_000,
    );
    if (deck === undefined) {
      await giveUpTrack(isPlaying);
      return;
    }
    if (released) {
      return;
    }
    activeDeck = deck;
    await controller.transport.select(deck);
    // Released while the cut was on its way: `release` has paused the host,
    // and a play sent after it would start a transport nobody is listening to.
    if (released) {
      return;
    }
    /**
     * Told either way, and recorded either way. A cue that is not playing has
     * to leave the host stopped, or the next track inherits the previous one's
     * transport; and `playing` has to say what the host was told, or a play
     * that arrives a moment later agrees with a stale flag and is never sent.
     */
    if (isPlaying) {
      await controller.transport.play();
    } else {
      await controller.transport.pause();
    }
    if (released) {
      return;
    }
    playing = isPlaying;
    own(true);
    // Last, so nothing is stood down for a deck that turned out not to load.
    standDownElements(positionMs / 1_000);
  };

  /**
   * Fade to the incoming track, on the deck the host chooses.
   *
   * No fade running, that is the free deck and the fade goes out of what is
   * playing. Inside a fade it is the quieter deck, and the load alone makes
   * the new track what the fade goes to, from silence; the fade asked for
   * after it is the same fade, and changes nothing. With the host stopped
   * there is nothing to fade out of, and the new track only comes in.
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
      await controller.transport.setCrossfadeTable([
        ...crossfadeShapeTable(shape, false),
        ...crossfadeShapeTable(shape, true),
      ]);
    }
    // Cued in the same command, before the deck can be heard: a seek sent
    // after the fade has begun empties the incoming read-ahead ring, and the
    // refill is the crack heard on Next.
    const deck = await controller.transport.loadFor(
      'handoff',
      mediaPath,
      startPositionMs / 1_000,
    );
    if (deck === undefined) {
      // A handoff happens only while the listener is playing.
      await giveUpTrack(true);
      return;
    }
    if (released) {
      return;
    }
    const index = CROSSFADE_CURVES.indexOf(curve);
    await controller.transport.crossfade(
      deck,
      durationMs,
      // A curve the host does not know is equal power, which is the default the
      // panel offers, rather than whatever index -1 lands on.
      index >= 0 ? index : 0,
    );
    if (released) {
      return;
    }
    if (!playing) {
      // The fade was asked for with the host stopped, so it is this track
      // coming in alone; starting the transport is what lets it.
      await controller.transport.play();
    }
    if (released) {
      return;
    }
    activeDeck = deck;
    playing = true;
    own(true);
    // Both elements go quiet: the player runs its own overlap on them, and
    // there is nothing for either to be doing while the host fades its decks.
    standDownElements(startPositionMs / 1_000);
  };

  /** A track step done and nothing newer asked for: the clock is one again. */
  const settleClock = () => {
    if (loadedPath === wanted?.mediaPath) {
      clock.settle();
    }
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
          // Both, because a fade leaves the previous track on the other deck.
          await controller.transport.unload(0);
          await controller.transport.unload(1);
          settleClock();
        };
      }
      /**
       * A handoff, not a cut: one track replacing another while playing, with
       * a fade configured. Everything needed to tell the two apart is here.
       */
      const { transition } = want;
      if (previous !== undefined && want.isPlaying && transition) {
        return async () => {
          await handoff(incoming, transition);
          settleClock();
        };
      }
      /**
       * Where the track starts. The position arriving with a change of track
       * belongs to the track it replaced: `mediaPath` comes from the queue and
       * `positionMs` from the element, and on the tick that changes the track
       * the path is already the new song while the position is still the old
       * one's. Undefined `previous` means nothing was loaded and the engine is
       * being switched on under a song already playing — the one time the
       * incoming position is real. Otherwise the track starts at its lead-in
       * when it was readied as the next one with it, and at zero if not.
       */
      let startMs = 0;
      if (previous === undefined) {
        startMs = want.positionMs;
      } else if (spareTold?.path === incoming) {
        startMs = spareTold.startPositionMs;
      }
      const { isPlaying } = want;
      return async () => {
        await cue(incoming, isPlaying, startMs);
        settleClock();
      };
    }
    if (want.isPlaying !== playing) {
      const { isPlaying } = want;
      playing = isPlaying;
      return async () => {
        await (isPlaying
          ? controller.transport.play()
          : controller.transport.pause());
      };
    }
    if (seekWanted !== undefined) {
      const request = seekWanted;
      seekWanted = undefined;
      return async () => {
        const applied = await controller.transport
          .seek(activeDeck, request.positionMs / 1_000)
          // A host that is gone took nothing.
          .catch(() => false);
        request.settle(applied);
      };
    }
    if (driftWanted !== undefined) {
      const positionMs = driftWanted;
      driftWanted = undefined;
      return async () => {
        await controller.transport.seek(activeDeck, positionMs / 1_000);
      };
    }
    /*
     * The next track, named once for each change of it and only while the
     * host is the one playing: the host readies it on the free deck itself,
     * when there is one. The track playing now is never its own successor —
     * repeat one restarts in place — and the same file is not named twice.
     */
    const next = want.upcoming;
    if (
      hostOwnsTransport &&
      next !== undefined &&
      next.path !== want.mediaPath &&
      (next.path !== spareTold?.path ||
        next.startPositionMs !== spareTold.startPositionMs)
    ) {
      spareTold = next;
      return async () => {
        await controller.transport.loadFor(
          'spare',
          next.path,
          next.startPositionMs / 1_000,
        );
      };
    }
    return undefined;
  };

  /**
   * Run steps until the host is where the listener wants it.
   *
   * One at a time, each finished before the next is chosen: a wish that
   * arrives while a step is on its way is read when that step is done, so
   * the host is never told two things at once and the newest wish is always
   * the last one acted on.
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
    sync: (state) => {
      if (released) {
        return;
      }
      const previous = wanted;
      wanted = state;
      const now = performance.now();
      if (previous === undefined || previous.mediaPath !== state.mediaPath) {
        // A seek or a jump asked of the previous track is not this one's.
        seekWanted?.settle(false);
        seekWanted = undefined;
        driftWanted = undefined;
        // The first sync is the engine switched on under whatever the element
        // is playing, whose clock is real from here; any later change of
        // track waits until the host has it (`settleClock`).
        clock.rebase(state.positionMs, now, previous !== undefined);
      } else {
        driftWanted =
          clock.read(state.positionMs, now, playing, hostOwnsTransport) ??
          driftWanted;
      }
      work().catch(() => undefined);
    },

    seek: (positionMs: number) => {
      const target = Math.max(0, positionMs);
      clock.claim(target, performance.now());
      return new Promise<boolean>((resolve) => {
        if (released) {
          resolve(false);
          return;
        }
        // A newer seek overtakes one still waiting: only where the bar was let
        // go is worth sending.
        seekWanted?.settle(false);
        seekWanted = { positionMs: target, settle: resolve };
        work().catch(() => undefined);
      });
    },

    release: (resume) => {
      released = true;
      seekWanted?.settle(false);
      seekWanted = undefined;
      handBack(resume);
      loadedPath = undefined;
      playing = false;
      own(false);
      controller.transport.pause().catch(() => undefined);
      // Both decks, because a crossfade leaves the previous track loaded on the
      // other one and an unload of only the active deck would leave a whole
      // decoded read-ahead buffer alive for a track nobody is playing.
      controller.transport.unload(0).catch(() => undefined);
      controller.transport.unload(1).catch(() => undefined);
      activeDeck = 0;
      spareTold = undefined;
    },
  };
};

export default createNativeMirror;
