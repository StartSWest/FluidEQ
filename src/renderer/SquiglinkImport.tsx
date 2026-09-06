/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>

This program is free software: you can redistribute it and/or modify
it under the terms of the GNU General Public License as published by
the Free Software Foundation, either version 3 of the License, or
(at your option) any later version.
*/

import {
  ChangeEvent,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import { AutoEqFormat } from 'common/constants';
import { parseEqText } from 'common/apoText';
import { ErrorDescription } from 'common/errors';
import { useFluidEqContext } from './utils/FluidEqContext';
import { useTranslation } from './utils/I18nContext';
import Button from './widgets/Button';
import MenuIcon from './icons/MenuIcon';
import { clearGains, importEqText, setHeadphone } from './utils/equalizerApi';
import EqCurveChart from './graph/EqCurveChart';
import SquiglinkImportConfirm from './components/SquiglinkImportConfirm';
import { PREVIEW_BOX, makeCurve, makePath } from './graph/curvePreview';
import { hasCustomFxCurve } from '../common/customFx';
import {
  formatName,
  hasEqToReplace,
  makeCustomCurve,
  makeImportedHeadphoneCurve,
  readStoredEqText,
  persistEqText,
} from './utils/squiglinkImport';
import { ColorEnum } from './styles/color';
import './styles/SquiglinkImport.scss';

const SQUIGLINK_URL = 'https://squig.link/';

const SquiglinkImport = () => {
  const { t } = useTranslation();
  const {
    eqImport: bandImport,
    activeDeviceId,
    headphone,
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
  const eqImport = headphone?.eqImport ?? bandImport;
  const storedEqTextRef = useRef<string | undefined>(readStoredEqText());
  const [text, setText] = useState(
    () => storedEqTextRef.current ?? eqImport?.text ?? '',
  );
  const [fileName, setFileName] = useState('');
  const [isImporting, setIsImporting] = useState(false);
  const [confirmDeviceId, setConfirmDeviceId] = useState<string>();
  const cancelImport = useCallback(() => setConfirmDeviceId(undefined), []);
  useEffect(() => {
    setConfirmDeviceId(undefined);
  }, [activeDeviceId]);
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
    (eqImport &&
      (bypassed.includes(headphone?.eqImport ? 'headphone' : 'eq') ||
        (headphone?.eqImport && headphone.intensity <= 0))) ||
    (livePreview && (!eqImport?.text || eqImport.text.trim() !== text.trim())),
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
    // Imported corrections share OPRA's audio layer, but their applied graph
    // stays in this panel and follows that layer's strength.
    if (
      headphone?.eqImport &&
      !isPendingImportPreview &&
      (!hasText || livePreview)
    ) {
      return makeImportedHeadphoneCurve(headphone);
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
    return makeCurve(
      preAmp,
      headphone?.eqImport ? eqImport.eqFormat : eqFormat,
      headphone?.eqImport ? headphone.graphicEq : graphicEq,
      headphone?.eqImport ? headphone.filters : filters,
      PREVIEW_BOX,
    );
  }, [
    eqFormat,
    eqImport,
    filters,
    graphicEq,
    headphone,
    isPendingImportPreview,
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

  let previewBandCount = eqImport?.filterCount ?? Object.keys(filters).length;
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

  const handleImport = async (destination: 'eq' | 'curve') => {
    if (!text.trim()) {
      return;
    }
    setIsImporting(true);
    try {
      await importEqText(text, fileName || 'Squiglink export', destination);
      await refreshState({ revealBands: destination === 'eq' });
    } catch (error) {
      setGlobalError(error as ErrorDescription);
    } finally {
      setIsImporting(false);
    }
  };

  const requestEqImport = () => {
    const hasEq = hasEqToReplace({
      eqImport: bandImport,
      preAmp,
      graphicEq,
      filters,
    });
    if (hasEq && livePreview) {
      setConfirmDeviceId(activeDeviceId);
    } else {
      handleImport('eq');
    }
  };

  const handleClear = async () => {
    try {
      // Removing a correction must never reset the independently edited bands.
      if (headphone?.eqImport) {
        await setHeadphone(undefined);
      } else {
        await clearGains();
      }
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
      {confirmDeviceId !== undefined && confirmDeviceId === activeDeviceId && (
        <SquiglinkImportConfirm
          onCancel={cancelImport}
          onApply={(destination) => {
            cancelImport();
            handleImport(destination);
          }}
        />
      )}
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
              handleChange={requestEqImport}
            >
              <MenuIcon name="import" />
              {applyButtonLabel}
            </Button>
            <Button
              className="small squig-import__apply"
              ariaLabel={t('squigImport.applyCurve')}
              isDisabled={isBlockingError || isImporting || !text.trim()}
              handleChange={() => handleImport('curve')}
            >
              <MenuIcon name="graph" />
              {isImporting
                ? t('squigImport.importing')
                : t('squigImport.applyCurve')}
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
