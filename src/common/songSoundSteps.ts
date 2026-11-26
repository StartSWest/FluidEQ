/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

import { ISongIdentity } from './songIdentity';
import {
  ISongSound,
  TSavedSound,
  sameSongSound,
  soundToPlay,
} from './songSound';
import {
  IAlbumSoundMatch,
  ISongSoundOwed,
  ISongSoundParts,
  ISongSoundSession,
  ISongSoundState,
  TSongSoundEffect,
  TSongSoundOwner,
} from './songSoundEvents';
import { SONG_EQ_SUSPEND_GRACE_MS } from './songEqTiming';
import { withoutWorking, workingOf } from './songSoundWorking';

/**
 * Each thing that can happen to Auto EQ's song and album sounds, as a step
 * from one state to the next with the effects it asks for — what
 * `reduceSongSound` (`songSoundRecorder.ts`, which says when a sound is
 * filed, lent and handed back) routes every event to. Pure, the clock passed
 * in.
 */

export type TStep = [ISongSoundState, TSongSoundEffect[]];

/**
 * Ask for a song's own sound, unless it is the one already playing under a
 * loan already held (`isHeld`). Without a loan it is asked for all the same,
 * whatever plays: what is not lent is the listener's own, and every change
 * made over it would be saved into their EQ.
 */
const lend = (
  state: ISongSoundState,
  sound: ISongSound,
  isHeld: boolean,
): TStep =>
  isHeld && state.live && sameSongSound(state.live, sound)
    ? [{ ...state, pending: undefined }, []]
    : [{ ...state, pending: sound }, [{ kind: 'apply', sound, isLent: true }]];

/**
 * Lend the listener's own sound to the song as it is: the song's saved sound
 * is theirs. Their own goes back on exactly as they left it where a loan is
 * held (another song's sound playing), and is lent from there, so a change
 * made while the song plays is the song's and never reaches their EQ (Ivan,
 * 2026-11-26). It used to be put on as theirs, with no loan, and every edit
 * made during such a song was saved straight into the listener's own EQ.
 */
export const lendAsOwn = (state: ISongSoundState, own: ISongSound): TStep => [
  { ...state, pending: own },
  [{ kind: 'apply', sound: own, isLent: true, asOwn: true }],
];

/**
 * Put the listener's own sound back, which ends the loan — always as an
 * `apply` that is not lent, so main puts back exactly what its loan took
 * (`putSongSoundOn` in `songSoundLoan.ts`): the bands' format, an import's
 * name, the preset's curve. Where what plays already looked like the
 * listener's own this used to be a `keep`, which ends the loan with what
 * plays; the likeness is read on the preset, the Tone and the bands alone, so
 * a song's curve could stay on the listener's sound.
 */
const handBackTo = (state: ISongSoundState, sound: ISongSound): TStep => [
  { ...state, pending: sound },
  [{ kind: 'apply', sound, isLent: false }],
];

/**
 * A song opened the moment it is named, on the same report the play bar draws
 * it from, and looked up then (Ivan, 2026-11-20: "is taking too much to detect
 * the new song to load the own song preset, despite we instantly can tell in
 * the bottom play bar"). It used to wait two seconds of holding still first,
 * Smart correction's settle — and that wait was moved on only by the players'
 * reports, so a song from another program, whose player republishes its
 * position seldom or never, put its sound on seconds late or not at all.
 * Looking a song up is a question to main; skipping through a queue of songs
 * with sounds costs a write each, and an answer about a song skipped past is
 * turned away by its key (`matched`).
 */
export const open = (
  state: ISongSoundState,
  identity: ISongIdentity,
): ISongSoundSession => ({
  identity,
  phase: 'playing',
  baseline: state.owed?.sound ?? state.pending ?? state.live,
  isLoaded: false,
});

/**
 * Settle a hand-back held over from the last song: the listener's own sound
 * goes back on, always (Ivan, 2026-11-20, mandatory: "The main user EQ is
 * untouchable; whatever the user does there, it needs to be restored").
 *
 * It used to be kept back wherever the sound had moved since it was held,
 * read as somebody taking the sound over — and two ordinary things move it in
 * that moment: the last step of a change made to the saved song reaching the
 * window just after the next song is named, and a saved song's own sound
 * landing just after it was skipped. Either way the saved song's sound was
 * kept (a `keep`, which made it the listener's) and played on into the song
 * with nothing saved, and from there into the next saved song's hand-back.
 * Something that really puts a sound on between songs — a profile loaded, a
 * game's sound — gives everything back before it does (`yield`), and an
 * output switch parks the hand-back with that output (`deviceChanged` in
 * `songSoundOutputs.ts`), so nothing is left here to tell apart.
 */
const settleOwed = (state: ISongSoundState, owed: ISongSoundOwed): TStep =>
  handBackTo({ ...state, owed: undefined }, owed.sound);

/** Ask what is kept for the open song, when it may play any of it. */
export const lookupOpen = (state: ISongSoundState): TSongSoundEffect[] => {
  const { session } = state;
  return state.isOn &&
    state.deviceId !== '' &&
    session?.phase === 'playing' &&
    !session.isLoaded
    ? [{ kind: 'lookup', identity: session.identity }]
    : [];
};

/**
 * End the session and hand back what it borrowed — now, or held for
 * `nextSong` to settle when one follows; a hand-back held for a song that is
 * gone before its answer is put on when nothing follows after all.
 * `handBack` is off for a switch of output, which brings its own sound.
 *
 * Nothing is filed here. A change made while a saved song plays used to be
 * kept for it by itself at its end, which nothing on screen said, and Clear
 * EQ pressed then saved the song flat; now a change is the song's only once
 * the listener presses Save changes (`saveNow`), and one left unsaved stays
 * behind with the song (Ivan approved, 2026-11-20).
 */
export const close = (
  state: ISongSoundState,
  { nextSong, handBack }: { nextSong: boolean; handBack: boolean },
): TStep => {
  const { session } = state;
  let next: ISongSoundState = { ...state, session: undefined };
  const effects: TSongSoundEffect[] = [];
  if (session) {
    if (handBack && session.handBack) {
      if (nextSong && state.isOn) {
        next = {
          ...next,
          owed: {
            sound: session.handBack,
            // Its saved sound plays on until the next song's answer is in.
            ...(session.owner && session.baseline && !session.isLoaded
              ? { from: { key: session.identity.key, over: session.baseline } }
              : {}),
          },
        };
      } else {
        const [handed, handedEffects] = handBackTo(next, session.handBack);
        next = handed;
        effects.push(...handedEffects);
      }
    }
  }
  const { owed } = next;
  if (!nextSong && handBack && owed) {
    const [settled, settledEffects] = settleOwed(next, owed);
    next = settled;
    effects.push(...settledEffects);
  }
  return [next, effects];
};

/** The pause grace: time passing, carried by any event. */
export const advance = (state: ISongSoundState, now: number): TStep => {
  const { session } = state;
  if (!session) {
    return [state, []];
  }
  if (
    session.phase === 'suspended' &&
    session.suspendedSince !== undefined &&
    now - session.suspendedSince >= SONG_EQ_SUSPEND_GRACE_MS
  ) {
    return close(state, { nextSong: false, handBack: true });
  }
  return [state, []];
};

/** The song's own sound taken off it, for this play. */
export const giveBack = (
  state: ISongSoundState,
  session: ISongSoundSession,
  extra: Partial<ISongSoundSession>,
): TStep => {
  if (!session.handBack) {
    return [
      { ...state, session: { ...session, owner: undefined, ...extra } },
      [],
    ];
  }
  const [handed, effects] = handBackTo(state, session.handBack);
  return [
    {
      ...handed,
      session: {
        ...session,
        ...extra,
        owner: undefined,
        baseline: session.handBack,
        handBack: undefined,
      },
    },
    effects,
  ];
};

/** Which saved sound plays, by the switches: the song's own, then its album's. */
const pick = (
  parts: ISongSoundParts,
  song: TSavedSound | undefined,
  album: IAlbumSoundMatch | undefined,
): { saved: TSavedSound; owner: TSongSoundOwner } | undefined => {
  if (parts.songs && song) {
    return { saved: song, owner: 'song' };
  }
  if (parts.albums && album) {
    return { saved: album.sound, owner: 'album' };
  }
  return undefined;
};

/**
 * The answer to a lookup, for the song it was asked about. The hand-back held
 * over from the last song is settled here either way: replaced by this
 * song's own sound, lent over it, or put on (`settleOwed`).
 *
 * Asked again while the song plays (`reconsider`, a switch), it starts from
 * the sound the song borrowed from, never from the saved sound it plays now.
 */
export const matched = (
  state: ISongSoundState,
  identity: ISongIdentity,
  song: TSavedSound | undefined,
  album: IAlbumSoundMatch | undefined,
  /** The answer to a pick made for this song or its album (`picked`). */
  isPick = false,
): TStep => {
  const { session } = state;
  if (!session || identity.key !== session.identity.key) {
    return [state, []];
  }
  const { owed } = state;
  // What the song would play with if it had no sound of its own: what it
  // borrowed from, the listener's own sound owed to it, or what was last asked
  // for and has not landed, or what plays. Never what the last saved song
  // played or was changed to.
  const before = session.handBack ?? owed?.sound ?? state.pending ?? state.live;
  const chosen =
    state.isOn && !session.isLoaded
      ? pick(state.parts, song, album)
      : undefined;
  // Nothing to hand back is nothing to lend against: the window has not heard
  // the sound yet, or it is one this memory does not cover.
  if (!chosen || !before) {
    if (session.handBack) {
      // It lost the sound it played: forgotten, or a switch turned off.
      return giveBack(state, session, {});
    }
    if (!owed) {
      return [{ ...state, session: { ...session, owner: undefined } }, []];
    }
    const [settled, effects] = settleOwed(state, owed);
    return [
      {
        ...settled,
        session: {
          ...session,
          owner: undefined,
          baseline: owed.sound,
        },
      },
      effects,
    ];
  }
  // The saved sound, and what plays: the song's working version where the
  // listener changed it and kept neither, shown as changed over the saved
  // one. A pick replaces both, and a working version made over a saved
  // sound changed since is dropped with it.
  const saved = soundToPlay(chosen.saved, before);
  const { key } = session.identity;
  const working = isPick ? undefined : workingOf(state, key, saved);
  const base = working ? state : withoutWorking(state, key);
  const sound = working ?? saved;
  if (
    session.handBack &&
    session.owner === chosen.owner &&
    state.live &&
    !state.pending &&
    sameSongSound(state.live, sound)
  ) {
    // Asked again and the answer is what already plays — a saved EQ the song
    // follows, updated with what plays: that is the saved sound now. Nothing
    // to put on, and no notice for a sound that did not change.
    return [{ ...base, session: { ...session, baseline: saved } }, []];
  }
  if (
    !isPick &&
    session.handBack &&
    session.owner === chosen.owner &&
    session.baseline &&
    sameSongSound(session.baseline, saved)
  ) {
    // Asked again (`reconsider`: something else was saved while it plays) and
    // the answer is the sound it already holds: nothing to put on. Lending it
    // again would undo a change the listener made over it since, which stays
    // offered for Save changes. Never for a pick: the listener just chose
    // this sound for this song or its album, over the change (`picked`).
    return [base, []];
  }
  const cleared: ISongSoundState = { ...base, owed: undefined };
  const lentTo = (next: ISongSoundState): ISongSoundState => ({
    ...next,
    session: {
      ...session,
      owner: chosen.owner,
      baseline: saved,
      handBack: before,
    },
  });
  if (sameSongSound(before, sound)) {
    // The song's sound is the listener's own: it goes on as theirs is, lent
    // all the same (`lendAsOwn`), with nothing to announce.
    const [lent, effects] = lendAsOwn(cleared, before);
    return [lentTo(lent), effects];
  }
  const [lent, effects] = lend(
    cleared,
    sound,
    session.handBack !== undefined || owed !== undefined,
  );
  const isNews =
    session.owner !== chosen.owner ||
    !session.baseline ||
    !sameSongSound(session.baseline, saved);
  return [
    lentTo(lent),
    isNews
      ? [
          ...effects,
          {
            kind: 'notice',
            identity: session.identity,
            owner: chosen.owner,
            sound,
            ...(chosen.owner === 'album' && album
              ? { albumTitle: album.title }
              : {}),
          },
        ]
      : effects,
  ];
};

/**
 * Everything a song borrowed, and anything held over for it, given back now
 * (switching the memory off, and something else putting a sound on).
 */
export const giveEverythingBack = (
  state: ISongSoundState,
  extra: Partial<ISongSoundSession>,
): TStep => {
  const { session, owed } = state;
  const [settled, owedEffects] = owed ? settleOwed(state, owed) : [state, []];
  if (!session) {
    return [settled, owedEffects];
  }
  const [next, effects] = giveBack(settled, session, extra);
  return [next, [...owedEffects, ...effects]];
};

export const nowPlaying = (
  input: ISongSoundState,
  identity: ISongIdentity | undefined,
  isPlaying: boolean,
  now: number,
): TStep => {
  const state: ISongSoundState = {
    ...input,
    playing: identity ? { identity, isPlaying } : undefined,
  };
  const { session } = state;
  if (!identity) {
    return close(state, { nextSong: false, handBack: true });
  }
  if (session && session.identity.key === identity.key) {
    if (isPlaying) {
      return [
        {
          ...state,
          session: {
            ...session,
            phase: 'playing',
            suspendedSince: undefined,
          },
        },
        [],
      ];
    }
    return [
      {
        ...state,
        session: {
          ...session,
          phase: 'suspended',
          suspendedSince: session.suspendedSince ?? now,
        },
      },
      [],
    ];
  }
  // Another song named is a next song, playing yet or not: the hand-back
  // waits for its answer either way. The Library names the next track before
  // it plays — `isPlaying` false for a moment at every change of track — and
  // handing the listener's sound back right then put it on ahead of a song
  // that had a sound of its own (Ivan, 2026-11-20: the next song of an album
  // set to Pop "loaded K-pop", his sound from before). A song that never
  // plays leaves it held until something does, or until nothing is named.
  const [closed, effects] = close(state, {
    nextSong: true,
    handBack: true,
  });
  const opened: ISongSoundState = {
    ...closed,
    session: isPlaying ? open(closed, identity) : undefined,
  };
  return [opened, [...effects, ...lookupOpen(opened)]];
};
