/* Copyright (C) 2026 Ivan Carmenates Garcia. SPDX-License-Identifier: GPL-3.0-or-later */

import { useCallback, useContext, useMemo, useRef, useState } from 'react';
import {
  HELP_CAPTURE_MAX_VIEWPORT,
  HELP_LIVE_MAX_SCALE,
  type IHelpLiveFigure,
  type THelpBox,
} from 'common/helpGuide';
import { planHelpCallouts, type IHelpLayout } from 'common/helpCallouts';
import { useTranslation } from '../utils/I18nContext';
import {
  HelpCalloutMarks,
  HelpControlList,
  HelpFigureCaption,
  useFigureLights,
} from './HelpCalloutParts';
import { HelpColumnContext } from './HelpColumn';
import HelpLiveSurface, { type IHelpLiveMeasure } from './live/HelpLiveSurface';
import { helpLiveDrawing } from './live/helpLiveFigures';
import { rememberMeasure, rememberedMeasure } from './live/liveMeasures';
import useNearView from './live/useNearView';

interface IHelpLiveFigureProps {
  figure: IHelpLiveFigure;
  /** Where the article draws this figure; its caption and controls hang off it. */
  anchor: string;
  /** What the figure is called: its caption, or else the chapter's title. */
  title: string;
  onEnlarge: () => void;
}

/**
 * The plan the call-outs are laid out from: what was measured, with a circle
 * only for the controls the drawing had; the list keeps a line for each.
 */
const layoutOf = (
  figure: IHelpLiveFigure,
  measure: IHelpLiveMeasure | undefined,
): { layout: IHelpLayout; drawn: readonly number[] } => {
  const drawn: number[] = [];
  const controls: { box: THelpBox }[] = [];
  measure?.boxes.forEach((box, index) => {
    if (box) {
      drawn.push(index);
      controls.push({ box });
    }
  });
  return {
    layout: {
      width: measure?.width ?? figure.width,
      height: measure?.height ?? figure.height,
      controls,
      maxScale: HELP_LIVE_MAX_SCALE,
      numbering: 'listed',
    },
    drawn,
  };
};

/**
 * A figure drawn by the app's own components (`IHelpLiveFigure`), with the
 * same numbered circles and list as a capture's (`HelpFigure`).
 *
 * Drawn once the reader nears it (`useNearView`), and kept. Until then it
 * holds the room it expects — or, opened again, the room it measured last
 * (`liveMeasures`) — and its list is already there, numbered as listed, so a
 * search can land on any of its controls before its picture exists. The
 * circles come with the drawing: they are placed from what it measured, in
 * its own pixels, and keep the numbers the list already showed.
 */
export default function HelpLiveFigure({
  figure,
  anchor,
  title,
  onEnlarge,
}: IHelpLiveFigureProps) {
  const { t, locale } = useTranslation();
  const lights = useFigureLights(anchor);
  const column = useContext(HelpColumnContext);
  const host = useRef<HTMLDivElement>(null);
  const isNear = useNearView(host);
  const [measure, setMeasure] = useState(() =>
    rememberedMeasure(figure.live, locale),
  );
  const onMeasure = useCallback(
    (next: IHelpLiveMeasure) => {
      rememberMeasure(figure.live, locale, next);
      setMeasure(next);
    },
    [figure.live, locale],
  );
  const controls = figure.controls ?? [];

  const { plan, drawn } = useMemo(() => {
    const { layout, drawn: indices } = layoutOf(figure, measure);
    return {
      drawn: indices,
      plan:
        column &&
        planHelpCallouts(layout, {
          width: column.width,
          maxImageHeight: column.height * HELP_CAPTURE_MAX_VIEWPORT,
        }),
    };
  }, [figure, measure, column]);
  // The plan numbers what it was given; the list numbers every control.
  const marks = plan && {
    ...plan,
    callouts: plan.callouts.map((callout) => ({
      ...callout,
      index: drawn[callout.index],
      number: drawn[callout.index] + 1,
    })),
  };
  const Drawing = helpLiveDrawing(figure.live);

  return (
    <figure className="help-figure help-figure--live">
      <HelpFigureCaption caption={figure.caption} anchor={anchor} />
      <div className="help-figure__host" ref={host}>
        {marks && (
          <div
            className="help-figure__frame"
            style={{ width: marks.width, height: marks.height }}
          >
            {/* What a capture's `alt` is: the drawing inside is hidden from
                assistive tech, so its frame says what it shows. */}
            <div
              className="help-guide__capture help-figure__capture help-figure__live"
              role="img"
              aria-label={title}
              style={{
                left: marks.image.left,
                top: marks.image.top,
                width: marks.image.width,
                height: marks.image.height,
              }}
            >
              {isNear && Drawing && (
                <HelpLiveSurface
                  figure={figure}
                  Drawing={Drawing}
                  zoom={marks.image.width / (measure?.width ?? figure.width)}
                  onMeasure={onMeasure}
                />
              )}
            </div>
            {/* Over the drawing, never round it: a button may not hold the
                panel's own buttons, inert or not. */}
            <button
              type="button"
              className="help-figure__enlarge"
              style={{
                left: marks.image.left,
                top: marks.image.top,
                width: marks.image.width,
                height: marks.image.height,
              }}
              aria-label={t('help.enlarge', { title })}
              onClick={onEnlarge}
            />
            <HelpCalloutMarks
              plan={marks}
              isLit={lights.isLit}
              onPoint={lights.setPointed}
            />
          </div>
        )}
      </div>
      <figcaption className="help-figure__note">
        {t('help.enlarge', { title })}
      </figcaption>
      <HelpControlList
        lines={controls.map((_, index) => ({ index, number: index + 1 }))}
        controls={controls}
        title={title}
        pointed={lights.pointed}
        controlAt={lights.controlAt}
        isFound={lights.isFound}
        onPoint={lights.setPointed}
      />
    </figure>
  );
}
