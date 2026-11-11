/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

/**
 * Who makes a picture, a set of frames or a 3D model for a scene when the
 * Studio's chat needs one from outside FluidEQ (Ivan, 2026-11-11: "quiero
 * que Fluid esté preparado para usar Higgsfield. Y que pida si quiere usar
 * GPT o Higgsfield").
 *
 * Both are the member's own, on the member's own accounts, reached through
 * the member's own Claude Code: a GPT plugin installed there, and
 * Higgsfield's hosted tool server added there. FluidEQ ships
 * neither, holds no sign-in of either and pays for nothing; it knows which
 * are there, asks which to use when both are, and remembers the answer when
 * told to.
 *
 * FluidEQ's own ChatGPT pictures (`studioChatPictures.ts`) are another
 * thing, and stay closed.
 */

export const STUDIO_MAKERS = ['gpt', 'higgsfield'] as const;
export type TStudioMaker = (typeof STUDIO_MAKERS)[number];

/** What the member said to use: one of them, or to be asked each time. */
export type TStudioMakerChoice = 'ask' | TStudioMaker;

export const isStudioMaker = (value: unknown): value is TStudioMaker =>
  value === 'gpt' || value === 'higgsfield';

export const isStudioMakerChoice = (
  value: unknown,
): value is TStudioMakerChoice => value === 'ask' || isStudioMaker(value);

/**
 * What a scene can take from a maker. A video or a sound has no place in a
 * scene, so neither is asked for: credits are not spent on what cannot be
 * used.
 */
export const STUDIO_MADE_KINDS = ['picture', 'frames', 'model'] as const;
export type TStudioMadeKind = (typeof STUDIO_MADE_KINDS)[number];

export const isStudioMadeKind = (value: unknown): value is TStudioMadeKind =>
  value === 'picture' || value === 'frames' || value === 'model';

/**
 * Higgsfield in the member's own Claude Code: its hosted tool server
 * (https://mcp.higgsfield.ai/mcp), added there and signed in to with the
 * member's own Higgsfield account. Hosted, so it is always Higgsfield's
 * newest and nothing is installed on the computer.
 */
export type THiggsfieldAccount =
  /** Not added to Claude Code. */
  | { state: 'missing' }
  /** Added, and waiting for the member to sign in. */
  | { state: 'signed-out' }
  /** Added, and Claude Code could not reach it just now. */
  | { state: 'unreachable' }
  | { state: 'ready' };

/** The member's GPT plugin in their own Claude Code. */
export interface IGptPlugin {
  found: boolean;
  /** The plugin's own name, as Claude Code lists it. */
  name?: string;
}

/** Everything the Accounts pane shows of the two, and the member's choice. */
export interface IStudioMakers {
  gpt: IGptPlugin;
  higgsfield: THiggsfieldAccount;
  choice: TStudioMakerChoice;
}

/** Which of the two can be used now. */
export const connectedMakers = (
  makers: Pick<IStudioMakers, 'gpt' | 'higgsfield'>,
): TStudioMaker[] => [
  ...(makers.gpt.found ? (['gpt'] as const) : []),
  ...(makers.higgsfield.state === 'ready' ? (['higgsfield'] as const) : []),
];

/**
 * What can be asked of the member: a GPT plugin draws pictures, and the
 * frames of an animation are pictures; it builds no 3D model, so a model is
 * never a question of which.
 */
export type TStudioAskedKind = Exclude<TStudioMadeKind, 'model'>;

/** The connected makers that can make this kind of thing. */
export const makersFor = (
  what: TStudioMadeKind,
  makers: Pick<IStudioMakers, 'gpt' | 'higgsfield'>,
): TStudioMaker[] =>
  connectedMakers(makers).filter(
    (maker) => what !== 'model' || maker === 'higgsfield',
  );

/**
 * Who makes the next thing: the only one connected, the one the member
 * chose while it is connected, `ask` when both are and nothing is chosen,
 * `none` when neither is. A choice of one that has since gone is not held
 * against the member: the other is used, as if nothing had been chosen.
 */
export const makerToUse = (
  choice: TStudioMakerChoice,
  connected: readonly TStudioMaker[],
): TStudioMaker | 'ask' | 'none' => {
  if (connected.length === 0) {
    return 'none';
  }
  if (connected.length === 1) {
    return connected[0];
  }
  return choice !== 'ask' && connected.includes(choice) ? choice : 'ask';
};
