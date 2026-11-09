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
    | 'picture'
    | 'pack'
    | 'animation'
    | 'animator'
    | 'compact'
    | 'other';
  /** The file it read or wrote, by name only, never a path. */
  file?: string;
  state: 'running' | 'done' | 'failed';
  /**
   * What a look saw, a JPEG data URL small enough to keep with the chat
   * (Ivan, 2026-10-09: "so I can see all the time what is looking at"), or
   * the picture ChatGPT made, a PNG that keeps its transparency.
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

/**
 * An animation's own chat, its animator (Ivan, 2026-11-09: "work in a
 * separated agent to improve that animation", "when I open it I will be
 * able to see it working and chat with it"): kept beside the project's chat
 * under a key of its own - the project's id and the animation's name - so
 * its transcript, its Claude Code, its queue and its cards never mix with
 * the scene's. The scene's chat is keyed by the project's id alone.
 */
const ANIMATOR_MARK = '#animator:';

export const animatorChatKey = (projectId: string, name: string): string =>
  `${projectId}${ANIMATOR_MARK}${name}`;

/** The project a chat belongs to: its own key, or an animator's project. */
export const chatProjectOf = (key: string): string =>
  key.split(ANIMATOR_MARK)[0];

/** The animation an animator's chat works on; undefined for a scene's chat. */
export const chatAnimationOf = (key: string): string | undefined => {
  const at = key.indexOf(ANIMATOR_MARK);
  return at === -1 ? undefined : key.slice(at + ANIMATOR_MARK.length);
};

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
 * The models the member may pick in the chat (Ivan, 2026-10-09: "user needs
 * to be able to pick the model and effort"), by line. Each line is started
 * by Claude Code's own name for it - `--model haiku` - which Claude Code
 * resolves to the newest model of that line; `default` passes nothing, and
 * Claude Code uses whatever the member set for it, or its plan's default.
 */
export const STUDIO_CHAT_MODELS = [
  'default',
  'fable',
  'opus',
  'sonnet',
  'haiku',
] as const;
export type TStudioChatModel = (typeof STUDIO_CHAT_MODELS)[number];

/** A line of models: every pick but `default`. */
export type TStudioChatFamily = Exclude<TStudioChatModel, 'default'>;

/**
 * What Claude Code says it offers (Ivan, 2026-11-09: "make sure model list
 * gets updated when app is restarted"; and 2026-10-09: "we need to show
 * models version, like opus 5.5"): each line's model under its own name -
 * "Haiku 5.5" - read from Claude Code once in each run of the app
 * (`main/studioChat/claudeModels.ts`), so the list names the model that
 * answers and never ages. It used to be a table of exact versions written
 * into the app, and it went on offering Haiku 4.5 after 5.5 shipped.
 *
 * `checked`: Claude Code has answered at least once, ever. Until then
 * nothing is known, and every line is offered under its bare name; after,
 * a line Claude Code did not offer is one this account cannot use, shown
 * as such, never quietly left out.
 */
export interface IStudioChatModels {
  checked: boolean;
  names: Partial<Record<TStudioChatFamily, string>>;
  /** The model `default` starts, by its name, where Claude Code said it. */
  defaultName?: string;
}

export const NO_STUDIO_CHAT_MODELS: IStudioChatModels = {
  checked: false,
  names: {},
};

/** Whether `model` can be started here: `default` always, a line where it is offered. */
export const isStudioChatModelOffered = (
  models: IStudioChatModels,
  model: TStudioChatModel,
) => model === 'default' || !models.checked || Boolean(models.names[model]);

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

export const isStudioChatModel = (value: unknown): value is TStudioChatModel =>
  typeof value === 'string' &&
  (STUDIO_CHAT_MODELS as readonly string[]).includes(value);

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
 * Whether ChatGPT can make pictures here: the member's own Codex, installed
 * and signed in with ChatGPT (`main/studioChat/codexPictures.ts`).
 */
export type TStudioChatCodex = 'missing' | 'signed-out' | 'ready';

/** ChatGPT's pictures as the chat shows them: Codex here, and whose. */
export interface IStudioChatCodexState {
  codex: TStudioChatCodex;
  /** The member let ChatGPT make pictures in the chat. */
  connected: boolean;
  /** The ChatGPT account Codex is signed in to, and its plan, when it says. */
  email?: string;
  plan?: string;
}

/**
 * What the chat asks the member before Claude uses ChatGPT (Ivan,
 * 2026-10-09: "it needs to ask the user if you connect gpt codex … and also
 * ask when it will use it"): once, to connect it, and before every picture.
 */
export type TStudioChatAsk =
  | {
      id: string;
      projectId: string;
      kind: 'connect';
      codex: TStudioChatCodex;
    }
  | {
      id: string;
      projectId: string;
      kind: 'picture';
      /** Claude's own line on what the picture is for. */
      why: string;
      /** What ChatGPT is asked to draw. */
      prompt: string;
      width: number;
      height: number;
      transparent: boolean;
    }
  | {
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
    };

/**
 * The member's answer: yes this once, yes for the rest of this chat (a
 * picture, or that tool), or no.
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
