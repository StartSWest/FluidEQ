/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>

This program is free software: you can redistribute it and/or modify
it under the terms of the GNU General Public License as published by
the Free Software Foundation, either version 3 of the License, or
(at your option) any later version.
*/

import { ChangeEvent, useEffect, useMemo, useRef, useState } from 'react';
import { AutoEqFormat, ICustomFxSettings } from 'common/constants';
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
import EqCurveChart from './graph/EqCurveChart';
import {
  ICurvePath,
  PREVIEW_BOX,
  makeCurve,
  makePath,
} from './graph/curvePreview';
import { hasCustomFxCurve } from '../common/customFx';
import { ColorEnum } from './styles/color';
import './styles/SquiglinkImport.scss';

const SQUIGLINK_URL = 'https://squig.link/';
const SQUIGLINK_TEXT_STORAGE_KEY = 'fluideq.squiglink-import.text';

const formatName = (format?: AutoEqFormat) => {
  if (format === AutoEqFormat.GRAPHIC) {
    return 'GraphicEQ';
  }
  if (format === AutoEqFormat.FIXED_BAND) {
    return 'Fixed Band EQ';
  }
  return 'Parametric EQ';
};

const makeCustomCurve = (customFx: ICustomFxSettings): ICurvePath => {
  const lines: Record<string, IChartPointData[]> = {};
  if (customFx.graphicEq?.length) {
    lines['custom-graphic'] = getGraphicEqLineData(customFx.graphicEq);
  }
  Object.values(customFx.filters).forEach((filter) => {
    lines[filter.id] = getFilterLineData(filter);
  });
  return makePath(getCombinedLineData(customFx.preAmp, lines), PREVIEW_BOX);
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
      return makeCurve(0, AutoEqFormat.PARAMETRIC, undefined, {}, PREVIEW_BOX);
    }
    if (livePreview) {
      return makeCurve(
        livePreview.preAmp,
        livePreview.eqFormat,
        livePreview.graphicEq,
        livePreview.filters,
        PREVIEW_BOX,
      );
    }
    if (hasText || !eqImport) {
      return { path: '', min: -12, max: 12, points: [] };
    }
    return makeCurve(preAmp, eqFormat, graphicEq, filters, PREVIEW_BOX);
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
    () => makePath(curve.points, PREVIEW_BOX, chartBounds),
    [chartBounds, curve.points],
  );
  const plottedCustomCurve = useMemo(
    () =>
      customCurve
        ? makePath(customCurve.points, PREVIEW_BOX, chartBounds)
        : undefined,
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

  return (
    <section className="squig-import" aria-labelledby="squig-import-title">
      <div className="squig-import__heading">
        <div>
          <p className="eyebrow">{t('squigImport.eyebrow')}</p>
          <h3 id="squig-import-title">{t('squigImport.title')}</h3>
          <p>{t('squigImport.intro')}</p>
        </div>
      </div>

      {/* The link sits in step one rather than in the corner of the card. It is
          the first thing the instructions tell you to do, and a button filed
          away from the sentence that asks for it reads as decoration. */}
      <div className="squig-import__steps">
        <span>
          <b>1</b>
          {t('squigImport.stepOne')}
          <a
            className="squig-import__visit"
            href={SQUIGLINK_URL}
            target="_blank"
            rel="noreferrer"
          >
            <MenuIcon name="external" />
            <span>{t('squigImport.open')}</span>
          </a>
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
              <EqCurveChart
                className="squig-import__chart"
                box={PREVIEW_BOX}
                bounds={chartBounds}
                ariaLabel={t('squigImport.chartAria')}
                defs={
                  <linearGradient id="squig-import-line" x1="0" x2="1">
                    <stop offset="0" stopColor="#8ce2ff" />
                    <stop offset="0.55" stopColor="#b9a7ff" />
                    <stop offset="1" stopColor="#f3a8d7" />
                  </linearGradient>
                }
                lines={[
                  {
                    id: 'import',
                    path: plottedCurve.path,
                    className: `squig-import__curve${
                      isPendingImportPreview
                        ? ' squig-import__curve--pending'
                        : ''
                    }`,
                    stroke: 'url(#squig-import-line)',
                  },
                  ...(plottedCustomCurve
                    ? [
                        {
                          id: 'custom',
                          path: plottedCustomCurve.path,
                          className:
                            'squig-import__curve squig-import__curve--custom',
                          stroke: ColorEnum.CUSTOM,
                        },
                      ]
                    : []),
                ]}
              />
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

      {/* The same footing the OPRA card has: whose data this is, said on the
          surface that browses it. An app icon rather than Squiglink's own mark,
          which is not ours to ship — drop the real one in `assets` and swap the
          glyph for an <img> if that changes. */}
      <div className="squig-import__credit">
        <span className="squig-import__credit-mark" aria-hidden="true">
          <MenuIcon name="graph" />
        </span>
        <p>
          {t('squigImport.about')}{' '}
          <a href={SQUIGLINK_URL} target="_blank" rel="noreferrer">
            {t('squigImport.open')}
          </a>
        </p>
      </div>
    </section>
  );
};

export default SquiglinkImport;
