/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

/**
 * The Studio's chat with the member's own Claude Code
 * (`main/studioChat/`): what the window is told and what it may ask.
 *
 * FluidEQ runs the Claude Code installed on this computer, unmodified, signed
 * in by the member through Anthropic's own sign-in. It never reads, keeps or
 * passes on that sign-in, never pays for or meters the member's use, and
 * nothing runs unless the member typed or pressed something — Anthropic's
 * conditions for running Claude Code inside a product
 * (code.claude.com/docs/en/legal-and-compliance, 2026-10-09).
 */

import type { IStudioChatLimitHit, TStudioChatFailure } from './studioChatStop';
import { isStudioChatModel, type TStudioChatModel } from './studioChatModel';

// The chat's models live beside it, and are reached through it as before.
export * from './studioChatModel';

/** Whether the chat can be used on this computer, and why not. */
export type TStudioChatAvailability =
  | { state: 'checking' }
  | { state: 'missing' }
  | { state: 'signed-out' }
  | {
      state: 'ready';
      /** The member's plan as Claude Code names it ("pro", "max"), if it says. */
      plan?: string;
      /**
       * The Claude account Claude Code is signed in to, as it reports it, so
       * the member can see whose plan the chat runs on (Ivan, 2026-10-13: "I
       * need to know in studio which claude account and gpt account is
       * logged in"). Shown, never kept or sent anywhere.
       */
      email?: string;
    };

/** One thing Claude did on the way to an answer, as the chat shows it. */
export interface IStudioChatStep {
  id: string;
  kind:
    | 'look'
    | 'hear'
    | 'read'
    | 'write'
    | 'search'
    /** A picture that appeared in the project's art folder. */
    | 'picture'
    /** One of Higgsfield's tools is making something. */
    | 'make'
    | 'pack'
    | 'animation'
    /** `pose_sheet` or `build_sheet` made an animation's frames. */
    | 'sheet'
    | 'compact'
    | 'other';
  /** The file it read or wrote, by name only, never a path. */
  file?: string;
  state: 'running' | 'done' | 'failed';
  /**
   * What a look saw, a JPEG data URL small enough to keep with the chat
   * (Ivan, 2026-10-09: "so I can see all the time what is looking at").
   */
  picture?: string;
  /**
   * A compaction's size, before and after, in tokens: Claude Code shrinking
   * the conversation into a summary so it can go on (Ivan, 2026-10-14: "we
   * also need to add the compact feature for the chat").
   */
  tokens?: { before: number; after: number };
}

export type { TStudioChatFailure };

export type TStudioChatEntry =
  | {
      kind: 'me';
      id: string;
      text: string;
      /** The picture of the stage that went with it, a JPEG data URL. */
      picture?: string;
    }
  | {
      kind: 'claude';
      id: string;
      text: string;
      steps: IStudioChatStep[];
      state: 'working' | 'done' | 'stopped' | 'failed';
      /** Why it stopped short, where it failed (`studioChatStop.ts`). */
      failure?: TStudioChatFailure;
      /** The plan's limit that stopped it, where Claude Code said which. */
      limit?: IStudioChatLimitHit;
      /** Claude Code's own words, on a stop the chat has no notice for. */
      said?: string;
      /**
       * The version the project stood at when the reply ended, where the
       * reply changed the scene: the card that can bring it back.
       */
      version?: number;
    };

export interface IStudioChat {
  projectId: string;
  entries: TStudioChatEntry[];
  /** A reply is being written. */
  busy: boolean;
  /** A card standing in the chat, waiting on the member. */
  ask?: TStudioChatAsk;
  /** Messages waiting for the reply being written to end, oldest first. */
  queued?: IStudioChatQueued[];
  /** How full Claude's context window is, as of the last reply. */
  context?: IStudioChatContext;
  /** This chat's own model and effort; none until it has been given any. */
  picks?: IStudioChatPicks;
}

/**
 * How much of Claude's context window the conversation takes (Ivan,
 * 2026-10-14: "show the context windows in the chat"), in tokens, as Claude
 * Code reported it on the last message: everything the next one carries.
 */
export interface IStudioChatContext {
  used: number;
  /** The model's whole window; unknown until a reply has finished. */
  window?: number;
}

/** One of the plan's usage windows: how much is used, 0 to 1, and when it starts over. */
export interface IStudioChatLimit {
  used: number;
  /** Milliseconds since the epoch. */
  resetsAt: number;
}

/**
 * The member's Claude plan limits (Ivan, 2026-10-14: "show the 5h and weekly
 * limits … under accounts"), as one Claude Code run read them, together with
 * the account that run was signed in to (`main/studioChat/planUsage.ts`).
 */
export interface IStudioChatLimits {
  /**
   * The account the reading is of, as the same run of Claude Code named it
   * (Ivan, 2026-11-28: after switching accounts the card still showed the
   * other one's usage). Undefined where it named none. A reading is shown
   * only under the account it names (`studioChatLimitsKey`).
   */
  account?: string;
  /** Claude Code's own name for that account's plan ("Ultra"), from the same run. */
  plan?: string;
  fiveHour?: IStudioChatLimit;
  week?: IStudioChatLimit;
  /**
   * Fable's own window (Ivan, 2026-11-13: "show fable session limit too").
   * Claude Code keeps no five-hour window per model: Fable's is a week long,
   * its /usage screen's "Current week (Fable)", and it counts beside the
   * plan's two, which every model shares.
   */
  fable?: IStudioChatLimit;
  /** Opus's own weekly window, where the plan still has one. */
  opus?: IStudioChatLimit;
  /** When Claude Code reported them, in milliseconds since the epoch. */
  at: number;
}

/** The windows a limits reading may carry, each kept on its own. */
export const STUDIO_CHAT_LIMIT_WINDOWS = [
  'fiveHour',
  'week',
  'fable',
  'opus',
] as const;
export type TStudioChatLimitWindow = (typeof STUDIO_CHAT_LIMIT_WINDOWS)[number];

/**
 * What the window is told of the plan's usage: a reading, when there is
 * one, and whether Claude Code is being asked for a new one right now.
 */
export interface IStudioChatLimitsNews {
  limits?: IStudioChatLimits;
  checking: boolean;
}

/** What the window asks: the account it shows, and whether the reading must be new. */
export interface IStudioChatLimitsAsk {
  account?: string;
  /** Read now even within the minute (a Fable stop needs a reading after it). */
  fresh?: boolean;
}

/**
 * Which account a reading or a sign-in is, for telling them apart: its
 * email in lower case, '' where Claude Code named none.
 */
export const studioChatLimitsKey = (account: string | undefined) =>
  (account ?? '').toLowerCase();

/**
 * A message the member sent while Claude was still answering (Ivan,
 * 2026-10-14: "we need to be able to queue messages to claude"): it waits,
 * and goes the moment the reply in progress ends well.
 */
export interface IStudioChatQueued {
  id: string;
  text: string;
  /** A picture of the stage goes with it. */
  picture: boolean;
  /**
   * Handed to Claude, which reads it when its current step returns; until
   * then it waits, and can be taken back.
   */
  sent: boolean;
}

/** What the window sends with a message. */
export interface IStudioChatMessage {
  text: string;
  /** A JPEG of the stage as it is now, when the member attached it. */
  stage?: Uint8Array;
  /**
   * The Studio's brief for the scene (`aiPrompt.ts`), built by the window in
   * the member's project; read when a new Claude Code session starts.
   */
  brief: string;
  /** The model Claude Code works with; `default` is its own choice. */
  model?: TStudioChatModel;
  /** How hard it thinks; `default` is its own setting. */
  effort?: TStudioChatEffort;
}

/** What the window sends to compact the conversation: the picks a new process needs. */
export type IStudioChatCompact = Omit<IStudioChatMessage, 'text' | 'stage'>;

/** Claude Code's effort levels (`--effort`), and its own default. */
export const STUDIO_CHAT_EFFORTS = [
  'default',
  'low',
  'medium',
  'high',
  'xhigh',
  'max',
] as const;
export type TStudioChatEffort = (typeof STUDIO_CHAT_EFFORTS)[number];

export const isStudioChatEffort = (
  value: unknown,
): value is TStudioChatEffort =>
  typeof value === 'string' &&
  (STUDIO_CHAT_EFFORTS as readonly string[]).includes(value);

/**
 * A chat's own model and effort, kept in the chat itself (Ivan, 2026-11-13:
 * "when I change the model it changes in all the chats, not good"; "solo es
 * por chat"). They were kept by project in the window, and a chat nobody had
 * picked for read the last pick made anywhere each time it was shown: one
 * pick moved every such chat, and a project's new chat and its earlier ones
 * shared one pick. In the chat's own file they go aside with it and come
 * back with it, and no pick is kept anywhere another chat reads.
 */
export interface IStudioChatPicks {
  model: TStudioChatModel;
  effort: TStudioChatEffort;
}

/** Picks as a file or the window gave them, or undefined when they are not. */
export const readStudioChatPicks = (
  raw: unknown,
): IStudioChatPicks | undefined => {
  if (typeof raw !== 'object' || raw === null) {
    return undefined;
  }
  const { model, effort } = raw as Partial<IStudioChatPicks>;
  return isStudioChatModel(model) && isStudioChatEffort(effort)
    ? { model, effort }
    : undefined;
};

/** What the window sends when the member picks for a project's open chat. */
export interface IStudioChatPicked extends IStudioChatPicks {
  /** The project the pick was made on: main takes it for that one only. */
  projectId: string;
}

/**
 * An earlier chat on the open project: one FluidEQ moved aside when a new
 * chat began, or one Claude Code kept for the folder that FluidEQ does not
 * have (`main/studioChat/pastChats.ts`).
 */
export interface IStudioChatPast {
  id: string;
  /** The member's first line in it. */
  title: string;
  /** When it was put aside, or last written by Claude Code. */
  savedAt: number;
  source: 'fluideq' | 'claude-code';
}

/** The answer to bringing an earlier version back. */
export type TStudioChatRestore =
  | { ok: true }
  | { ok: false; reason: 'busy' | 'gone' | 'no-project' | 'failed' };

/**
 * What the chat asks the member: whether Claude may use one of their own
 * Claude Code tools that their settings do not already allow.
 */
export type TStudioChatAsk = {
  id: string;
  projectId: string;
  /**
   * Claude wants one of the member's own Claude Code tools — a plugin's
   * skill, a command, a tool server — that their own settings do not
   * already allow.
   */
  kind: 'tool';
  /** The tool's name as Claude Code shows it. */
  tool: string;
  /** What it is about to do: the command, the file, the skill. */
  detail: string;
  /**
   * The scene came from outside FluidEQ: the card says so, and offers no
   * "always".
   */
  foreign?: true;
};

/**
 * The member's answer: yes this once, always in this chat, or no.
 */
export type TStudioChatAnswer = 'yes' | 'chat' | 'no';

export const isStudioChatAnswer = (
  value: unknown,
): value is TStudioChatAnswer =>
  value === 'yes' || value === 'chat' || value === 'no';

/** One piece laid into the scene's artwork by the window. */
export interface IStudioChatPackPiece {
  /** Where it goes in the artwork, in pixels from the top-left. */
  x: number;
  y: number;
  width: number;
  height: number;
  /** Its picture, PNG; absent when it is `fromArtwork` instead. */
  image?: Uint8Array;
  /** A part of the artwork as it is now, moved: a piece kept from before. */
  fromArtwork?: { x: number; y: number; width: number; height: number };
  /**
   * A material that tiles: its gutter is filled with its own wrapped pixels.
   * A subject's gutter stays clear.
   */
  wrap: boolean;
  /** The gutter around it, in pixels. */
  gutter: number;
}

/**
 * The window asked to lay out the scene's artwork and encode it as the WebP
 * the build reads (only a page encodes WebP). The member's photo places are
 * copied from the artwork as it is now, where they stand.
 */
export interface IStudioChatPackAsk {
  id: number;
  width: number;
  height: number;
  /** The artwork as it is now, when there is one. */
  current?: Uint8Array;
  keep: { x: number; y: number; width: number; height: number }[];
  pieces: IStudioChatPackPiece[];
}

/** The window's WebP, or why it could not make one within the limits. */
export type TStudioChatPackAnswer =
  | { ok: true; webp: Uint8Array }
  | { ok: false; reason: 'too-big' | 'unreadable' | 'failed' };

/**
 * The window asked for a video's frames, for video_frames: only a page
 * decodes video, so main hands it the file and the moments to draw, and it
 * answers each as a PNG no wider or taller than `edge`.
 */
export interface IStudioChatVideoAsk {
  id: number;
  video: Uint8Array;
  /** The file's media type: video/mp4, video/webm or video/quicktime. */
  type: string;
  /** How many frames, evenly spaced over the part asked for. */
  count: number;
  /** The longest side of each frame, in pixels. */
  edge: number;
  /** The part of the video, in seconds; the whole of it when left out. */
  from?: number;
  to?: number;
}

/** The video's frames, in order, or why there are none. */
export type TStudioChatVideoAnswer =
  | {
      ok: true;
      frames: Uint8Array[];
      width: number;
      height: number;
      /** The whole video's length, in seconds. */
      duration: number;
    }
  | { ok: false; reason: 'unreadable' | 'failed' };

/** An account's email as a sign-in reports it, or undefined if it is not one. */
export const accountEmailOf = (value: unknown): string | undefined =>
  typeof value === 'string' &&
  value.length <= 254 &&
  /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)
    ? value
    : undefined;

/** A plan's name as a sign-in reports it ("max", "prolite"), or undefined. */
export const accountPlanOf = (value: unknown): string | undefined =>
  typeof value === 'string' && /^[a-z0-9_-]{1,24}$/i.test(value)
    ? value.toLowerCase()
    : undefined;

/** A message is at most this long; the composer stops there too. */
export const STUDIO_CHAT_MAX_TEXT = 4000;
