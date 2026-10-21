/* Copyright (C) 2026 Ivan Carmenates Garcia. SPDX-License-Identifier: GPL-3.0-or-later */

import { useId, useMemo, useRef, useState, type ChangeEvent } from 'react';
import type { TImportEars } from 'common/bandEars';
import type { ErrorDescription } from 'common/errors';
import {
  CURVE_NAME_MAX,
  CURVE_TEXT_MAX,
  readCurveText,
  type TCurveSource,
} from 'common/myCurves';
import { useFluidEqContext } from '../utils/FluidEqContext';
import { useTranslation } from '../utils/I18nContext';
import { importEqText } from '../utils/equalizerApi';
import EqCurveChart from '../graph/EqCurveChart';
import { PREVIEW_BOX, makeCurve } from '../graph/curvePreview';
import ImportEarsPick from './ImportEarsPick';
import MyCurveDialogShell from './MyCurveDialogShell';
import { addMyCurve } from './myCurvesStore';

export interface IMyCurveDraft {
  text: string;
  /** Absent, the dialog names it "Squiglink curve, <date>". */
  name?: string;
  source: TCurveSource;
  ears: TImportEars;
}

/**
 * Add a curve to My curves: pasted, or read from a .txt file, or handed over
 * by the Squiglink panel already pasted (`initial`). The curve is drawn as it
 * will play before it is kept, and named on the spot — prefilled from where
 * it came from, because a list of "Squiglink export" ten times over is not a
 * list anybody can pick from.
 */
export default function MyCurveAddDialog({
  initial,
  onClose,
}: {
  initial?: IMyCurveDraft;
  onClose: () => void;
}) {
  const { t, locale } = useTranslation();
  const { refreshState, setGlobalError } = useFluidEqContext();
  const ids = useId();
  const fileRef = useRef<HTMLInputElement>(null);
  const today = useMemo(
    () =>
      new Date().toLocaleDateString(locale, { day: 'numeric', month: 'short' }),
    [locale],
  );
  const [text, setText] = useState(initial?.text ?? '');
  const [source, setSource] = useState<TCurveSource>(
    initial?.source ?? 'squiglink',
  );
  const [name, setName] = useState(
    initial?.name ?? t('myCurves.defaultName', { date: today }),
  );
  const [ears, setEars] = useState<TImportEars>(initial?.ears ?? 'both');
  const [busy, setBusy] = useState(false);
  const [fileFailed, setFileFailed] = useState(false);

  const parsed = useMemo(() => readCurveText(text), [text]);
  const curve = useMemo(
    () =>
      parsed
        ? makeCurve(
            parsed.preAmp,
            parsed.eqFormat,
            parsed.graphicEq,
            parsed.filters,
            PREVIEW_BOX,
          )
        : undefined,
    [parsed],
  );
  const bandCount = parsed
    ? (parsed.graphicEq?.length ?? Object.keys(parsed.filters).length)
    : 0;
  const canSave = Boolean(parsed) && name.trim().length > 0 && !busy;

  const readFile = (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    // Read again if the same file is chosen twice.
    // eslint-disable-next-line no-param-reassign
    event.target.value = '';
    if (!file) {
      return;
    }
    setFileFailed(false);
    if (file.size > CURVE_TEXT_MAX) {
      setFileFailed(true);
      return;
    }
    file
      .text()
      .then((contents) => {
        setText(contents);
        setSource('file');
        setName(file.name.replace(/\.[^.]+$/, '').slice(0, CURVE_NAME_MAX));
        return undefined;
      })
      .catch(() => setFileFailed(true));
  };

  const save = async (andApply: boolean) => {
    if (!canSave) {
      return;
    }
    const kept = addMyCurve({ text, name, source, ears });
    if (!kept) {
      return;
    }
    if (!andApply) {
      onClose();
      return;
    }
    setBusy(true);
    try {
      await importEqText(kept.text, kept.name, 'curve', 'both');
      await refreshState();
      onClose();
    } catch (error) {
      setGlobalError(error as ErrorDescription);
    } finally {
      setBusy(false);
    }
  };

  return (
    <MyCurveDialogShell
      icon="plus"
      title={t('myCurves.addTitle')}
      description={t('myCurves.addIntro')}
      busy={busy}
      onClose={onClose}
      footer={
        <div className="dialog-frame__actions">
          <button
            type="button"
            className="button small subtle"
            disabled={busy}
            onClick={onClose}
          >
            {t('myCurves.cancel')}
          </button>
          <button
            type="button"
            className="button small subtle"
            disabled={!canSave}
            onClick={() => {
              save(true).catch(() => undefined);
            }}
          >
            {t('myCurves.saveApply')}
          </button>
          <button
            type="button"
            className="button small"
            disabled={!canSave}
            onClick={() => {
              save(false).catch(() => undefined);
            }}
          >
            {t('myCurves.save')}
          </button>
        </div>
      }
    >
      <div className="my-curve-add">
        <div className="my-curve-add__source">
          <label className="my-curve-add__label" htmlFor={`${ids}-text`}>
            {t('myCurves.textLabel')}
          </label>
          <button
            type="button"
            className="button small subtle"
            onClick={() => fileRef.current?.click()}
          >
            {t('squigImport.chooseFile')}
          </button>
          <input
            ref={fileRef}
            type="file"
            accept=".txt,text/plain"
            hidden
            onChange={readFile}
          />
        </div>
        <textarea
          id={`${ids}-text`}
          className="my-curve-add__text"
          spellCheck={false}
          placeholder={t('myCurves.textPlaceholder')}
          value={text}
          onChange={(event) => {
            setText(event.target.value);
            if (source === 'file') {
              setSource('squiglink');
            }
          }}
        />
        <p
          className={`my-curve-add__read${parsed ? ' is-read' : ''}`}
          role="status"
        >
          {fileFailed && t('myCurves.fileFailed')}
          {!fileFailed &&
            text.trim() !== '' &&
            (parsed
              ? t('myCurves.read', {
                  count: bandCount,
                  preamp: parsed.preAmp.toFixed(1),
                })
              : t('myCurves.readNothing'))}
        </p>
        <div className="my-curve-add__row">
          <label className="my-curve-add__field" htmlFor={`${ids}-name`}>
            <span className="my-curve-add__label">{t('myCurves.name')}</span>
            <input
              id={`${ids}-name`}
              type="text"
              maxLength={CURVE_NAME_MAX}
              value={name}
              onChange={(event) => setName(event.target.value)}
            />
          </label>
          <span className="my-curve-add__field">
            <span className="my-curve-add__label">{t('myCurves.ears')}</span>
            <ImportEarsPick value={ears} onChange={setEars} />
          </span>
        </div>
        {curve && (
          <EqCurveChart
            className="my-curve-add__chart"
            box={PREVIEW_BOX}
            bounds={{ min: curve.min, max: curve.max }}
            ariaLabel={t('myCurves.chartAria', { name })}
            lines={[
              {
                id: 'curve',
                path: curve.path,
                className: 'my-curve-add__curve',
                stroke: 'currentColor',
              },
            ]}
          />
        )}
      </div>
    </MyCurveDialogShell>
  );
}
