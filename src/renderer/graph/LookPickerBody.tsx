/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

import type { RefObject } from 'react';
import { isPlusCategory } from 'common/plusGallery';
import MenuIcon from '../icons/MenuIcon';
import { useTranslation } from '../utils/I18nContext';
import LookPickerDetails from './LookPickerDetails';
import LookPickerDiscover from './LookPickerDiscover';
import LookPickerEmptyCategory from './LookPickerEmptyCategory';
import LookPickerFrom from './LookPickerFrom';
import LookPickerMore from './LookPickerMore';
import LookPickerRail from './LookPickerRail';
import LookPickerSearch from './LookPickerSearch';
import LookPickerSort from './LookPickerSort';
import LookStyleGrid from './LookStyleGrid';
import { SceneClipScope } from './lookTileClips';
import { LookPickerSceneTile, LookPickerStyleTile } from './LookPickerTiles';
import {
  freshnessOf,
  isStylePlace,
  pickerFroms,
  placeHoldsScenes,
  selectLooks,
  sortScenes,
  sortStyles,
  stylePlaces,
  type TFreshness,
  type TPickerFrom,
  type TPickerPlace,
  type TPickerSort,
  type TPickerView,
} from './lookPickerFilter';
import {
  categoryName,
  FAMILY_KEYS,
  type IPlusRow,
  type IStyleRow,
} from './lookPickerRows';

interface ILookPickerBodyProps {
  /** The selection, not the resolved look: a draft's id is in neither list. */
  value: string;
  styleRows: readonly IStyleRow[];
  plusRows: readonly IPlusRow[];
  query: string;
  place: TPickerPlace;
  from: TPickerFrom;
  sort: TPickerSort;
  view: TPickerView;
  /** When the picker opened, for what counts as new; none marks nothing. */
  openedAt?: number;
  onQuery: (query: string) => void;
  onPlace: (place: TPickerPlace) => void;
  onFrom: (from: TPickerFrom) => void;
  onSort: (sort: TPickerSort) => void;
  onView: (view: TPickerView) => void;
  onChoose: (lookId: string) => void;
  searchRef: RefObject<HTMLInputElement | null>;
  /** Told when the looks arrive, to scroll to the chosen one. */
  bodyRef?: (body: HTMLDivElement | null) => void;
  onLeave?: () => void;
}

const VIEWS = [
  { view: 'grid', icon: 'viewGrid', label: 'library.view.grid' },
  { view: 'details', icon: 'viewList', label: 'library.view.list' },
] as const;

/**
 * What the look picker opens (`LookPicker`): the Library's layout in a
 * window - the search, the view and the order over a rail of places, and
 * beside the rail the looks of the place open, under the makers' tabs.
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
  place,
  from,
  sort,
  view,
  openedAt,
  onQuery,
  onPlace,
  onFrom,
  onSort,
  onView,
  onChoose,
  searchRef,
  bodyRef,
  onLeave,
}: ILookPickerBodyProps) => {
  const { t, locale } = useTranslation();

  const freshness = new Map<string, TFreshness>();
  plusRows.forEach((row) => {
    const fresh = freshnessOf(row, openedAt);
    if (fresh) {
      freshness.set(row.id, fresh);
    }
  });
  const families = stylePlaces(styleRows);
  const froms = pickerFroms(styleRows, plusRows);
  const activeFrom = froms.includes(from) ? from : 'all';
  const searching = query.trim().length > 0;
  // A family that has nothing left in it (the member deleted their last
  // saved style) is no longer in the rail; standing in it would be nowhere.
  const known = !isStylePlace(place) || families.includes(place);
  let activePlace: TPickerPlace | undefined;
  if (!searching) {
    activePlace = known ? place : 'everything';
  }
  const select = (
    at: TPickerPlace | undefined,
    by: TPickerFrom,
    typed: string,
  ) => selectLooks(styleRows, plusRows, freshness, at, by, typed);
  const picked = select(activePlace, activeFrom, query);
  const scenes = sortScenes(picked.scenes, sort, locale);
  const styles = sortStyles(picked.styles, sort, locale);
  const countIn = (at: TPickerPlace) => {
    const { styles: s, scenes: c } = select(at, activeFrom, '');
    return s.length + c.length;
  };
  const countFrom = (by: TPickerFrom) => {
    const { styles: s, scenes: c } = select(activePlace, by, query);
    return s.length + c.length;
  };

  const nameOf = (at: TPickerPlace) => {
    if (at === 'everything') {
      return t('graph.picker.everything');
    }
    if (at === 'fresh') {
      return t('graph.picker.fresh');
    }
    if (at === 'all-scenes') {
      return t('graph.picker.allScenes');
    }
    return isPlusCategory(at) ? categoryName(t, at) : t(FAMILY_KEYS[at]);
  };
  const title = activePlace
    ? nameOf(activePlace)
    : t('graph.picker.results', { query: query.trim() });

  const discovering =
    plusRows.length === 0 &&
    !searching &&
    onLeave !== undefined &&
    activePlace !== undefined &&
    placeHoldsScenes(activePlace);
  const ordered = [...scenes, ...styles];
  const shownIds = ordered.map((row) => row.id);
  // Only the chosen look, or the first, is a Tab stop: forty Tab presses to
  // get past the grid is not a way past it. The arrows walk it.
  const stop = shownIds.includes(value) ? value : shownIds[0];
  const both = scenes.length > 0 && styles.length > 0;

  const empty = () => {
    if (
      !searching &&
      activeFrom === 'all' &&
      activePlace !== undefined &&
      isPlusCategory(activePlace)
    ) {
      return (
        <LookPickerEmptyCategory category={activePlace} onLeave={onLeave} />
      );
    }
    const fresh = !searching && activePlace === 'fresh';
    return (
      <div className="look-picker__empty">
        <p>{fresh ? t('graph.picker.nothingNew') : t('common.noMatches')}</p>
        {searching && (
          <button
            type="button"
            className="button small subtle"
            onClick={() => onQuery('')}
          >
            {t('common.clearSearch')}
          </button>
        )}
        {!searching && activeFrom !== 'all' && (
          <button
            type="button"
            className="button small subtle"
            onClick={() => onFrom('all')}
          >
            {t('graph.picker.showEveryone')}
          </button>
        )}
      </div>
    );
  };

  const grid = () => (
    <>
      {both && (
        <h4 className="look-picker__section">
          {t('graph.picker.plus')}
          <small>{scenes.length}</small>
        </h4>
      )}
      {scenes.length > 0 && (
        <div className="look-picker__grid">
          {/* Each scene in view plays its clip, within one bound for the
              grid (`lookTileClips.tsx`). */}
          <SceneClipScope>
            {scenes.map((row) => (
              <LookPickerSceneTile
                key={row.id}
                row={row}
                fresh={freshness.get(row.id)}
                selected={row.id === value}
                tabbable={row.id === stop}
                onChoose={onChoose}
              />
            ))}
          </SceneClipScope>
        </div>
      )}
      {both && (
        <h4 className="look-picker__section">
          {t('graph.picker.styles')}
          <small>{styles.length}</small>
        </h4>
      )}
      {styles.length > 0 && (
        <LookStyleGrid>
          {styles.map((row) => (
            <LookPickerStyleTile
              key={row.id}
              row={row}
              selected={row.id === value}
              tabbable={row.id === stop}
              onChoose={onChoose}
            />
          ))}
        </LookStyleGrid>
      )}
    </>
  );

  let content;
  if (ordered.length === 0) {
    content =
      discovering && onLeave ? (
        <LookPickerDiscover onLeave={onLeave} />
      ) : (
        empty()
      );
  } else if (view === 'details') {
    content = (
      <LookPickerDetails
        value={value}
        styles={styles}
        scenes={scenes}
        freshness={freshness}
        stop={stop}
        onChoose={onChoose}
      />
    );
  } else {
    content = grid();
  }

  return (
    <>
      <div className="look-picker__top">
        <LookPickerSearch
          query={query}
          searchRef={searchRef}
          onQuery={onQuery}
          onEnter={() => {
            if (searching && ordered.length === 1) {
              onChoose(ordered[0].id);
            }
          }}
        />
        <div
          className="look-picker__views"
          role="group"
          aria-label={t('graph.picker.view')}
        >
          {VIEWS.map((each) => (
            <button
              key={each.view}
              type="button"
              className={`look-picker__view${view === each.view ? ' is-active' : ''}`}
              aria-pressed={view === each.view}
              title={t(each.label)}
              onClick={() => onView(each.view)}
            >
              <MenuIcon name={each.icon} className="look-picker__view-icon" />
              <span>{t(each.label)}</span>
            </button>
          ))}
        </div>
        <LookPickerSort sort={sort} onSort={onSort} />
      </div>
      <div ref={bodyRef} className="look-picker__body">
        <LookPickerRail
          place={activePlace}
          families={families}
          countOf={countIn}
          nameOf={nameOf}
          onPlace={onPlace}
        />
        <section className="look-picker__main" aria-label={title}>
          <header className="look-picker__head">
            <h3>
              <span className="look-picker__title">{title}</span>
              <small className="look-picker__count">{ordered.length}</small>
            </h3>
            <LookPickerFrom
              froms={froms}
              from={activeFrom}
              countOf={countFrom}
              onFrom={onFrom}
            />
          </header>
          <div
            className="look-picker__scroll"
            data-look-picker-scroll
            data-anchored-menu-scroll
          >
            {content}
            {/* Everything, with no scene to its name yet: the styles, then
                the way to the first scene under them. */}
            {discovering && ordered.length > 0 && onLeave && (
              <LookPickerDiscover onLeave={onLeave} />
            )}
          </div>
        </section>
      </div>
      <footer className="look-picker__foot">
        <span className="look-picker__keys" aria-hidden="true">
          <span>
            <kbd>↑↓←→</kbd>
            {t('graph.picker.keysMove')}
          </span>
          <span>
            <kbd>Enter</kbd>
            {t('graph.picker.keysChoose')}
          </span>
          <span>
            <kbd>Esc</kbd>
            {t('graph.picker.keysClose')}
          </span>
        </span>
        {/* Always there, however long the grid scrolls. The empty column's
            own offer already has it. */}
        {plusRows.length > 0 && onLeave && <LookPickerMore onLeave={onLeave} />}
      </footer>
    </>
  );
};

export default LookPickerBody;
