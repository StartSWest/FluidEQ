/* Copyright (C) 2026 Ivan Carmenates Garcia. SPDX-License-Identifier: GPL-3.0-or-later */

import { useMemo, useState } from 'react';
import type { IMyCurve } from 'common/myCurves';
import type { ErrorDescription } from 'common/errors';
import { useFluidEqContext } from '../utils/FluidEqContext';
import { useTranslation } from '../utils/I18nContext';
import { importEqText } from '../utils/equalizerApi';
import MenuIcon from '../icons/MenuIcon';
import MyCurveRow from './MyCurveRow';
import MyCurveAddDialog from './MyCurveAddDialog';
import MyCurvesExportDialog from './MyCurvesExportDialog';
import MyCurvesImportDialog from './MyCurvesImportDialog';
import {
  duplicateMyCurve,
  removeMyCurve,
  renameMyCurve,
  useMyCurves,
} from './myCurvesStore';
import '../styles/MyCurves.scss';

type TSort = 'recent' | 'name';
type TDialog = 'add' | 'export' | 'import' | undefined;

/**
 * My curves, the tab beside OPRA's library on the EQ Presets page: every
 * curve the listener kept, found by name, played as the headphone correction
 * or put into the EQ, and carried to another FluidEQ as one list (Ivan,
 * 2026-10-20: "users can add and name the curves and create nice list they
 * can export and import the list").
 */
export default function MyCurvesPanel() {
  const { t } = useTranslation();
  const curves = useMyCurves();
  const { headphone, isBlockingError, refreshState, setGlobalError } =
    useFluidEqContext();
  const [query, setQuery] = useState('');
  const [sort, setSort] = useState<TSort>('recent');
  const [dialog, setDialog] = useState<TDialog>();
  const [isApplying, setApplying] = useState(false);
  // The correction playing now, by its text: a curve is playing when it is
  // the very curve the correction layer holds, whatever it was called there.
  const playingText = headphone?.eqImport?.text;

  const shown = useMemo(() => {
    const needle = query.trim().toLowerCase();
    const found = needle
      ? curves.filter((curve) => curve.name.toLowerCase().includes(needle))
      : [...curves];
    return sort === 'name'
      ? found.sort((a, b) => a.name.localeCompare(b.name))
      : found;
  }, [curves, query, sort]);

  const apply = async (curve: IMyCurve, destination: 'curve' | 'eq') => {
    setApplying(true);
    try {
      await importEqText(
        curve.text,
        curve.name,
        destination,
        destination === 'eq' ? curve.ears : 'both',
      );
      await refreshState({ revealBands: destination === 'eq' });
    } catch (error) {
      setGlobalError(error as ErrorDescription);
    } finally {
      setApplying(false);
    }
  };

  return (
    <section className="my-curves" aria-label={t('myCurves.tab.mine')}>
      <div className="my-curves__toolbar">
        <label className="my-curves__search" htmlFor="my-curves-search">
          <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">
            <circle cx="11" cy="11" r="6.5" />
            <path d="M20 20l-4.2-4.2" />
          </svg>
          <input
            id="my-curves-search"
            type="search"
            placeholder={t('myCurves.search')}
            aria-label={t('myCurves.search')}
            value={query}
            onChange={(event) => setQuery(event.target.value)}
          />
        </label>
        <div
          className="segmented my-curves__sort"
          role="group"
          aria-label={t('myCurves.sort')}
        >
          {(['recent', 'name'] as const).map((entry) => (
            <button
              key={entry}
              type="button"
              className={`segmented__option${sort === entry ? ' is-selected' : ''}`}
              aria-pressed={sort === entry}
              onClick={() => setSort(entry)}
            >
              {t(
                entry === 'recent'
                  ? 'myCurves.sort.recent'
                  : 'myCurves.sort.name',
              )}
            </button>
          ))}
        </div>
        <span className="my-curves__spacer" />
        <button
          type="button"
          className="button small subtle"
          onClick={() => setDialog('import')}
        >
          {/* Into the tray, where Export comes out of it: side by side the
              two read as opposite directions, not as one glyph twice. */}
          <MenuIcon name="download" />
          {t('myCurves.import')}
        </button>
        <button
          type="button"
          className="button small subtle"
          disabled={curves.length === 0}
          onClick={() => setDialog('export')}
        >
          <MenuIcon name="upload" />
          {t('myCurves.export')}
        </button>
        <button
          type="button"
          className="button small"
          onClick={() => setDialog('add')}
        >
          <MenuIcon name="plus" />
          {t('myCurves.add')}
        </button>
      </div>

      {curves.length === 0 ? (
        <div className="my-curves__empty">
          <strong>{t('myCurves.empty.title')}</strong>
          <p>{t('myCurves.empty.body')}</p>
        </div>
      ) : (
        <ul className="my-curves__list">
          {shown.map((curve) => (
            <MyCurveRow
              key={curve.id}
              curve={curve}
              isPlaying={playingText === curve.text}
              isDisabled={isApplying || isBlockingError}
              onApplyCurve={(chosen) => {
                apply(chosen, 'curve').catch(() => undefined);
              }}
              onApplyEq={(chosen) => {
                apply(chosen, 'eq').catch(() => undefined);
              }}
              onRename={(chosen, name) => renameMyCurve(chosen.id, name)}
              onDuplicate={(chosen) => {
                duplicateMyCurve(chosen.id);
              }}
              onDelete={(chosen) => removeMyCurve(chosen.id)}
            />
          ))}
          {shown.length === 0 && (
            <li className="my-curves__none">{t('myCurves.noMatch')}</li>
          )}
        </ul>
      )}

      {dialog === 'add' && (
        <MyCurveAddDialog onClose={() => setDialog(undefined)} />
      )}
      {dialog === 'export' && (
        <MyCurvesExportDialog
          curves={curves}
          onClose={() => setDialog(undefined)}
        />
      )}
      {dialog === 'import' && (
        <MyCurvesImportDialog onClose={() => setDialog(undefined)} />
      )}
    </section>
  );
}
