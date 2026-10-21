/* Copyright (C) 2026 Ivan Carmenates Garcia. SPDX-License-Identifier: GPL-3.0-or-later */

import { useEffect, useRef, useState, type ChangeEvent } from 'react';
import {
  CURVE_LIST_FILE_MAX,
  CURVE_NAME_MAX,
  CURVE_TEXT_MAX,
  fromCurveListFile,
  planCurveImport,
  readCurveText,
  type ICurveFileReading,
  type ICurveImportRow,
  type TCurveImportChoice,
} from 'common/myCurves';
import type { TranslationKey } from 'common/i18n';
import { useTranslation } from '../utils/I18nContext';
import MyCurveDialogShell from './MyCurveDialogShell';
import { CurveSpark } from './MyCurveRow';
import { getMyCurves, importMyCurves } from './myCurvesStore';

const CHOICES: readonly TCurveImportChoice[] = ['keep-both', 'replace', 'skip'];

const CHOICE_NAMES: Record<TCurveImportChoice, TranslationKey> = {
  'keep-both': 'myCurves.choice.keepBoth',
  replace: 'myCurves.choice.replace',
  skip: 'myCurves.choice.skip',
};

/** One chosen file read: a curve list, or one ParametricEQ text. */
const readChosen = async (
  file: File,
): Promise<ICurveFileReading | undefined> => {
  if (file.size > CURVE_LIST_FILE_MAX) {
    return undefined;
  }
  const contents = await file.text();
  const list = fromCurveListFile(contents);
  if (list) {
    return list;
  }
  if (contents.length <= CURVE_TEXT_MAX && readCurveText(contents)) {
    return {
      curves: [
        {
          name: file.name.replace(/\.[^.]+$/, '').slice(0, CURVE_NAME_MAX),
          text: contents,
          source: 'file',
          ears: 'both',
        },
      ],
      skipped: 0,
    };
  }
  return { curves: [], skipped: 1 };
};

/**
 * Curves into My curves: a FluidEQ curve list, one ParametricEQ .txt, or
 * several files at once. What is in them is shown before anything is added,
 * and a name already in the list is never overwritten quietly: keep both
 * (the new one numbered), replace, or skip, row by row. Nothing imported plays
 * by itself.
 */
export default function MyCurvesImportDialog({
  onClose,
}: {
  onClose: () => void;
}) {
  const { t } = useTranslation();
  const fileRef = useRef<HTMLInputElement>(null);
  const importRef = useRef<HTMLButtonElement>(null);
  const [rows, setRows] = useState<ICurveImportRow[] | undefined>();
  const [choices, setChoices] = useState<TCurveImportChoice[]>([]);
  const [skipped, setSkipped] = useState(0);
  const [fileNames, setFileNames] = useState('');

  const choose = (event: ChangeEvent<HTMLInputElement>) => {
    const files = [...(event.target.files ?? [])];
    // Read again if the same files are chosen twice.
    // eslint-disable-next-line no-param-reassign
    event.target.value = '';
    if (files.length === 0) {
      return;
    }
    Promise.all(files.map(readChosen))
      .then((readings) => {
        const curves = readings.flatMap((reading) => reading?.curves ?? []);
        const plan = planCurveImport(curves, getMyCurves());
        setRows(plan);
        setChoices(plan.map(() => 'keep-both'));
        setSkipped(
          readings.reduce(
            (sum, reading) => sum + (reading ? reading.skipped : 1),
            0,
          ),
        );
        setFileNames(files.map((file) => file.name).join(', '));
        return undefined;
      })
      .catch(() => {
        setRows([]);
        setSkipped(files.length);
      });
  };

  const run = () => {
    if (!rows) {
      return;
    }
    importMyCurves(
      rows.flatMap((row, index) => {
        const choice = choices[index];
        if (row.clashesWith && choice === 'skip') {
          return [];
        }
        return [
          {
            curve: {
              name: row.name,
              text: row.text,
              source: row.source,
              ears: row.ears,
            },
            replaces:
              row.clashesWith && choice === 'replace'
                ? row.clashesWith
                : undefined,
          },
        ];
      }),
    );
    onClose();
  };

  const coming = rows
    ? rows.filter(
        (row, index) => !(row.clashesWith && choices[index] === 'skip'),
      ).length
    : 0;

  // Reading the files takes away the Choose files button that held the
  // keyboard; the next thing to press is Import, so the keyboard goes there
  // rather than falling out of the dialog.
  const hasRows = Boolean(rows && rows.length > 0);
  useEffect(() => {
    if (hasRows) {
      importRef.current?.focus();
    }
  }, [hasRows]);

  return (
    <MyCurveDialogShell
      icon="download"
      title={t('myCurves.importTitle')}
      description={
        rows
          ? t('myCurves.importFrom', { files: fileNames })
          : t('myCurves.importIntro')
      }
      onClose={onClose}
      footer={
        <div className="dialog-frame__actions">
          <button
            type="button"
            className="button small subtle"
            onClick={onClose}
          >
            {t('myCurves.cancel')}
          </button>
          <button
            type="button"
            className="button small"
            ref={importRef}
            disabled={coming === 0}
            onClick={run}
          >
            {t('myCurves.importRun', { count: coming })}
          </button>
        </div>
      }
    >
      <input
        ref={fileRef}
        type="file"
        accept=".fqcurves,.json,.txt,application/json,text/plain"
        multiple
        hidden
        onChange={choose}
      />
      {!rows || rows.length === 0 ? (
        <div className="my-curve-import__pick">
          {rows && <p role="alert">{t('myCurves.importNothing')}</p>}
          <button
            type="button"
            className="button small"
            onClick={() => fileRef.current?.click()}
          >
            {t('myCurves.chooseFiles')}
          </button>
          <p className="my-curve-import__hint">{t('myCurves.importHint')}</p>
        </div>
      ) : (
        <>
          <ul className="my-curve-import__rows">
            {rows.map((row, index) => (
              <li
                key={`${row.name}-${String(index)}`}
                className="my-curve-import__row"
              >
                <span className="my-curve-import__name">
                  <strong>{row.name}</strong>
                  {row.clashesWith ? (
                    <span className="my-curve-import__clash">
                      {t('myCurves.clash')}
                    </span>
                  ) : (
                    <span className="my-curve-import__new">
                      {t('myCurves.new')}
                    </span>
                  )}
                </span>
                <CurveSpark text={row.text} />
                {row.clashesWith && (
                  <span
                    className="segmented my-curve-import__choice"
                    role="group"
                    aria-label={t('myCurves.clashChoice', { name: row.name })}
                  >
                    {CHOICES.map((choice) => (
                      <button
                        key={choice}
                        type="button"
                        className={`segmented__option${choices[index] === choice ? ' is-selected' : ''}`}
                        aria-pressed={choices[index] === choice}
                        onClick={() =>
                          setChoices(
                            choices.map((entry, at) =>
                              at === index ? choice : entry,
                            ),
                          )
                        }
                      >
                        {t(CHOICE_NAMES[choice])}
                      </button>
                    ))}
                  </span>
                )}
              </li>
            ))}
          </ul>
          {skipped > 0 && (
            <p className="my-curve-import__skipped">
              {t('myCurves.importSkipped', { count: skipped })}
            </p>
          )}
          <p className="my-curve-import__hint">{t('myCurves.importNote')}</p>
        </>
      )}
    </MyCurveDialogShell>
  );
}
