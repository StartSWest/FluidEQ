/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

import { Fragment, type RefObject } from 'react';
import type { TranslationKey } from 'common/i18n';
import LookIcon from '../icons/LookIcon';
import { useTranslation } from '../utils/I18nContext';
import LookPickerScene from './LookPickerScene';
import LookPickerDiscover from './LookPickerDiscover';
import {
  categoryName,
  FAMILY_KEYS,
  keepPlus,
  keepStyle,
  makerName,
  matchesSearch,
  plusFilters,
  styleFilters,
  type IPlusRow,
  type IStyleRow,
  type TPlusFilter,
  type TStyleFilter,
} from './lookPickerRows';

interface ILookPickerBodyProps {
  /** The selection, not the resolved look: a draft's id is in neither list. */
  value: string;
  styleRows: readonly IStyleRow[];
  plusRows: readonly IPlusRow[];
  query: string;
  styleFilter: TStyleFilter;
  plusFilter: TPlusFilter;
  onQuery: (query: string) => void;
  onStyleFilter: (filter: TStyleFilter) => void;
  onPlusFilter: (filter: TPlusFilter) => void;
  onChoose: (lookId: string) => void;
  searchRef: RefObject<HTMLInputElement | null>;
  /** Told when the columns arrive, to scroll each to its chosen row. */
  columnsRef?: (columns: HTMLDivElement | null) => void;
  onLeave?: () => void;
}

/**
 * What the look picker opens: the search over both columns, the standard
 * styles beside the visualizers, each filed and filterable (`LookPicker`).
 *
 * Its own component, handed its rows rather than reading them, because Help
 * draws it too, open, from made-up looks (`help/live/lookFigures`): the
 * picker's own rows are the reader's looks and scenes.
 */
const LookPickerBody = ({
  value,
  styleRows,
  plusRows,
  query,
  styleFilter,
  plusFilter,
  onQuery,
  onStyleFilter,
  onPlusFilter,
  onChoose,
  searchRef,
  columnsRef,
  onLeave,
}: ILookPickerBodyProps) => {
  const { t } = useTranslation();

  const styleChips = styleFilters(styleRows);
  const plusChips = plusFilters(plusRows);
  const activeStyle = styleChips.includes(styleFilter) ? styleFilter : 'all';
  const activePlus = plusChips.includes(plusFilter) ? plusFilter : 'all';
  const searching = query.trim().length > 0;
  const discovering =
    plusRows.length === 0 && !searching && onLeave !== undefined;
  const shownStyles = styleRows.filter((row) =>
    searching ? matchesSearch(row.search, query) : keepStyle(row, activeStyle),
  );
  const shownPlus = plusRows.filter((row) =>
    searching ? matchesSearch(row.search, query) : keepPlus(row, activePlus),
  );

  const styleChipName = (filter: TStyleFilter) => {
    if (filter === 'all') {
      return t('graph.picker.all');
    }
    return filter === 'yours'
      ? t('graph.picker.yours')
      : t(FAMILY_KEYS[filter]);
  };
  const plusChipName = (filter: TPlusFilter) => {
    if (filter === 'all') {
      return t('graph.picker.all');
    }
    return filter === 'mine' || filter === 'members'
      ? makerName(t, filter)
      : categoryName(t, filter);
  };

  // Only the chosen row, or the first, is a Tab stop in each column: forty
  // Tab presses to get from the styles to the visualizers is not a way there.
  const stopOf = (ids: readonly string[]) =>
    ids.includes(value) ? value : ids[0];
  const styleStop = stopOf(shownStyles.map((row) => row.id));
  const plusStop = stopOf(shownPlus.map((row) => row.id));

  /**
   * The measuring views over their own heading, the scenes over theirs.
   *
   * A flat list put a goniometer next to a bridge over water with no line
   * between them, and they are not the same kind of thing (Ivan,
   * 2026-09-23: "separate real meters from the rest of viz like terra and
   * sky line with a group"). Headed only when more than one family is
   * showing — under a family chip, or a search, a heading over the whole
   * list says nothing.
   */
  const manyFamilies = new Set(shownStyles.map((row) => row.family)).size > 1;

  const renderStyle = (row: IStyleRow, index: number) => {
    const selected = row.id === value;
    const heads =
      manyFamilies &&
      (index === 0 || shownStyles[index - 1].family !== row.family);
    /**
     * Indented only while the view it varies is on screen too. Searching, or
     * under the Yours chip, a variation can be the only thing showing — and
     * a row indented under nothing reads as a mistake rather than as a tree.
     */
    const child =
      row.nested &&
      shownStyles.some(
        (other) => !other.yours && other.look.style === row.look.style,
      );
    return (
      <Fragment key={row.id}>
        {heads && (
          <p className="look-picker__group">{t(FAMILY_KEYS[row.family])}</p>
        )}
        <button
          type="button"
          className={`look-picker__pick look-picker__style${
            child ? ' look-picker__style--child' : ''
          }${selected ? ' is-selected' : ''}`}
          aria-pressed={selected}
          tabIndex={row.id === styleStop ? 0 : -1}
          title={row.name}
          onClick={() => onChoose(row.id)}
        >
          <span className="look-picker__glyph">
            <LookIcon
              style={row.look.style}
              palette={row.look.palette}
              colours={row.look.colours}
            />
          </span>
          <span
            className={`look-picker__name${
              row.yours ? ' graph-look-name--custom' : ''
            }`}
          >
            {row.name}
          </span>
        </button>
      </Fragment>
    );
  };

  // Makers are named over their runs only when more than one is showing.
  const manyMakers = new Set(shownPlus.map((each) => each.maker)).size > 1;
  const renderScene = (row: IPlusRow, index: number) => (
    <LookPickerScene
      key={row.id}
      row={row}
      selected={row.id === value}
      tabbable={row.id === plusStop}
      heading={
        manyMakers && (index === 0 || shownPlus[index - 1].maker !== row.maker)
      }
      onChoose={onChoose}
    />
  );

  const chips = <T extends string>(
    filters: readonly T[],
    active: T,
    name: (filter: T) => string,
    pick: (filter: T) => void,
    label: TranslationKey,
  ) => (
    <div
      className="gallery-chips look-picker__chips"
      role="group"
      aria-label={t(label)}
    >
      {filters.map((filter) => (
        <button
          key={filter}
          type="button"
          className="gallery-chip"
          aria-pressed={!searching && filter === active}
          onClick={() => pick(filter)}
        >
          {name(filter)}
        </button>
      ))}
    </div>
  );

  return (
    <>
      <div className="look-picker__search">
        <svg viewBox="0 0 16 16" aria-hidden>
          <circle cx="7" cy="7" r="4.5" />
          <path d="M10.5 10.5L14 14" />
        </svg>
        <input
          ref={searchRef}
          type="text"
          value={query}
          placeholder={t('graph.picker.search')}
          aria-label={t('graph.picker.search')}
          onChange={(event) => onQuery(event.target.value)}
          onKeyDown={(event) => {
            const matches = [...shownStyles, ...shownPlus];
            if (event.key === 'Enter' && searching && matches.length === 1) {
              onChoose(matches[0].id);
            }
          }}
        />
        {query.length > 0 && (
          <button
            type="button"
            className="menu-search__clear"
            aria-label={t('common.clearSearch')}
            title={t('common.clearSearch')}
            onMouseDown={(event) => event.preventDefault()}
            onClick={() => {
              onQuery('');
              searchRef.current?.focus();
            }}
          >
            <svg viewBox="0 0 12 12" aria-hidden>
              <path d="M3 3l6 6M9 3l-6 6" />
            </svg>
          </button>
        )}
      </div>
      <div ref={columnsRef} className="look-picker__columns">
        <section
          className="look-picker__column look-picker__column--styles"
          aria-label={t('graph.picker.styles')}
        >
          <header className="look-picker__head">
            <h3>{t('graph.picker.styles')}</h3>
            <span className="look-picker__count">{shownStyles.length}</span>
          </header>
          {chips(
            styleChips,
            activeStyle,
            styleChipName,
            onStyleFilter,
            'graph.picker.filterStyles',
          )}
          <div
            className="look-picker__list"
            data-look-picker-scroll
            data-anchored-menu-scroll
          >
            {shownStyles.map(renderStyle)}
            {shownStyles.length === 0 && (
              <p className="look-picker__empty">{t('common.noMatches')}</p>
            )}
          </div>
        </section>
        <section
          className="look-picker__column look-picker__column--plus"
          aria-label={t('graph.picker.plus')}
        >
          <header className="look-picker__head">
            <h3>{t('graph.picker.plus')}</h3>
            {!discovering && (
              <span className="look-picker__count">{shownPlus.length}</span>
            )}
          </header>
          {plusRows.length > 0 &&
            chips(
              plusChips,
              activePlus,
              plusChipName,
              onPlusFilter,
              'graph.picker.filterPlus',
            )}
          <div
            className={`look-picker__list${discovering ? ' look-picker__list--discover' : ''}`}
            data-look-picker-scroll
            data-anchored-menu-scroll
          >
            {shownPlus.flatMap(renderScene)}
            {discovering && onLeave ? (
              <LookPickerDiscover onLeave={onLeave} />
            ) : (
              shownPlus.length === 0 && (
                <div className="look-picker__empty">
                  <p>{t('common.noMatches')}</p>
                  {searching && (
                    <button
                      type="button"
                      className="button small subtle"
                      onClick={() => onQuery('')}
                    >
                      {t('common.clearSearch')}
                    </button>
                  )}
                </div>
              )
            )}
          </div>
        </section>
      </div>
    </>
  );
};

export default LookPickerBody;
