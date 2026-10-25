/* Copyright (C) 2026 Ivan Carmenates Garcia. SPDX-License-Identifier: GPL-3.0-or-later */

import { useEffect, useMemo, useRef, useState } from 'react';
import { AutoEqFormat } from 'common/constants';
import { readCurveText } from 'common/myCurves';
import { curveScales, makeCurve } from '../graph/curvePreview';
import MenuIcon from '../icons/MenuIcon';
import { useTranslation } from '../utils/I18nContext';

const frequencyAnchor = (frequency: number): 'start' | 'middle' | 'end' => {
  if (frequency === 20) {
    return 'start';
  }
  if (frequency === 20000) {
    return 'end';
  }
  return 'middle';
};

/** The preview keeps a place before parsing, so pasting never moves the form. */
export default function MyCurvePreview({
  text,
  name,
}: {
  text: string;
  name: string;
}) {
  const { t } = useTranslation();
  const host = useRef<HTMLDivElement>(null);
  const [width, setWidth] = useState(480);
  useEffect(() => {
    const element = host.current;
    if (!element) {
      return undefined;
    }
    const observer = new ResizeObserver(([entry]) => {
      if (entry.contentRect.width > 0) {
        setWidth(entry.contentRect.width);
      }
    });
    observer.observe(element);
    return () => observer.disconnect();
  }, []);
  const parsed = useMemo(() => readCurveText(text), [text]);
  // Match SVG units to its measured width: labels stay readable at every UI scale.
  const box = useMemo(
    () => ({
      width,
      height: 250,
      padding: { left: 38, right: 14, top: 18, bottom: 34 },
    }),
    [width],
  );
  const curve = useMemo(
    () =>
      parsed
        ? makeCurve(
            parsed.preAmp,
            parsed.eqFormat,
            parsed.graphicEq,
            parsed.filters,
            box,
          )
        : undefined,
    [box, parsed],
  );
  const bounds = { min: curve?.min ?? -12, max: curve?.max ?? 12 };
  const { x, y } = curveScales(box, bounds);
  const frequencies =
    width >= 330 ? [20, 100, 1000, 10000, 20000] : [20, 100, 1000, 20000];
  const gains = Array.from(
    { length: 5 },
    (_, i) => bounds.min + ((bounds.max - bounds.min) * i) / 4,
  );
  const format =
    parsed?.eqFormat === AutoEqFormat.GRAPHIC ? 'GraphicEQ' : 'ParametricEQ';
  return (
    <aside className="my-curve-preview">
      <div className="my-curve-preview__head">
        <span>{t('myCurves.preview')}</span>
        <span className="my-curve-preview__pending">
          {t('squigImport.notApplied')}
        </span>
      </div>
      <h3>{name || t('myCurves.addTitle')}</h3>
      <p>{t('myCurves.previewRange')}</p>
      <div className="my-curve-preview__graph" ref={host}>
        <svg
          viewBox={`0 0 ${width} 250`}
          role="img"
          aria-label={t('myCurves.chartAria', { name })}
        >
          {gains.map((gain) => (
            <g key={gain}>
              <line
                x1={box.padding.left}
                x2={width - box.padding.right}
                y1={y(gain)}
                y2={y(gain)}
                className={gain === 0 ? 'is-zero' : undefined}
              />
              <text x={box.padding.left - 8} y={y(gain) + 4} textAnchor="end">
                {gain > 0 ? '+' : ''}
                {gain}
              </text>
            </g>
          ))}
          {frequencies.map((frequency) => (
            <g key={frequency}>
              <line
                x1={x(frequency)}
                x2={x(frequency)}
                y1={box.padding.top}
                y2={250 - box.padding.bottom}
              />
              <text
                x={x(frequency)}
                y={236}
                textAnchor={frequencyAnchor(frequency)}
              >
                {frequency >= 1000 ? `${frequency / 1000}k` : frequency}
              </text>
            </g>
          ))}
          <text x={2} y={12}>
            dB
          </text>
          <text x={width - box.padding.right} y={249} textAnchor="end">
            Hz
          </text>
          {curve && <path d={curve.path} className="my-curve-preview__curve" />}
        </svg>
        {!curve && (
          <span className="my-curve-preview__empty">
            {t('myCurves.previewEmpty')}
          </span>
        )}
      </div>
      <dl className="my-curve-preview__stats">
        <div>
          <dt>{t('myCurves.filters')}</dt>
          <dd>
            {parsed
              ? (parsed.graphicEq?.length ?? Object.keys(parsed.filters).length)
              : '—'}
          </dd>
        </div>
        <div>
          <dt>{t('myCurves.preamp')}</dt>
          <dd>{parsed ? `${parsed.preAmp.toFixed(1)} dB` : '—'}</dd>
        </div>
        <div>
          <dt>{t('myCurves.format')}</dt>
          <dd>{parsed ? format : '—'}</dd>
        </div>
      </dl>
      <div className="my-curve-preview__note">
        <MenuIcon name="model" />
        <p>{t('myCurves.correctionHint')}</p>
      </div>
    </aside>
  );
}
