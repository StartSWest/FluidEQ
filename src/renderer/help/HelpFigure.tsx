/* Copyright (C) 2026 Ivan Carmenates Garcia. SPDX-License-Identifier: GPL-3.0-or-later */

import { useContext, useMemo } from 'react';
import {
  HELP_CAPTURE_MAX_VIEWPORT,
  type IHelpPictureFigure,
} from 'common/helpGuide';
import { planHelpCallouts } from 'common/helpCallouts';
import { useTranslation } from '../utils/I18nContext';
import {
  HelpCalloutMarks,
  HelpControlList,
  HelpFigureCaption,
  useFigureLights,
} from './HelpCalloutParts';
import { HelpColumnContext } from './HelpColumn';

interface IHelpFigureProps {
  figure: IHelpPictureFigure;
  /** Where the article draws this capture; its caption and controls hang off it. */
  anchor: string;
  /** The capture's bundled address. */
  src: string;
  /** What the capture is called: its caption, or else the chapter's title. */
  title: string;
  onEnlarge: () => void;
}

/**
 * One capture, with a numbered call-out on every control it explains and the
 * numbered list of them under it — laid out like a printed manual.
 *
 * The call-outs are placed for the width the column actually has — measured
 * once for the whole guide (`HelpColumn.ts`) and again whenever it changes —
 * so the circles stay one readable size and never overlap; the numbers
 * themselves never move, because they follow the capture in reading order
 * (`helpCallouts.ts`). Pointing at a line of the list, or at a circle, rings
 * its control on the capture and lights its line. A search does the same for
 * the control it went to, until something is pointed at, and lights every
 * line whose name it found.
 *
 * A panel drawn live instead of captured is `HelpLiveFigure`, with the same
 * circles and list (`HelpCalloutParts`).
 */
export default function HelpFigure({
  figure,
  anchor,
  src,
  title,
  onEnlarge,
}: IHelpFigureProps) {
  const { t } = useTranslation();
  const lights = useFigureLights(anchor);
  const column = useContext(HelpColumnContext);
  const plan = useMemo(
    () =>
      column &&
      planHelpCallouts(figure, {
        width: column.width,
        maxImageHeight: column.height * HELP_CAPTURE_MAX_VIEWPORT,
      }),
    [figure, column],
  );

  return (
    <figure className="help-figure">
      <HelpFigureCaption caption={figure.caption} anchor={anchor} />
      <div className="help-figure__host">
        {plan && (
          <div
            className="help-figure__frame"
            style={{ width: plan.width, height: plan.height }}
          >
            <button
              type="button"
              className="help-guide__capture help-figure__capture"
              style={{
                left: plan.image.left,
                top: plan.image.top,
                width: plan.image.width,
                height: plan.image.height,
              }}
              aria-label={t('help.enlarge', { title })}
              onClick={onEnlarge}
            >
              <img
                src={src}
                alt={title}
                loading="lazy"
                width={figure.width}
                height={figure.height}
              />
            </button>
            <HelpCalloutMarks
              plan={plan}
              isLit={lights.isLit}
              onPoint={lights.setPointed}
            />
          </div>
        )}
      </div>
      <figcaption className="help-figure__note">
        {t('help.enlarge', { title })}
      </figcaption>
      {plan && (
        <HelpControlList
          lines={plan.callouts}
          controls={figure.controls ?? []}
          title={title}
          pointed={lights.pointed}
          controlAt={lights.controlAt}
          isFound={lights.isFound}
          onPoint={lights.setPointed}
        />
      )}
    </figure>
  );
}
