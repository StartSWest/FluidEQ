/* Copyright (C) 2026 Ivan Carmenates Garcia. SPDX-License-Identifier: GPL-3.0-or-later */

import type { TranslationKey } from '../i18n';

/**
 * What a guide chapter is made of, shared by the chapter modules beside this
 * one and by `helpGuide.ts`, which puts them in order.
 */

/** x, y, width, height on a capture, in the capture's own pixels. */
export type THelpBox = readonly [number, number, number, number];

/**
 * One control a capture explains.
 *
 * `box` was measured in the running window as the capture was taken: it is
 * where the control is, what its numbered call-out points at
 * (`helpCallouts.ts`), and what is ringed while its line is pointed at. It has
 * to stay true to the capture — retake a capture and its boxes are retaken
 * with it.
 *
 * `name` is the app's own label for the control wherever it has one that
 * reads on its own, so the name in the guide is the name on screen in every
 * language; `text` is the guide's line on what it is for.
 */
export interface IHelpControl {
  readonly box: THelpBox;
  readonly name: TranslationKey;
  readonly text: TranslationKey;
  /** The shortcut, as the app prints it. */
  readonly keys?: string;
}

export interface IHelpFigure<TImage extends string = string> {
  /** A file in `docs/`. */
  readonly image: TImage;
  readonly width: number;
  readonly height: number;
  /** What this capture shows, for a chapter with more than one. */
  readonly caption?: TranslationKey;
  readonly controls?: readonly IHelpControl[];
}

export const HELP_GROUPS = [
  'start',
  'sound',
  'visuals',
  'plus',
  'listen',
  'help',
] as const;

export type THelpGroup = (typeof HELP_GROUPS)[number];

/** A capture of the whole window. */
export const WINDOW = { width: 2560, height: 1392 } as const;

export interface IHelpChapter<
  TId extends string = string,
  TImage extends string = string,
> {
  readonly id: TId;
  readonly group: THelpGroup;
  readonly figures: readonly IHelpFigure<TImage>[];
}
