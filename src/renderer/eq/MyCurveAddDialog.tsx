/* Copyright (C) 2026 Ivan Carmenates Garcia. SPDX-License-Identifier: GPL-3.0-or-later */

import {
  useEffect,
  useId,
  useMemo,
  useRef,
  useState,
  type ChangeEvent,
} from 'react';
import type { TImportEars } from 'common/bandEars';
import type { ErrorDescription } from 'common/errors';
import { OPRA_SOURCE_ID } from 'common/constants';
import { curveTextOf, eqCurveText } from 'common/curveText';
import {
  CURVE_LIST_MAX,
  CURVE_NAME_MAX,
  CURVE_TEXT_MAX,
  readCurveText,
  type IMyCurve,
  type TCurveSource,
} from 'common/myCurves';
import { useFluidEqContext } from '../utils/FluidEqContext';
import { useTranslation } from '../utils/I18nContext';
import { importEqText } from '../utils/equalizerApi';
import MenuIcon from '../icons/MenuIcon';
import {
  hasEqToReplace,
  persistEqText,
  readStoredEqText,
} from '../utils/squiglinkImport';
import { appliedOpraName, knownOpraProducts } from '../opraProducts';
import ImportEarsPick from './ImportEarsPick';
import MyCurveDialogShell from './MyCurveDialogShell';
import MyCurvePreview from './MyCurvePreview';
import MyCurveSourcePick, { type TCurveOrigin } from './MyCurveSourcePick';
import {
  addMyCurve,
  isMyCurvesFull,
  updateMyCurve,
  useMyCurves,
} from './myCurvesStore';
import '../styles/MyCurveAdd.scss';

const ORIGIN_OF: Record<TCurveSource, TCurveOrigin> = {
  squiglink: 'paste',
  file: 'file',
  eq: 'eq',
  opra: 'opra',
};

const SOURCE_OF: Record<TCurveOrigin, TCurveSource> = {
  paste: 'squiglink',
  file: 'file',
  eq: 'eq',
  opra: 'opra',
};

/**
 * Add a curve to My curves, or edit one already there (`editing`): pasted,
 * read from a .txt file, taken from the EQ as it plays, or copied from the
 * OPRA correction playing now. The curve is drawn as it will play before it
 * is kept, every line it could not read is named, and it is named on the
 * spot, from where it came: a list of "Squiglink export" ten times over is
 * not a list anybody can pick from. Squiglink's shortcut opens this same
 * importer; its old draft is retained when the separate tab goes away.
 */
export default function MyCurveAddDialog({
  editing,
  onClose,
}: {
  editing?: IMyCurve;
  onClose: () => void;
}) {
  const { t, locale } = useTranslation();
  const {
    preAmp,
    filters,
    headphone,
    headset,
    headsetSource,
    headsetTarget,
    eqImport,
    graphicEq,
    activeDeviceId,
    isBlockingError,
    refreshState,
    setGlobalError,
  } = useFluidEqContext();
  const curves = useMyCurves();
  const ids = useId();
  const fileRef = useRef<HTMLInputElement>(null);
  const today = useMemo(
    () =>
      new Date().toLocaleDateString(locale, { day: 'numeric', month: 'short' }),
    [locale],
  );
  const [text, setText] = useState(
    () =>
      editing?.text ??
      readStoredEqText() ??
      headphone?.eqImport?.text ??
      eqImport?.text ??
      '',
  );
  const [origin, setOrigin] = useState<TCurveOrigin>(
    ORIGIN_OF[editing?.source ?? 'squiglink'],
  );
  const [name, setName] = useState(
    editing?.name ?? t('myCurves.defaultName', { date: today }),
  );
  const [isNameTyped, setNameTyped] = useState(Boolean(editing));
  const [ears, setEars] = useState<TImportEars>(editing?.ears ?? 'both');
  const [busy, setBusy] = useState(false);
  const [fileFailed, setFileFailed] = useState(false);
  const [replaceArmed, setReplaceArmed] = useState(false);
  const [isAdvancedOpen, setAdvancedOpen] = useState(false);
  useEffect(() => {
    if (!editing && origin === 'paste') {
      persistEqText(text);
    }
  }, [editing, origin, text]);

  // The OPRA correction playing now: a correction from the library, never a
  // Squiglink curve played as one, which is already text somebody has.
  const opra = useMemo(() => {
    if (
      !headphone ||
      headphone.eqImport ||
      headsetSource !== OPRA_SOURCE_ID ||
      Object.keys(headphone.filters).length === 0
    ) {
      return undefined;
    }
    return {
      text: curveTextOf({
        preAmp: 0,
        filters: headphone.filters,
        graphicEq: headphone.graphicEq,
      }),
      name: appliedOpraName(
        knownOpraProducts() ?? [],
        headset,
        headsetSource,
        headsetTarget,
      ),
    };
  }, [headphone, headset, headsetSource, headsetTarget]);

  // Your EQ for the ears chosen, while that is what the box holds.
  const eqNow = useMemo(
    () => eqCurveText(preAmp, filters, ears),
    [preAmp, filters, ears],
  );
  const shownText = origin === 'eq' && !editing ? eqNow.text : text;

  const parsed = useMemo(() => readCurveText(shownText), [shownText]);
  const bandCount = parsed
    ? (parsed.graphicEq?.length ?? Object.keys(parsed.filters).length)
    : 0;
  const isFull = !editing && isMyCurvesFull(curves);
  const canSave = Boolean(parsed) && name.trim().length > 0 && !busy && !isFull;
  useEffect(() => setReplaceArmed(false), [shownText, ears, activeDeviceId]);

  const nameFrom = (next: string) => {
    if (!isNameTyped) {
      setName(next.slice(0, CURVE_NAME_MAX));
    }
  };

  const pick = (next: TCurveOrigin) => {
    if (next === 'file') {
      fileRef.current?.click();
      return;
    }
    if (next === 'eq') {
      nameFrom(t('myCurves.defaultNameEq', { date: today }));
    } else if (next === 'opra' && opra) {
      setText(opra.text);
      setEars('both');
      nameFrom(opra.name ?? t('myCurves.defaultNameOpra', { date: today }));
    } else if (next === 'paste' && origin !== 'paste') {
      // A file or a live EQ must not overwrite the independent Squiglink draft.
      setText(readStoredEqText() ?? '');
      nameFrom(t('myCurves.defaultName', { date: today }));
    }
    setOrigin(next);
  };

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
        setOrigin('file');
        nameFrom(file.name.replace(/\.[^.]+$/, ''));
        return undefined;
      })
      .catch(() => setFileFailed(true));
  };

  const save = async (destination?: 'curve' | 'eq') => {
    if (!canSave || (destination && isBlockingError)) {
      return;
    }
    setBusy(true);
    try {
      const kept = editing
        ? await updateMyCurve(editing.id, { name, text: shownText, ears })
        : await addMyCurve({
            text: shownText,
            name,
            source: SOURCE_OF[origin],
            ears,
          });
      if (!kept) {
        return;
      }
      if (destination) {
        await importEqText(
          kept.text,
          kept.name,
          destination,
          destination === 'eq' ? ears : 'both',
        );
        await refreshState({ revealBands: destination === 'eq' });
      }
      onClose();
    } catch (error) {
      setGlobalError(error as ErrorDescription);
    } finally {
      setBusy(false);
    }
  };

  const unread = parsed?.unreadLines ?? [];

  return (
    <MyCurveDialogShell
      className="my-curve-add-dialog"
      icon={editing ? 'pencil' : 'plus'}
      title={t(editing ? 'myCurves.editTitle' : 'myCurves.addTitle')}
      description={t(editing ? 'myCurves.editIntro' : 'myCurves.addIntro')}
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
          {!editing && (
            <button
              type="button"
              className="button small subtle"
              disabled={!canSave || isBlockingError}
              onClick={() => {
                save('curve').catch(() => undefined);
              }}
            >
              {t('myCurves.saveApply')}
            </button>
          )}
          <button
            type="button"
            className="button small"
            disabled={!canSave}
            onClick={() => {
              save().catch(() => undefined);
            }}
          >
            {t(editing ? 'myCurves.saveChanges' : 'myCurves.save')}
          </button>
        </div>
      }
    >
      <div className="my-curve-add">
        {isFull && (
          <p className="my-curve-add__full" role="alert">
            {t('myCurves.full', { count: CURVE_LIST_MAX })}
          </p>
        )}
        {!editing && (
          <MyCurveSourcePick
            value={origin}
            hasOpra={Boolean(opra)}
            onPick={pick}
          />
        )}
        <div className="my-curve-add__workspace">
          <div className="my-curve-add__form">
            {origin === 'paste' && (
              <div className="my-curve-add__guide">
                <div>
                  <strong>{t('myCurves.squiglinkGuide')}</strong>
                  <a
                    href="https://squig.link/"
                    target="_blank"
                    rel="noreferrer"
                  >
                    <span>{t('squigImport.open')}</span>
                    <MenuIcon name="external" />
                  </a>
                </div>
                <p>{t('myCurves.squiglinkSteps')}</p>
              </div>
            )}
            <input
              ref={fileRef}
              type="file"
              accept=".txt,text/plain"
              hidden
              onChange={readFile}
            />
            <label className="my-curve-add__label" htmlFor={`${ids}-text`}>
              {t('myCurves.textLabel')}
            </label>
            <textarea
              id={`${ids}-text`}
              className="my-curve-add__text"
              spellCheck={false}
              placeholder={t('myCurves.textPlaceholder')}
              value={shownText}
              readOnly={origin === 'eq' && !editing}
              onChange={(event) => setText(event.target.value)}
            />
            <div className="my-curve-add__status" role="status">
              <p className={`my-curve-add__read${parsed ? ' is-read' : ''}`}>
                {fileFailed && t('myCurves.fileFailed')}
                {!fileFailed &&
                  shownText.trim() !== '' &&
                  (parsed
                    ? t('myCurves.read', {
                        count: bandCount,
                        preamp: parsed.preAmp.toFixed(1),
                      })
                    : t('myCurves.readNothing'))}
              </p>
              {unread.length > 0 && (
                <p className="my-curve-add__unread">
                  {t('myCurves.unread', { lines: unread.join(', ') })}
                </p>
              )}
              {origin === 'eq' && !editing && eqNow.leftOut > 0 && (
                <p className="my-curve-add__unread">
                  {t('myCurves.eqLeftOut', { count: eqNow.leftOut })}
                </p>
              )}
            </div>
            <div className="my-curve-add__row">
              <label className="my-curve-add__field" htmlFor={`${ids}-name`}>
                <span className="my-curve-add__label">
                  {t('myCurves.name')}
                </span>
                <input
                  id={`${ids}-name`}
                  type="text"
                  maxLength={CURVE_NAME_MAX}
                  value={name}
                  onChange={(event) => {
                    setName(event.target.value);
                    setNameTyped(true);
                  }}
                />
              </label>
            </div>
            <div className="my-curve-add__provenance">
              <span>{t('myCurves.sourceLabel')}</span>
              <span>
                {t(`myCurves.source.${editing?.source ?? SOURCE_OF[origin]}`)}
              </span>
            </div>
            {(editing || origin === 'eq') && (
              <div className="my-curve-add__field">
                <span className="my-curve-add__label">
                  {t('myCurves.ears')}
                </span>
                <ImportEarsPick value={ears} onChange={setEars} />
              </div>
            )}
            {!editing && (
              <details
                className="my-curve-add__advanced"
                open={isAdvancedOpen}
                onToggle={(event) => setAdvancedOpen(event.currentTarget.open)}
              >
                <summary tabIndex={0}>{t('myCurves.editableEq')}</summary>
                {isAdvancedOpen && (
                  <>
                    <p>{t('myCurves.editableEqHint')}</p>
                    {origin !== 'eq' && (
                      <ImportEarsPick value={ears} onChange={setEars} />
                    )}
                    <button
                      type="button"
                      className="button small subtle"
                      disabled={!canSave || isBlockingError}
                      onClick={() => {
                        if (
                          !replaceArmed &&
                          hasEqToReplace({
                            eqImport,
                            preAmp,
                            filters,
                            graphicEq,
                          })
                        ) {
                          setReplaceArmed(true);
                        } else {
                          save('eq').catch(() => undefined);
                        }
                      }}
                    >
                      {t(
                        replaceArmed
                          ? 'myCurves.replaceBands'
                          : 'myCurves.saveReplaceEq',
                      )}
                    </button>
                  </>
                )}
              </details>
            )}
          </div>
          <MyCurvePreview text={shownText} name={name} />
        </div>
      </div>
    </MyCurveDialogShell>
  );
}
