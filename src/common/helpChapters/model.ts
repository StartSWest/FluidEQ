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

export interface IHelpPictureFigure<TImage extends string = string> {
  /** A file in `docs/`. */
  readonly image: TImage;
  readonly width: number;
  readonly height: number;
  /** What this capture shows, for a chapter with more than one. */
  readonly caption?: TranslationKey;
  readonly controls?: readonly IHelpControl[];
}

/**
 * One control a live figure explains, found on the panel itself rather than
 * at a spot on a picture: `target` is a CSS selector, looked up inside the
 * drawn panel, and its call-out points at everything it matches taken
 * together (`HelpLiveFigure`). Rename the class or move the control and the
 * circle follows it; take the control away and the test that draws every
 * live figure says so (`helpLiveFigures.test.tsx`).
 */
export interface IHelpLiveControl {
  readonly target: string;
  readonly name: TranslationKey;
  readonly text: TranslationKey;
  /** The shortcut, as the app prints it. */
  readonly keys?: string;
}

/**
 * A figure drawn by the app's own components instead of a capture, so it
 * shows the panel as it is today, in the reader's language and window
 * colours (the "live panels" plan, Ivan 2026-10-26: "do the help and what
 * new"). `live` names its drawing in the renderer's list
 * (`help/live/helpLiveFigures.tsx`); common code cannot hold a component.
 *
 * `width` is what the drawing is laid out at, in CSS pixels. `frame`, when
 * the drawing is more than the figure shows, is a selector for the part
 * shown — a whole player laid out as its window holds it, and only its
 * header and picture framed. The figure's height is measured from what is
 * drawn; `height` is only what is expected, for the room it holds until it
 * is drawn (it mounts as it nears the reader).
 *
 * `still` is the capture the exported guide and the README go on showing
 * until pictures are drawn from these figures by script; it can be older
 * than the figure, and the reader never sees it.
 */
export interface IHelpLiveFigure<TImage extends string = string> {
  readonly live: string;
  readonly width: number;
  readonly height: number;
  readonly frame?: string;
  readonly caption?: TranslationKey;
  readonly controls?: readonly IHelpLiveControl[];
  readonly still: TImage;
}

/**
 * Either kind. A capture's image is one the app shows; a live figure's still
 * is one only the exported guide does, so the two are typed apart and the
 * app bundles no still (`help/screenshots.ts`).
 */
export type IHelpFigure<
  TImage extends string = string,
  TStill extends string = TImage,
> = IHelpPictureFigure<TImage> | IHelpLiveFigure<TStill>;

export const isLiveFigure = <TImage extends string, TStill extends string>(
  figure: IHelpFigure<TImage, TStill>,
): figure is IHelpLiveFigure<TStill> => 'live' in figure;

/** The capture a figure is drawn from, or stands in for. */
export const figureImage = <TImage extends string, TStill extends string>(
  figure: IHelpFigure<TImage, TStill>,
): TImage | TStill => (isLiveFigure(figure) ? figure.still : figure.image);

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

/**
 * A film a chapter plays from FluidEQ's site. It is streamed when the reader
 * presses play and never bundled: the installer keeps its size, the film can
 * be replaced without a release, and nothing is fetched before the press.
 */
export interface IHelpVideo<TImage extends string = string> {
  /** Where the site serves the film. */
  readonly src: string;
  /**
   * Its captions, a WebVTT file the site serves beside it, in the narration's
   * language. Another origin's captions only load over CORS, so the site
   * sends `Access-Control-Allow-Origin` for both files.
   */
  readonly captions: { readonly src: string; readonly lang: string };
  /** The site's page that shows it, for a window that cannot play it. */
  readonly page: string;
  /** Its name on the card. */
  readonly title: TranslationKey;
  /**
   * The line under the name: how long it runs, what it is narrated in and
   * where it plays from. Each film's own, because each runs its own length.
   */
  readonly note: TranslationKey;
  /** A capture in `docs/`, shown until the film plays. */
  readonly poster: TImage;
}

export interface IHelpChapter<
  TId extends string = string,
  TImage extends string = string,
  TStill extends string = TImage,
> {
  readonly id: TId;
  readonly group: THelpGroup;
  readonly figures: readonly IHelpFigure<TImage, TStill>[];
  readonly video?: IHelpVideo<TImage>;
}
