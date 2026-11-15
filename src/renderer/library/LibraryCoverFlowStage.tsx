/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

/**
 * The Cover Flow stage: the listbox that holds the focus and takes every
 * input, the three.js canvas the row is drawn in (`coverFlowScene.ts`), the
 * centre cover's name under it, the two arrows, and the covers themselves as
 * the listbox's options — in the DOM for a screen reader, out of sight,
 * because the picture of them is the canvas.
 *
 * Until the scene has drawn the centre cover, a still picture of it stands
 * exactly where the scene will put it (`coverFlowLayout` places both), so
 * the stage is never blank while three.js loads, and where WebGL cannot
 * start the row is still steerable and the centre still shows.
 */
import {
  type KeyboardEvent,
  type MouseEvent,
  type PointerEvent,
  type RefObject,
  type WheelEvent,
  useLayoutEffect,
} from 'react';
import type { TLibraryBrowseMode } from '../../common/library/types';
import { useTranslation } from '../utils/I18nContext';
import { coverFlowLayout } from './coverFlow/coverFlowGeometry';
import type { ICoverFlowItem } from './coverFlowItems';
import type { TDrawCaption } from './coverFlow/useCoverFlowSurprise';
import LibraryCoverArt from './LibraryCoverArt';
import LibraryFolderArt from './LibraryFolderArt';

interface ILibraryCoverFlowStageProps {
  stageRef: RefObject<HTMLDivElement | null>;
  hostRef: RefObject<HTMLDivElement | null>;
  browseMode: TLibraryBrowseMode;
  /** The covers the listbox names, centre included, in row order. */
  options: readonly { item: ICoverFlowItem; index: number }[];
  currentIndex: number;
  count: number;
  centreItem: ICoverFlowItem | undefined;
  /** Surprise me spinning this row (`useCoverFlowSurprise`): null while it
   * spins, the pick's name once it lands, undefined the rest of the time. */
  drawCaption: TDrawCaption | undefined;
  isDrawn: boolean;
  isOverCover: boolean;
  optionId: (id: string) => string;
  moveBy: (delta: number) => void;
  onKeyDown: (event: KeyboardEvent<HTMLDivElement>) => void;
  onWheel: (event: WheelEvent<HTMLDivElement>) => void;
  onClick: (event: MouseEvent<HTMLDivElement>) => void;
  onPointerDown: (event: PointerEvent<HTMLDivElement>) => void;
  onPointerMove: (event: PointerEvent<HTMLDivElement>) => void;
  onPointerEnd: (event: PointerEvent<HTMLDivElement>) => void;
  onPointerLeave: () => void;
}

/**
 * Keeps `--cover-flow-size` and `--cover-flow-centre-y` on the stage at the
 * centre cover's size and place, as the scene computes them — for the still
 * picture, the caption under it, and the folder and tile lettering that
 * scale with the sleeve. Written straight onto the element: the stage
 * resizes every frame while the songs panel opens, and a React render per
 * frame would be all cost.
 */
const useStageLayout = (stageRef: RefObject<HTMLDivElement | null>) => {
  useLayoutEffect(() => {
    const stage = stageRef.current;
    if (!stage) {
      return undefined;
    }
    const apply = () => {
      const { coverPx, centreY } = coverFlowLayout(
        stage.clientWidth,
        stage.clientHeight,
      );
      stage.style.setProperty('--cover-flow-size', `${coverPx}px`);
      stage.style.setProperty('--cover-flow-centre-y', `${centreY}px`);
    };
    apply();
    const observer = new ResizeObserver(apply);
    observer.observe(stage);
    return () => observer.disconnect();
  }, [stageRef]);
};

const LibraryCoverFlowStage = ({
  stageRef,
  hostRef,
  browseMode,
  options,
  currentIndex,
  count,
  centreItem,
  drawCaption,
  isDrawn,
  isOverCover,
  optionId,
  moveBy,
  onKeyDown,
  onWheel,
  onClick,
  onPointerDown,
  onPointerMove,
  onPointerEnd,
  onPointerLeave,
}: ILibraryCoverFlowStageProps) => {
  const { t } = useTranslation();
  useStageLayout(stageRef);
  return (
    <div
      ref={stageRef}
      className={`library-coverflow__stage${isOverCover ? ' is-over-cover' : ''}`}
      role="listbox"
      tabIndex={0}
      aria-label={t('library.view.coverflow')}
      aria-activedescendant={centreItem ? optionId(centreItem.id) : undefined}
      onKeyDown={onKeyDown}
      onWheel={onWheel}
      onClick={onClick}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerEnd}
      onPointerCancel={onPointerEnd}
      onPointerLeave={onPointerLeave}
    >
      {/* The still centre cover, under the canvas until the scene has
          drawn it. */}
      {!isDrawn && (
        <div className="library-coverflow__still" aria-hidden="true">
          {centreItem === undefined && (
            <span className="library-cover-art library-cover-art--cover" />
          )}
          {centreItem !== undefined && browseMode === 'folder' && (
            <LibraryFolderArt
              artId={centreItem.artId}
              label={centreItem.title}
              size="cover"
            />
          )}
          {centreItem !== undefined && browseMode !== 'folder' && (
            <LibraryCoverArt
              artId={centreItem.artId}
              label={centreItem.title}
              size="cover"
            />
          )}
        </div>
      )}
      <div
        ref={hostRef}
        className="library-coverflow__scene"
        aria-hidden="true"
      />
      {/* The centre cover's name, hung under its sleeve. Seen, not read:
          the option below is what a screen reader announces. Keyed on the
          cover so each new name rises in after the row has turned. */}
      {drawCaption === undefined && centreItem !== undefined && (
        <div
          key={centreItem.id}
          className="library-coverflow__caption"
          aria-hidden="true"
        >
          {/* Drawn from attributes, not text: the name is the option's, and
              written twice it would be two of the same name in the page. */}
          <span
            className="library-coverflow__title"
            data-text={centreItem.title}
          />
          <small
            className="library-coverflow__subtitle"
            data-text={centreItem.subtitle}
          />
        </div>
      )}
      {/* The pick's name, hung where the row's own would be, once the spin
          lands on it. Seen, not read: the player says which song it was. */}
      {drawCaption && (
        <div
          key={drawCaption.key}
          className="library-coverflow__caption is-surprise"
          aria-hidden="true"
        >
          <span
            className="library-coverflow__title"
            data-text={drawCaption.title}
          />
          <small
            className="library-coverflow__subtitle"
            data-text={drawCaption.detail}
          />
        </div>
      )}
      {/* The two arrows, in the dead space either side of the fan: the one
          affordance that says the row turns without a tooltip.
          `stopPropagation` because a press on the stage means "the cover
          under the pointer". */}
      <button
        type="button"
        className="library-coverflow__arrow library-coverflow__arrow--back"
        aria-label={t('library.coverflow.previous')}
        title={t('library.coverflow.previous')}
        disabled={currentIndex <= 0}
        onPointerDown={(event) => event.stopPropagation()}
        onClick={(event) => {
          event.stopPropagation();
          moveBy(-1);
        }}
      >
        <svg viewBox="0 0 24 24" aria-hidden="true">
          <path d="M15 5L8 12l7 7" />
        </svg>
      </button>
      <button
        type="button"
        className="library-coverflow__arrow library-coverflow__arrow--next"
        aria-label={t('library.coverflow.next')}
        title={t('library.coverflow.next')}
        disabled={currentIndex >= count - 1}
        onPointerDown={(event) => event.stopPropagation()}
        onClick={(event) => {
          event.stopPropagation();
          moveBy(1);
        }}
      >
        <svg viewBox="0 0 24 24" aria-hidden="true">
          <path d="M9 5l7 7-7 7" />
        </svg>
      </button>
      {/* The listbox's options — the `aria-activedescendant` pattern: never
          tab stops, no handlers of their own; the stage owns every key and
          every press. */}
      <div className="library-coverflow__options">
        {options.map(({ item, index }) => (
          <div
            key={item.id}
            id={optionId(item.id)}
            role="option"
            aria-selected={index === currentIndex}
          >
            <span>{item.title}</span>
            {item.subtitle !== '' && <span>, {item.subtitle}</span>}
            {item.isPending && <span>, {t('library.pending')}</span>}
          </div>
        ))}
      </div>
    </div>
  );
};

export default LibraryCoverFlowStage;
