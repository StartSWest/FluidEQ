/* Copyright (C) 2026 Ivan Carmenates Garcia. SPDX-License-Identifier: GPL-3.0-or-later */

import { useContext, useMemo, useState } from 'react';
import { HELP_CAPTURE_MAX_VIEWPORT, type IHelpFigure } from 'common/helpGuide';
import { planHelpCallouts } from 'common/helpCallouts';
import { useTranslation } from '../utils/I18nContext';
import { HelpColumnContext } from './HelpColumn';
import { Marked, useHelpFound } from './HelpMarks';
import { helpAnchor, helpMarkKey } from './helpSearch';

interface IHelpFigureProps {
  figure: IHelpFigure;
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
 */
export default function HelpFigure({
  figure,
  anchor,
  src,
  title,
  onEnlarge,
}: IHelpFigureProps) {
  const { t } = useTranslation();
  const { marks, targets } = useHelpFound();
  const column = useContext(HelpColumnContext);
  const [pointed, setPointed] = useState<number>();
  const controls = figure.controls ?? [];
  const controlAt = (index: number) => helpAnchor.control(anchor, index);
  const isTarget = (index: number) => targets.has(controlAt(index));
  // A control is lit when the search went to it or found its name. A word
  // found only in its line is marked there and no more: "band" is in the
  // lines of six of the Bands page's nine controls, and six lit cards say
  // nothing about which one was meant.
  const isFound = (index: number) =>
    isTarget(index) || marks.has(helpMarkKey(controlAt(index), 'controlName'));

  const plan = useMemo(
    () =>
      column &&
      planHelpCallouts(figure, {
        width: column.width,
        maxImageHeight: column.height * HELP_CAPTURE_MAX_VIEWPORT,
      }),
    [figure, column],
  );
  const isLit = (index: number) =>
    pointed === undefined ? isTarget(index) : index === pointed;
  const ringed = plan?.callouts.filter((callout) => isLit(callout.index)) ?? [];

  return (
    <figure className="help-figure">
      {figure.caption && (
        <h3
          className="help-figure__caption"
          data-help-anchor={helpAnchor.caption(anchor)}
        >
          <Marked
            text={t(figure.caption)}
            anchor={helpAnchor.caption(anchor)}
            kind="caption"
          />
        </h3>
      )}
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
            {plan.callouts.length > 0 && (
              <svg
                className="help-callouts"
                width={plan.width}
                height={plan.height}
                aria-hidden="true"
              >
                {plan.callouts.map((callout) => (
                  <g
                    key={callout.index}
                    className={`help-callouts__lead${
                      isLit(callout.index) ? ' is-lit' : ''
                    }`}
                  >
                    <line
                      x1={callout.start.x}
                      y1={callout.start.y}
                      x2={callout.anchor.x}
                      y2={callout.anchor.y}
                    />
                    <circle
                      cx={callout.anchor.x}
                      cy={callout.anchor.y}
                      r={2.5}
                    />
                  </g>
                ))}
              </svg>
            )}
            {ringed.map((callout) => (
              <span
                key={callout.index}
                className="help-figure__ring"
                aria-hidden="true"
                style={{
                  left: callout.box.left,
                  top: callout.box.top,
                  width: callout.box.width,
                  height: callout.box.height,
                }}
              />
            ))}
            {plan.callouts.map((callout) => (
              <span
                key={callout.index}
                className={`help-callout${
                  isLit(callout.index) ? ' is-lit' : ''
                }`}
                style={{ left: callout.badge.x, top: callout.badge.y }}
                aria-hidden="true"
                onPointerEnter={() => setPointed(callout.index)}
                onPointerLeave={() => setPointed(undefined)}
              >
                {callout.number}
              </span>
            ))}
          </div>
        )}
      </div>
      <figcaption className="help-figure__note">
        {t('help.enlarge', { title })}
      </figcaption>
      {plan && plan.callouts.length > 0 && (
        <ol
          className="help-controls"
          aria-label={t('help.controlsOf', { title })}
        >
          {plan.callouts.map(({ index, number }) => {
            const control = controls[index];
            return (
              <li
                key={control.text}
                className={`help-control${index === pointed ? ' is-lit' : ''}${
                  isFound(index) ? ' is-found' : ''
                }`}
                data-help-anchor={controlAt(index)}
                onPointerEnter={() => setPointed(index)}
                onPointerLeave={() => setPointed(undefined)}
              >
                <span className="help-control__number" aria-hidden="true">
                  {number}
                </span>
                <span className="help-control__body">
                  <span className="help-control__name">
                    <strong>
                      <Marked
                        text={t(control.name)}
                        anchor={controlAt(index)}
                        kind="controlName"
                      />
                    </strong>
                    {control.keys && <kbd>{control.keys}</kbd>}
                  </span>
                  <span className="help-control__text">
                    <Marked
                      text={t(control.text)}
                      anchor={controlAt(index)}
                      kind="controlText"
                    />
                  </span>
                </span>
              </li>
            );
          })}
        </ol>
      )}
    </figure>
  );
}
