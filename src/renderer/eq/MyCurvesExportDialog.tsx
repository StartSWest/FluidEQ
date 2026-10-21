/* Copyright (C) 2026 Ivan Carmenates Garcia. SPDX-License-Identifier: GPL-3.0-or-later */

import { useState } from 'react';
import {
  curveFileNames,
  toCurveListFile,
  type IMyCurve,
} from 'common/myCurves';
import { useTranslation } from '../utils/I18nContext';
import { exportCurveFolder, exportCurveList } from '../utils/equalizerApi';
import MyCurveDialogShell from './MyCurveDialogShell';

type TFormat = 'list' | 'folder';

/**
 * My curves out of FluidEQ: the whole list as one file another FluidEQ
 * imports whole, or a folder of ParametricEQ .txt files, one a curve, for
 * Equalizer APO, Squiglink and the AutoEQ tools. Nothing about the outputs or
 * the account goes into either. The file is written by Save As in the main
 * process, which checks it is a curve list before it writes a byte.
 */
export default function MyCurvesExportDialog({
  curves,
  onClose,
}: {
  curves: readonly IMyCurve[];
  onClose: () => void;
}) {
  const { t } = useTranslation();
  const [format, setFormat] = useState<TFormat>('list');
  const [busy, setBusy] = useState(false);
  const [failed, setFailed] = useState(false);

  const run = async () => {
    setBusy(true);
    setFailed(false);
    try {
      const saved =
        format === 'list'
          ? await exportCurveList(
              t('myCurves.fileName'),
              toCurveListFile(curves),
            )
          : await exportCurveFolder(
              curveFileNames(curves).map((name, index) => ({
                name,
                text: curves[index].text,
              })),
            );
      if (saved) {
        onClose();
      }
    } catch {
      setFailed(true);
    } finally {
      setBusy(false);
    }
  };

  const option = (value: TFormat, title: string, hint: string) => (
    <label
      key={value}
      className={`my-curve-option${format === value ? ' is-selected' : ''}`}
      htmlFor={`my-curves-format-${value}`}
    >
      <input
        id={`my-curves-format-${value}`}
        type="radio"
        name="my-curves-format"
        checked={format === value}
        onChange={() => setFormat(value)}
      />
      <span className="my-curve-option__copy">
        <strong>{title}</strong>
        <span>{hint}</span>
      </span>
    </label>
  );

  return (
    <MyCurveDialogShell
      icon="upload"
      title={t('myCurves.exportTitle')}
      description={t('myCurves.exportIntro', { count: curves.length })}
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
            className={`button small${busy ? ' is-running' : ''}`}
            disabled={busy || curves.length === 0}
            onClick={() => {
              run().catch(() => undefined);
            }}
          >
            {t('myCurves.exportRun')}
          </button>
        </div>
      }
    >
      <fieldset className="my-curve-options">
        <legend className="eyebrow">{t('myCurves.format')}</legend>
        {option(
          'list',
          t('myCurves.format.list'),
          t('myCurves.format.listHint'),
        )}
        {option(
          'folder',
          t('myCurves.format.folder'),
          t('myCurves.format.folderHint'),
        )}
      </fieldset>
      {failed && (
        <p className="my-curve-dialog__error" role="alert">
          {t('myCurves.exportFailed')}
        </p>
      )}
    </MyCurveDialogShell>
  );
}
