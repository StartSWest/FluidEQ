/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

import type { ISceneCamera } from './sceneCamera';
import type { IScenePack } from './scenePacks';
import type { ISceneWave } from './sceneWave';
import type { ISongMap } from './songMap';

/**
 * The Studio's agent door: what a member's AI assistant may ask FluidEQ over
 * MCP, and what passes between main and the window to answer it.
 *
 * Two questions only, the two things an assistant writing a shader cannot
 * do for itself: "show me the scene I am making" — it is drawn by FluidEQ, on
 * this computer's GPU — and "how does the song move" — the music plays here
 * and never reaches it. Everything else it needs is in the files it is
 * already editing.
 */

/**
 * The panel shapes a scene is asked to hold, as pictures of the sizes the
 * app actually gives it: a window, a phone-like column, a square tile, the
 * strip above the equaliser, and the thinnest band of a wide panel. Named
 * rather than free, so a caller cannot ask for a picture of any size it likes.
 */
export const STUDIO_AGENT_SHAPES = {
  wide: { width: 1280, height: 720 },
  tall: { width: 720, height: 1280 },
  square: { width: 960, height: 960 },
  strip: { width: 1600, height: 400 },
  ribbon: { width: 2400, height: 200 },
} as const;

export type TStudioAgentShape = keyof typeof STUDIO_AGENT_SHAPES;

export const isStudioAgentShape = (
  value: unknown,
): value is TStudioAgentShape =>
  typeof value === 'string' &&
  Object.prototype.hasOwnProperty.call(STUDIO_AGENT_SHAPES, value);

/**
 * What the scene hears before the picture: FluidEQ's own test music (a loud,
 * busy chorus, the same every time so two pictures can be compared), or
 * nothing at all, to see that the scene rests.
 */
export type TStudioAgentSound = 'music' | 'silence';

/** How far into the test music a picture may be taken, in seconds. */
export const STUDIO_AGENT_MIN_SECONDS = 0.5;
export const STUDIO_AGENT_MAX_SECONDS = 16;

/**
 * Seconds of silence before a picture of it, unless the caller asks for
 * another: long enough for every eased reading to have fallen to rest.
 */
export const STUDIO_AGENT_SILENCE_S = 4;

/** Where the pointer is for one picture: uv, origin at the bottom-left. */
export interface IStudioAgentPointer {
  x: number;
  y: number;
  pressed: boolean;
}

/** A tap for one picture: where, and how many seconds before the picture. */
export interface IStudioAgentTap {
  x: number;
  y: number;
  seconds: number;
}

/**
 * What the music was doing at a picture's instant, as the scene heard it:
 * uRhythm, uDrums and uSong, and the older readings beside them. An AI
 * tuning a dance can then tell which pose belongs to which part of the beat.
 */
export interface IStudioAgentMoment {
  beatPhase: number;
  barPhase: number;
  tempo: number;
  confidence: number;
  kick: number;
  snare: number;
  hat: number;
  intensity: number;
  build: number;
  drop: number;
  /** uSong.w: how many drops so far. */
  drops: number;
  /** uStereo: where the music leans, and how wide it is. */
  balance: number;
  width: number;
  level: number;
  beat: number;
  /** uMusicAccent.x. */
  accent: number;
  /** uVoice: how open the singer's mouth is, the note, how sure. */
  voiceOpen: number;
  voicePitch: number;
  voiceSure: number;
}

/** Every reading a moment carries, for whoever checks one. */
export const STUDIO_AGENT_MOMENT_KEYS: readonly (keyof IStudioAgentMoment)[] = [
  'beatPhase',
  'barPhase',
  'tempo',
  'confidence',
  'kick',
  'snare',
  'hat',
  'intensity',
  'build',
  'drop',
  'drops',
  'balance',
  'width',
  'level',
  'beat',
  'accent',
  'voiceOpen',
  'voicePitch',
  'voiceSure',
];

/** What main asks the window to draw. The pack is already the member's own. */
export interface IStudioAgentDrawAsk {
  id: number;
  pack: IScenePack;
  shape: TStudioAgentShape;
  sound: TStudioAgentSound;
  /**
   * Seconds into the sound. Absent: the first kick after the warm-up, the
   * moment every gallery picture is taken at.
   */
  seconds?: number;
  /** The test music's tempo, when not its own. */
  tempo?: number;
  wave: ISceneWave;
  /** The viewer's camera, already inside the scene's own limits. */
  camera?: ISceneCamera;
  pointer?: IStudioAgentPointer;
  tap?: IStudioAgentTap;
}

/**
 * Why a scene could not be drawn: it does not compile (with the driver's own
 * words), this computer refused it (it held or reset the GPU, or would take
 * far too long), or nothing here can draw scenes at all.
 */
export type TStudioAgentDrawFailure =
  | { ok: false; reason: 'compile'; log: string }
  | { ok: false; reason: 'gpu-reset' | 'context-lost' | 'too-heavy' }
  | { ok: false; reason: 'unavailable' };

export type TStudioAgentDrawAnswer =
  | {
      ok: true;
      /** A JPEG of the shape's size. */
      image: Uint8Array;
      width: number;
      height: number;
      /**
       * How long the GPU took to draw the kept frame, at `renderWidth` x
       * `renderHeight` — the picture's size and half again, brought down.
       */
      drawMs: number;
      renderWidth: number;
      renderHeight: number;
      /**
       * The band the scene was handed as `uSpectrumRect` for this picture,
       * worked out from the wave by the graph's own transform: an AI told
       * "height 0.25, position 0.6" cannot know that puts the band's middle
       * at 0.38, and its trial had to guess.
       */
      spectrumRect: readonly [number, number, number, number];
      moment: IStudioAgentMoment;
    }
  | TStudioAgentDrawFailure;

/**
 * Which song hear_the_music is asked about: the one playing, or the last one
 * heard; or the one before it (`songJournal.ts`).
 */
export const STUDIO_AGENT_SONGS = ['now', 'before'] as const;
export type TStudioAgentSong = (typeof STUDIO_AGENT_SONGS)[number];

/** What main asks the window when the member's AI wants to hear the music. */
export interface IStudioAgentHearAsk {
  id: number;
  song: TStudioAgentSong;
}

/**
 * The song's map (`songMap.ts`), or that none of it was heard; and either
 * way how many seconds of the other song were, so the AI can be told that
 * one is there to ask for.
 */
export type TStudioAgentHeardAnswer =
  | { ok: true; map: ISongMap; otherSeconds: number }
  | { ok: false; reason: 'no-sound'; otherSeconds: number };

/** What the Studio's card shows about the door. */
export interface IStudioAgentDoor {
  open: boolean;
  /** The address an assistant is given, while the door is open. */
  url?: string;
  /** The key an assistant is given, while the door is open. */
  key?: string;
  /** The door could not open; the member is told, never a code. */
  failed?: boolean;
}
