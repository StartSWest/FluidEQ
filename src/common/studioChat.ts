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

/** Why a reply stopped short. */
export type TStudioChatFailure = 'missing' | 'signed-out' | 'limit' | 'crashed';

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
      failure?: TStudioChatFailure;
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
 * limits … under accounts"), as Claude Code last reported them while
 * answering: there is no asking for them without sending something.
 */
export interface IStudioChatLimits {
  fiveHour?: IStudioChatLimit;
  week?: IStudioChatLimit;
  /** When Claude Code reported them, in milliseconds since the epoch. */
  at: number;
}

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

/**
 * A model the member may pick in the chat (Ivan, 2026-10-09: "user needs to
 * be able to pick the model and effort"): `default`, which passes nothing
 * and leaves Claude Code on whatever the member set for it, or a line by
 * Claude Code's own name for it - `haiku` - which Claude Code resolves to
 * that line's newest model. Any line Claude Code offers, not only the ones
 * this app knew of when it was built (Ivan, 2026-11-09: "claude can launch
 * new models and we want to pick up smartly automatically"): a name of a
 * line's shape, held to it everywhere it crosses into a command line.
 */
export type TStudioChatModel = string;

/** A line's name as Claude Code takes it: lower case, a word or two, no version. */
const LINE_NAME = /^[a-z][a-z0-9-]{0,31}$/;

export const isStudioChatModel = (value: unknown): value is TStudioChatModel =>
  typeof value === 'string' &&
  LINE_NAME.test(value) &&
  // An exact model (`claude-haiku-4-5-...`) is an older one of a line, which
  // the list does not offer: a line's own name always reaches its newest.
  !value.startsWith('claude-');

/**
 * The lines there were when this was written, each with its own words in
 * every language (`studioChat.modelHint*`), and the ones offered under their
 * bare names before Claude Code has ever said anything. A line Claude Code
 * adds later is offered all the same, in Claude Code's own words.
 */
export const STUDIO_CHAT_FAMILIES = [
  'fable',
  'opus',
  'sonnet',
  'haiku',
] as const;
export type TStudioChatFamily = (typeof STUDIO_CHAT_FAMILIES)[number];

export const isStudioChatFamily = (value: string): value is TStudioChatFamily =>
  (STUDIO_CHAT_FAMILIES as readonly string[]).includes(value);

/** One line Claude Code offers: its name for it, and the model's name and words. */
export interface IStudioChatLine {
  id: TStudioChatModel;
  name: string;
  description?: string;
}

/**
 * What Claude Code says it offers (Ivan, 2026-11-09: "make sure model list
 * gets updated when app is restarted"; and 2026-10-09: "we need to show
 * models version, like opus 5.5"): each line's model under its own name -
 * "Haiku 5.5" - read from Claude Code once in each run of the app
 * (`main/studioChat/claudeModels.ts`), so the list names the model that
 * answers and never ages. It used to be a table of exact versions written
 * into the app, and it went on offering Haiku 4.5 after 5.5 shipped.
 *
 * `lines` are every line Claude Code offered, in its own order, a family
 * it added after this app was built among them. `checked`: Claude Code has
 * answered at least once, ever. Until then nothing is known, and the lines
 * this app knows of are offered under their bare names; after, one of those
 * that Claude Code did not offer is one this account cannot use, shown as
 * such, never quietly left out.
 */
export interface IStudioChatModels {
  checked: boolean;
  lines: IStudioChatLine[];
  /** The model `default` starts, by its name, where Claude Code said it. */
  defaultName?: string;
}

export const NO_STUDIO_CHAT_MODELS: IStudioChatModels = {
  checked: false,
  lines: [],
};

/**
 * Whether `model` can be started here: `default` always; a line Claude Code
 * offered; before it ever answered, a line this app knows of.
 */
export const isStudioChatModelOffered = (
  models: IStudioChatModels,
  model: TStudioChatModel,
) =>
  model === 'default' ||
  (models.checked
    ? models.lines.some(({ id }) => id === model)
    : isStudioChatFamily(model));

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
