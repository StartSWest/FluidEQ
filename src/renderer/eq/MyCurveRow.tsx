/* Copyright (C) 2026 Ivan Carmenates Garcia. SPDX-License-Identifier: GPL-3.0-or-later */

import {
  useCallback,
  useMemo,
  useRef,
  useState,
  type KeyboardEvent,
} from 'react';
import type { IMyCurve, TCurveSource } from 'common/myCurves';
import { CURVE_NAME_MAX, readCurveText } from 'common/myCurves';
import type { TranslationKey } from 'common/i18n';
import { useTranslation } from '../utils/I18nContext';
import { useClickOutside } from '../utils/utils';
import MenuIcon from '../icons/MenuIcon';
import { getCurvePoints, makePath } from '../graph/curvePreview';
import { IMPORT_EAR_NAMES } from './ImportEarsPick';

export const SOURCE_NAMES: Record<TCurveSource, TranslationKey> = {
  squiglink: 'myCurves.source.squiglink',
  file: 'myCurves.source.file',
  eq: 'myCurves.source.eq',
  opra: 'myCurves.source.opra',
};

/** The row's drawing of the curve: its shape at a glance, not a reading. */
const SPARK_BOX = {
  width: 120,
  height: 34,
  padding: { top: 3, right: 2, bottom: 3, left: 2 },
};

export const CurveSpark = ({ text }: { text: string }) => {
  const path = useMemo(() => {
    const parsed = readCurveText(text);
    if (!parsed) {
      return '';
    }
    return makePath(
      getCurvePoints(
        parsed.preAmp,
        parsed.eqFormat,
        parsed.graphicEq,
        parsed.filters,
      ),
      SPARK_BOX,
      { min: -12, max: 12 },
    ).path;
  }, [text]);
  return (
    <svg
      className="my-curve__spark"
      viewBox={`0 0 ${SPARK_BOX.width} ${SPARK_BOX.height}`}
      aria-hidden="true"
      focusable="false"
    >
      <line
        className="my-curve__zero"
        x1="0"
        x2={SPARK_BOX.width}
        y1={SPARK_BOX.height / 2}
        y2={SPARK_BOX.height / 2}
      />
      <path className="my-curve__line" d={path} />
    </svg>
  );
};

interface IMyCurveRowProps {
  curve: IMyCurve;
  /** This curve is the headphone correction playing now. */
  isPlaying: boolean;
  isDisabled: boolean;
  onApplyCurve: (curve: IMyCurve) => void;
  onApplyEq: (curve: IMyCurve) => void;
  onRename: (curve: IMyCurve, name: string) => void;
  onDuplicate: (curve: IMyCurve) => void;
  onEdit: (curve: IMyCurve) => void;
  onDelete: (curve: IMyCurve) => void;
}

/**
 * One of the listener's curves: its name, where it came from and when, its
 * shape, which ears, and what pressing it does — play it as the headphone
 * correction (the loud action, as OPRA's pick is) or put its bands in the EQ.
 * The rest is in its menu. Deleting and replacing the EQ each take a second
 * press, as Delete band does: neither has an undo.
 */
export default function MyCurveRow({
  curve,
  isPlaying,
  isDisabled,
  onApplyCurve,
  onApplyEq,
  onRename,
  onDuplicate,
  onEdit,
  onDelete,
}: IMyCurveRowProps) {
  const { t, locale } = useTranslation();
  const [isMenuOpen, setMenuOpen] = useState(false);
  const [isRenaming, setRenaming] = useState(false);
  const [draft, setDraft] = useState(curve.name);
  const [armed, setArmed] = useState<'delete' | 'eq' | undefined>();
  const [copied, setCopied] = useState(false);
  const added = useMemo(
    () =>
      new Date(curve.addedAt).toLocaleDateString(locale, {
        day: 'numeric',
        month: 'short',
      }),
    [curve.addedAt, locale],
  );

  const finishRename = () => {
    setRenaming(false);
    if (draft.trim() && draft.trim() !== curve.name) {
      onRename(curve, draft);
    } else {
      setDraft(curve.name);
    }
  };

  // A press anywhere else lets go of both: the menu closes as the app's
  // dropdowns do, and a first press of Delete or Apply as EQ is forgotten, so
  // a second press later is never taken as the confirmation of an old one.
  const rowRef = useRef<HTMLLIElement>(null);
  const moreRef = useRef<HTMLSpanElement>(null);
  const letGo = useCallback(() => {
    setMenuOpen(false);
    setArmed(undefined);
  }, []);
  const closeMenu = useCallback(() => setMenuOpen(false), []);
  useClickOutside(rowRef, letGo);
  useClickOutside(moreRef, closeMenu);
  const escapeLetsGo = (event: KeyboardEvent) => {
    if (event.key === 'Escape' && (isMenuOpen || armed)) {
      event.stopPropagation();
      letGo();
    }
  };

  return (
    <li ref={rowRef} className={`my-curve${isPlaying ? ' is-playing' : ''}`}>
      <span className="my-curve__name">
        {isRenaming ? (
          <input
            className="my-curve__rename"
            aria-label={t('myCurves.rename')}
            value={draft}
            maxLength={CURVE_NAME_MAX}
            // The field is what the press opened; it takes the caret.
            // eslint-disable-next-line jsx-a11y/no-autofocus
            autoFocus
            onChange={(event) => setDraft(event.target.value)}
            onBlur={finishRename}
            onKeyDown={(event) => {
              if (event.key === 'Enter') {
                finishRename();
              } else if (event.key === 'Escape') {
                event.stopPropagation();
                setDraft(curve.name);
                setRenaming(false);
              }
            }}
          />
        ) : (
          <strong title={curve.name}>{curve.name}</strong>
        )}
        <span className="my-curve__meta">
          {isPlaying && (
            <span className="my-curve__on">{t('profiles.attached')}</span>
          )}
          <span
            className={`my-curve__source my-curve__source--${curve.source}`}
          >
            {t(SOURCE_NAMES[curve.source])}
          </span>
          <span>{t('myCurves.added', { date: added })}</span>
        </span>
      </span>
      <CurveSpark text={curve.text} />
      <span className="my-curve__ears">{t(IMPORT_EAR_NAMES[curve.ears])}</span>
      <span className="my-curve__actions">
        <button
          type="button"
          className={`button small${isPlaying ? ' subtle' : ''}`}
          disabled={isDisabled || isPlaying}
          onClick={() => onApplyCurve(curve)}
        >
          {isPlaying ? t('myCurves.playing') : t('squigImport.applyCurve')}
        </button>
        <button
          type="button"
          className={`button small subtle${armed === 'eq' ? ' is-armed' : ''}`}
          disabled={isDisabled}
          title={t('myCurves.applyEqHint')}
          onKeyDown={escapeLetsGo}
          onClick={() => {
            if (armed === 'eq') {
              setArmed(undefined);
              onApplyEq(curve);
            } else {
              setArmed('eq');
            }
          }}
        >
          {armed === 'eq' ? t('myCurves.replaceBands') : t('squigImport.apply')}
        </button>
        <span ref={moreRef} className="my-curve__more">
          <button
            type="button"
            className="my-curve__more-button"
            aria-label={t('myCurves.more', { name: curve.name })}
            aria-expanded={isMenuOpen}
            onKeyDown={escapeLetsGo}
            onClick={() => {
              setMenuOpen(!isMenuOpen);
              setArmed(undefined);
            }}
          >
            <MenuIcon name="menu" />
          </button>
          {isMenuOpen && (
            <span
              className="my-curve__menu"
              role="menu"
              tabIndex={-1}
              onKeyDown={escapeLetsGo}
            >
              <button
                type="button"
                role="menuitem"
                onClick={() => {
                  setMenuOpen(false);
                  setDraft(curve.name);
                  setRenaming(true);
                }}
              >
                {t('myCurves.rename')}
              </button>
              <button
                type="button"
                role="menuitem"
                onClick={() => {
                  setMenuOpen(false);
                  onEdit(curve);
                }}
              >
                {t('myCurves.editBands')}
              </button>
              <button
                type="button"
                role="menuitem"
                onClick={() => {
                  setMenuOpen(false);
                  onDuplicate(curve);
                }}
              >
                {t('myCurves.duplicate')}
              </button>
              <button
                type="button"
                role="menuitem"
                onClick={() => {
                  navigator.clipboard
                    .writeText(curve.text)
                    .then(() => setCopied(true))
                    .catch(() => setCopied(false));
                }}
              >
                {copied ? t('myCurves.copied') : t('myCurves.copyText')}
              </button>
              <button
                type="button"
                role="menuitem"
                className="my-curve__delete"
                onClick={() => {
                  if (armed === 'delete') {
                    setMenuOpen(false);
                    setArmed(undefined);
                    onDelete(curve);
                  } else {
                    setArmed('delete');
                  }
                }}
              >
                {armed === 'delete'
                  ? t('myCurves.deleteConfirm')
                  : t('myCurves.delete')}
              </button>
            </span>
          )}
        </span>
      </span>
    </li>
  );
}
