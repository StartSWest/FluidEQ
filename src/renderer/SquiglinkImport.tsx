/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>

This program is free software: you can redistribute it and/or modify
it under the terms of the GNU General Public License as published by
the Free Software Foundation, either version 3 of the License, or
(at your option) any later version.
*/

import { ChangeEvent, useEffect, useMemo, useRef, useState } from 'react';
import {
  AutoEqFormat,
  IFiltersMap,
  IGraphicEqPoint,
  ICustomFxSettings,
} from 'common/constants';
import { parseEqText } from 'common/apoText';
import { ErrorDescription } from 'common/errors';
import { useFluidEqContext } from './utils/FluidEqContext';
import { useTranslation } from './utils/I18nContext';
import Button from './widgets/Button';
import MenuIcon from './icons/MenuIcon';
import { clearGains, importEqText } from './utils/equalizerApi';
import {
  getCombinedLineData,
  getFilterLineData,
  getGraphicEqLineData,
} from './graph/utils';
import { IChartPointData } from './graph/ChartController';
import { hasCustomFxCurve } from '../common/customFx';
import { ColorEnum } from './styles/color';
import './styles/SquiglinkImport.scss';

const SQUIGLINK_URL = 'https://squig.link/';
const SQUIGLINK_TEXT_STORAGE_KEY = 'fluideq.squiglink-import.text';
const GRAPH_WIDTH = 640;
const GRAPH_HEIGHT = 164;
const GRAPH_PADDING = { top: 12, right: 12, bottom: 24, left: 30 };

const formatName = (format?: AutoEqFormat) => {
  if (format === AutoEqFormat.GRAPHIC) {
    return 'GraphicEQ';
  }
  if (format === AutoEqFormat.FIXED_BAND) {
    return 'Fixed Band EQ';
  }
  return 'Parametric EQ';
};

interface ICurvePath {
  path: string;
  min: number;
  max: number;
  points: IChartPointData[];
}

const makePath = (
  points: IChartPointData[],
  bounds?: { min: number; max: number },
): ICurvePath => {
  if (points.length === 0) {
    return { path: '', min: -12, max: 12, points };
  }

  const minValue = Math.min(...points.map((point) => point.y));
  const maxValue = Math.max(...points.map((point) => point.y));
  const min = bounds?.min ?? Math.min(-12, Math.floor(minValue / 3) * 3);
  const max = bounds?.max ?? Math.max(12, Math.ceil(maxValue / 3) * 3);
  const innerWidth = GRAPH_WIDTH - GRAPH_PADDING.left - GRAPH_PADDING.right;
  const innerHeight = GRAPH_HEIGHT - GRAPH_PADDING.top - GRAPH_PADDING.bottom;
  const logStart = Math.log10(20);
  const logEnd = Math.log10(20000);
  const x = (frequency: number) =>
    GRAPH_PADDING.left +
    ((Math.log10(frequency) - logStart) / (logEnd - logStart)) * innerWidth;
  const y = (gain: number) =>
    GRAPH_PADDING.top + ((max - gain) / (max - min)) * innerHeight;

  const stride = Math.max(1, Math.ceil(points.length / 180));
  const drawn = points.filter((_point, index) => index % stride === 0);
  const last = points[points.length - 1];
  if (drawn[drawn.length - 1] !== last) {
    drawn.push(last);
  }

  return {
    min,
    max,
    points,
    path: drawn
      .map(
        (point, index) =>
          `${index === 0 ? 'M' : 'L'}${x(point.x).toFixed(2)},${y(point.y).toFixed(2)}`,
      )
      .join(' '),
  };
};

const getCurvePoints = (
  preAmp: number,
  eqFormat: AutoEqFormat | undefined,
  graphicEq: IGraphicEqPoint[] | undefined,
  filters: IFiltersMap,
) => {
  if (eqFormat === AutoEqFormat.GRAPHIC && graphicEq?.length) {
    return getGraphicEqLineData(graphicEq).map((point) => ({
      x: point.x,
      y: point.y + preAmp,
    }));
  }
  const filterLines = Object.fromEntries(
    Object.values(filters).map((filter) => [
      filter.id,
      getFilterLineData(filter),
    ]),
  );
  return getCombinedLineData(preAmp, filterLines);
};

const makeCurve = (
  preAmp: number,
  eqFormat: AutoEqFormat | undefined,
  graphicEq: IGraphicEqPoint[] | undefined,
  filters: IFiltersMap,
) => makePath(getCurvePoints(preAmp, eqFormat, graphicEq, filters));

const makeCustomCurve = (customFx: ICustomFxSettings): ICurvePath => {
  const lines: Record<string, IChartPointData[]> = {};
  if (customFx.graphicEq?.length) {
    lines['custom-graphic'] = getGraphicEqLineData(customFx.graphicEq);
  }
  Object.values(customFx.filters).forEach((filter) => {
    lines[filter.id] = getFilterLineData(filter);
  });
  return makePath(getCombinedLineData(customFx.preAmp, lines));
};

const readStoredEqText = (): string | undefined => {
  try {
    const stored = window.localStorage.getItem(SQUIGLINK_TEXT_STORAGE_KEY);
    return stored === null ? undefined : stored;
  } catch {
    return undefined;
  }
};

const persistEqText = (value: string) => {
  try {
    window.localStorage.setItem(SQUIGLINK_TEXT_STORAGE_KEY, value);
  } catch {
    // Local storage can be unavailable in a restricted renderer. The applied
    // copy remains persisted with the EQ profile in that case.
  }
};

const SquiglinkImport = () => {
  const { t } = useTranslation();
  const {
    eqImport,
    eqFormat,
    filters,
    graphicEq,
    preAmp,
    customFx,
    bypassed,
    isBlockingError,
    refreshState,
    setGlobalError,
  } = useFluidEqContext();
  const storedEqTextRef = useRef<string | undefined>(readStoredEqText());
  const [text, setText] = useState(
    () => storedEqTextRef.current ?? eqImport?.text ?? '',
  );
  const [fileName, setFileName] = useState('');
  const [isImporting, setIsImporting] = useState(false);
  const [showFlatCurve, setShowFlatCurve] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (eqImport) {
      setShowFlatCurve(false);
    }
  }, [eqImport]);

  useEffect(() => {
    if (storedEqTextRef.current === undefined && eqImport?.text) {
      setText(eqImport.text);
    }
  }, [eqImport?.text]);

  useEffect(() => {
    persistEqText(text);
  }, [text]);

  const hasText = text.trim().length > 0;
  const parsedText = useMemo(
    () => (hasText ? parseEqText(text) : undefined),
    [hasText, text],
  );
  const livePreview =
    parsedText && !parsedText.isEmpty ? parsedText : undefined;
  const isPendingImportPreview = Boolean(
    livePreview &&
    (bypassed.includes('eq') ||
      !eqImport?.text ||
      eqImport.text.trim() !== text.trim()),
  );
  const hasCustomCurve =
    !showFlatCurve &&
    !bypassed.includes('custom') &&
    hasCustomFxCurve(customFx);
  const customCurve = useMemo(
    () => (hasCustomCurve && customFx ? makeCustomCurve(customFx) : undefined),
    [customFx, hasCustomCurve],
  );
  const hasPreview =
    !!livePreview ||
    (!hasText && !!eqImport) ||
    showFlatCurve ||
    hasCustomCurve;

  const curve = useMemo(() => {
    if (showFlatCurve) {
      return makeCurve(0, AutoEqFormat.PARAMETRIC, undefined, {});
    }
    if (livePreview) {
      return makeCurve(
        livePreview.preAmp,
        livePreview.eqFormat,
        livePreview.graphicEq,
        livePreview.filters,
      );
    }
    if (hasText || !eqImport) {
      return { path: '', min: -12, max: 12, points: [] };
    }
    return makeCurve(preAmp, eqFormat, graphicEq, filters);
  }, [
    eqFormat,
    eqImport,
    filters,
    graphicEq,
    hasText,
    livePreview,
    preAmp,
    showFlatCurve,
  ]);

  // Keep every visible line on the same dB scale. Independent auto-scaling
  // makes a gentle custom file look deceptively large beside a stronger import.
  const chartBounds = useMemo(
    () => ({
      min: Math.min(curve.min, customCurve?.min ?? curve.min),
      max: Math.max(curve.max, customCurve?.max ?? curve.max),
    }),
    [curve.max, curve.min, customCurve?.max, customCurve?.min],
  );
  const plottedCurve = useMemo(
    () => makePath(curve.points, chartBounds),
    [chartBounds, curve.points],
  );
  const plottedCustomCurve = useMemo(
    () => (customCurve ? makePath(customCurve.points, chartBounds) : undefined),
    [chartBounds, customCurve],
  );

  let previewBandCount = Object.keys(filters).length;
  if (showFlatCurve) {
    previewBandCount = 0;
  } else if (livePreview) {
    previewBandCount = Object.keys(livePreview.filters).length;
  } else if (!hasText && !eqImport && customFx) {
    previewBandCount = Object.keys(customFx.filters).length;
  }

  let previewFormat = eqImport?.eqFormat;
  if (showFlatCurve) {
    previewFormat = AutoEqFormat.PARAMETRIC;
  } else if (livePreview) {
    previewFormat = livePreview.eqFormat;
  } else if (!previewFormat) {
    previewFormat = customFx?.graphicEq?.length
      ? AutoEqFormat.GRAPHIC
      : AutoEqFormat.PARAMETRIC;
  }

  let previewLabel = eqImport?.label || customFx?.fileName;
  if (showFlatCurve) {
    previewLabel = t('squigImport.flatCurve');
  } else if (hasText) {
    previewLabel = fileName || t('squigImport.currentText');
  }

  let previewStatus = t('squigImport.applied');
  if (showFlatCurve) {
    previewStatus = t('squigImport.flatPreview');
  } else if (isPendingImportPreview) {
    previewStatus = t('squigImport.notApplied');
  }

  const primaryCurveLabel = isPendingImportPreview
    ? t('squigImport.livePreview')
    : t('squigImport.applied');
  const applyButtonLabel = isImporting
    ? t('squigImport.importing')
    : t('squigImport.apply');

  const handleFileChange = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file) {
      return;
    }
    try {
      setShowFlatCurve(false);
      setText(await file.text());
      setFileName(file.name);
    } catch (error) {
      setGlobalError(error as ErrorDescription);
    }
  };

  const handleImport = async () => {
    if (!text.trim()) {
      return;
    }
    setIsImporting(true);
    try {
      await importEqText(text, fileName || 'Squiglink export');
      await refreshState({ revealBands: true });
    } catch (error) {
      setGlobalError(error as ErrorDescription);
    } finally {
      setIsImporting(false);
    }
  };

  const handleClear = async () => {
    try {
      await clearGains();
      setText('');
      setFileName('');
      setShowFlatCurve(true);
      await refreshState();
    } catch (error) {
      setGlobalError(error as ErrorDescription);
    }
  };

  const frequencyLabels = [
    { value: 20, label: '20' },
    { value: 100, label: '100' },
    { value: 1000, label: '1k' },
    { value: 10000, label: '10k' },
    { value: 20000, label: '20k' },
  ];
  const mapX = (frequency: number) =>
    GRAPH_PADDING.left +
    ((Math.log10(frequency) - Math.log10(20)) /
      (Math.log10(20000) - Math.log10(20))) *
      (GRAPH_WIDTH - GRAPH_PADDING.left - GRAPH_PADDING.right);
  const mapY = (gain: number) =>
    GRAPH_PADDING.top +
    ((chartBounds.max - gain) / (chartBounds.max - chartBounds.min)) *
      (GRAPH_HEIGHT - GRAPH_PADDING.top - GRAPH_PADDING.bottom);

  return (
    <section className="squig-import" aria-labelledby="squig-import-title">
      <div className="squig-import__heading">
        <div>
          <p className="eyebrow">{t('squigImport.eyebrow')}</p>
          <h3 id="squig-import-title">{t('squigImport.title')}</h3>
          <p>{t('squigImport.intro')}</p>
        </div>
        <a
          className="squig-import__visit"
          href={SQUIGLINK_URL}
          target="_blank"
          rel="noreferrer"
        >
          <MenuIcon name="external" />
          <span>{t('squigImport.open')}</span>
        </a>
      </div>

      <div className="squig-import__steps">
        <span>
          <b>1</b>
          {t('squigImport.stepOne')}
        </span>
        <span>
          <b>2</b>
          {t('squigImport.stepTwo')}
        </span>
        <span>
          <b>3</b>
          {t('squigImport.stepThree')}
        </span>
      </div>

      <div className="squig-import__workspace">
        <div className="squig-import__input">
          <label htmlFor="squig-import-text">
            {t('squigImport.pasteLabel')}
          </label>
          <textarea
            id="squig-import-text"
            value={text}
            onChange={(event) => {
              setShowFlatCurve(false);
              setText(event.target.value);
            }}
            placeholder={t('squigImport.placeholder')}
            spellCheck={false}
            disabled={isBlockingError || isImporting}
          />
          <div className="squig-import__actions">
            <input
              ref={fileInputRef}
              className="squig-import__file"
              type="file"
              accept=".txt,.text"
              onChange={handleFileChange}
              disabled={isBlockingError || isImporting}
            />
            <Button
              className="small squig-import__file-button"
              ariaLabel={t('squigImport.fileAria')}
              isDisabled={isBlockingError || isImporting}
              handleChange={() => fileInputRef.current?.click()}
            >
              <MenuIcon name="import" />
              {fileName || t('squigImport.chooseFile')}
            </Button>
            <Button
              className="small squig-import__apply"
              ariaLabel={t('squigImport.applyAria')}
              isDisabled={isBlockingError || isImporting || !text.trim()}
              handleChange={handleImport}
            >
              <MenuIcon name="import" />
              {applyButtonLabel}
            </Button>
          </div>
        </div>

        <div className="squig-import__preview">
          {hasPreview ? (
            <>
              <div className="squig-import__preview-head">
                <div>
                  <span
                    className={`squig-import__status${
                      isPendingImportPreview
                        ? ' squig-import__status--pending'
                        : ''
                    }`}
                  >
                    <i />
                    {previewStatus}
                  </span>
                  <strong>{previewLabel}</strong>
                  <small>
                    {previewBandCount} {t('squigImport.bands')} ·{' '}
                    {formatName(previewFormat)}
                  </small>
                </div>
                {eqImport && (
                  <button
                    type="button"
                    className="squig-import__clear"
                    onClick={handleClear}
                    disabled={isBlockingError}
                  >
                    {t('squigImport.clear')}
                  </button>
                )}
              </div>
              <svg
                className="squig-import__chart"
                viewBox={`0 0 ${GRAPH_WIDTH} ${GRAPH_HEIGHT}`}
                role="img"
                aria-label={t('squigImport.chartAria')}
              >
                <defs>
                  <linearGradient id="squig-import-line" x1="0" x2="1">
                    <stop offset="0" stopColor="#8ce2ff" />
                    <stop offset="0.55" stopColor="#b9a7ff" />
                    <stop offset="1" stopColor="#f3a8d7" />
                  </linearGradient>
                </defs>
                {[chartBounds.min, 0, chartBounds.max].map((gain) => (
                  <line
                    key={gain}
                    x1={GRAPH_PADDING.left}
                    x2={GRAPH_WIDTH - GRAPH_PADDING.right}
                    y1={mapY(gain)}
                    y2={mapY(gain)}
                    className="squig-import__grid"
                  />
                ))}
                <path
                  d={plottedCurve.path}
                  className={`squig-import__curve${
                    isPendingImportPreview
                      ? ' squig-import__curve--pending'
                      : ''
                  }`}
                  fill="none"
                  stroke="url(#squig-import-line)"
                />
                {plottedCustomCurve && (
                  <path
                    d={plottedCustomCurve.path}
                    className="squig-import__curve squig-import__curve--custom"
                    fill="none"
                    stroke={ColorEnum.CUSTOM}
                  />
                )}
                {frequencyLabels.map((entry) => (
                  <text
                    key={entry.value}
                    x={mapX(entry.value)}
                    y={GRAPH_HEIGHT - 6}
                    className="squig-import__axis"
                    textAnchor="middle"
                  >
                    {entry.label}
                  </text>
                ))}
              </svg>
              {plottedCustomCurve && (
                <div className="squig-import__curve-key">
                  {plottedCurve.path && (
                    <span>
                      <i className="squig-import__curve-key-line" />
                      {primaryCurveLabel}
                    </span>
                  )}
                  <span>
                    <i className="squig-import__curve-key-line squig-import__curve-key-line--custom" />
                    {t('eq.layers.custom')}
                  </span>
                </div>
              )}
            </>
          ) : (
            <div className="squig-import__empty">
              <MenuIcon name="graph" />
              <strong>{t('squigImport.emptyTitle')}</strong>
              <p>{t('squigImport.emptyHint')}</p>
            </div>
          )}
        </div>
      </div>
    </section>
  );
};

export default SquiglinkImport;
