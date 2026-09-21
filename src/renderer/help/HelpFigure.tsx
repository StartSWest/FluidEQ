/* Copyright (C) 2026 Ivan Carmenates Garcia. SPDX-License-Identifier: GPL-3.0-or-later */

import { useLayoutEffect, useMemo, useRef, useState } from 'react';
import { HELP_CAPTURE_MAX_VIEWPORT, type IHelpFigure } from 'common/helpGuide';
import { planHelpCallouts } from 'common/helpCallouts';
import { useTranslation } from '../utils/I18nContext';

interface IHelpFigureProps {
  figure: IHelpFigure;
  /** The capture's bundled address. */
  src: string;
  /** What the capture is called: its caption, or else the chapter's title. */
  title: string;
  onEnlarge: () => void;
}

interface IRoom {
  width: number;
  height: number;
}

/**
 * One capture, with a numbered call-out on every control it explains and the
 * numbered list of them under it — laid out like a printed manual.
 *
 * The call-outs are placed for the width the column actually has, measured
 * here and measured again whenever it changes, so the circles stay one
 * readable size and never overlap; the numbers themselves never move, because
 * they follow the capture in reading order (`helpCallouts.ts`). Pointing at a
 * line of the list, or at a circle, rings its control on the capture and
 * lights its line.
 */
export default function HelpFigure({
  figure,
  src,
  title,
  onEnlarge,
}: IHelpFigureProps) {
  const { t } = useTranslation();
  const hostRef = useRef<HTMLDivElement>(null);
  const [room, setRoom] = useState<IRoom>();
  const [pointed, setPointed] = useState<number>();
  const controls = figure.controls ?? [];

  // Before the first paint, so the capture never appears at one size and
  // jumps to another. A resize of the window alone can change the height a
  // capture may take without changing the column's width, which is the one
  // thing the observer watches, so both are listened to.
  useLayoutEffect(() => {
    const host = hostRef.current;
    if (!host) {
      return undefined;
    }
    const measure = () =>
      setRoom((last) =>
        last?.width === host.clientWidth && last.height === window.innerHeight
          ? last
          : { width: host.clientWidth, height: window.innerHeight },
      );
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(host);
    window.addEventListener('resize', measure);
    return () => {
      observer.disconnect();
      window.removeEventListener('resize', measure);
    };
  }, []);

  const plan = useMemo(
    () =>
      room &&
      planHelpCallouts(figure, {
        width: room.width,
        maxImageHeight: room.height * HELP_CAPTURE_MAX_VIEWPORT,
      }),
    [figure, room],
  );
  const lit = plan?.callouts.find((callout) => callout.index === pointed);

  return (
    <figure className="help-figure">
      {figure.caption && (
        <h3 className="help-figure__caption">{t(figure.caption)}</h3>
      )}
      <div className="help-figure__host" ref={hostRef}>
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
                      callout.index === pointed ? ' is-lit' : ''
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
            {lit && (
              <span
                className="help-figure__ring"
                aria-hidden="true"
                style={{
                  left: lit.box.left,
                  top: lit.box.top,
                  width: lit.box.width,
                  height: lit.box.height,
                }}
              />
            )}
            {plan.callouts.map((callout) => (
              <span
                key={callout.index}
                className={`help-callout${
                  callout.index === pointed ? ' is-lit' : ''
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
                className={`help-control${index === pointed ? ' is-lit' : ''}`}
                onPointerEnter={() => setPointed(index)}
                onPointerLeave={() => setPointed(undefined)}
              >
                <span className="help-control__number" aria-hidden="true">
                  {number}
                </span>
                <span className="help-control__body">
                  <span className="help-control__name">
                    <strong>{t(control.name)}</strong>
                    {control.keys && <kbd>{control.keys}</kbd>}
                  </span>
                  <span className="help-control__text">{t(control.text)}</span>
                </span>
              </li>
            );
          })}
        </ol>
      )}
    </figure>
  );
}
