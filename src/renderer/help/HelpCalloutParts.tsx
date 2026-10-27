/* Copyright (C) 2026 Ivan Carmenates Garcia. SPDX-License-Identifier: GPL-3.0-or-later */

import { useState } from 'react';
import type { IHelpCalloutPlan } from 'common/helpCallouts';
import type { TranslationKey } from 'common/i18n';
import { useTranslation } from '../utils/I18nContext';
import { Marked, useHelpFound } from './HelpMarks';
import { helpAnchor, helpMarkKey } from './helpSearch';

/**
 * What a figure of either kind — a capture (`HelpFigure`) or a panel drawn
 * live (`HelpLiveFigure`) — draws round its picture and under it: the
 * numbered circles, their lines and the ring on the control pointed at, and
 * the numbered list of what each control is for.
 */

/** A control as the list names it: the same for both kinds of figure. */
export interface IHelpListedControl {
  readonly name: TranslationKey;
  readonly text: TranslationKey;
  readonly keys?: string;
}

/**
 * Which of a figure's controls is lit, and why: pointed at, on a circle or a
 * line of the list, or else gone to by a search.
 */
export const useFigureLights = (anchor: string) => {
  const { marks, targets } = useHelpFound();
  const [pointed, setPointed] = useState<number>();
  const controlAt = (index: number) => helpAnchor.control(anchor, index);
  const isTarget = (index: number) => targets.has(controlAt(index));
  return {
    pointed,
    setPointed,
    controlAt,
    isLit: (index: number) =>
      pointed === undefined ? isTarget(index) : index === pointed,
    // A control is lit when the search went to it or found its name. A word
    // found only in its line is marked there and no more: "band" is in the
    // lines of six of the Bands page's nine controls, and six lit cards say
    // nothing about which one was meant.
    isFound: (index: number) =>
      isTarget(index) ||
      marks.has(helpMarkKey(controlAt(index), 'controlName')),
  };
};

/** The figure's name over it, for a chapter with more than one. */
export function HelpFigureCaption({
  caption,
  anchor,
}: {
  caption?: TranslationKey;
  anchor: string;
}) {
  const { t } = useTranslation();
  if (!caption) {
    return null;
  }
  return (
    <h3
      className="help-figure__caption"
      data-help-anchor={helpAnchor.caption(anchor)}
    >
      <Marked
        text={t(caption)}
        anchor={helpAnchor.caption(anchor)}
        kind="caption"
      />
    </h3>
  );
}

/**
 * The circles, their lines and the ring, on the frame the plan laid out:
 * the picture is already on it, at `plan.image`.
 */
export function HelpCalloutMarks({
  plan,
  isLit,
  onPoint,
}: {
  plan: IHelpCalloutPlan;
  isLit: (index: number) => boolean;
  onPoint: (index: number | undefined) => void;
}) {
  const ringed = plan.callouts.filter((callout) => isLit(callout.index));
  return (
    <>
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
              <circle cx={callout.anchor.x} cy={callout.anchor.y} r={2.5} />
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
          className={`help-callout${isLit(callout.index) ? ' is-lit' : ''}`}
          style={{ left: callout.badge.x, top: callout.badge.y }}
          aria-hidden="true"
          onPointerEnter={() => onPoint(callout.index)}
          onPointerLeave={() => onPoint(undefined)}
        >
          {callout.number}
        </span>
      ))}
    </>
  );
}

/** The numbered list under the picture, one line a control. */
export function HelpControlList({
  lines,
  controls,
  title,
  pointed,
  controlAt,
  isFound,
  onPoint,
}: {
  /** Which control each line is, in the order the list shows them. */
  lines: readonly { readonly index: number; readonly number: number }[];
  controls: readonly IHelpListedControl[];
  title: string;
  pointed: number | undefined;
  controlAt: (index: number) => string;
  isFound: (index: number) => boolean;
  onPoint: (index: number | undefined) => void;
}) {
  const { t } = useTranslation();
  if (lines.length === 0) {
    return null;
  }
  return (
    <ol className="help-controls" aria-label={t('help.controlsOf', { title })}>
      {lines.map(({ index, number }) => {
        const control = controls[index];
        return (
          <li
            key={`${control.name}/${control.text}`}
            className={`help-control${index === pointed ? ' is-lit' : ''}${
              isFound(index) ? ' is-found' : ''
            }`}
            data-help-anchor={controlAt(index)}
            onPointerEnter={() => onPoint(index)}
            onPointerLeave={() => onPoint(undefined)}
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
  );
}
