/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

import { useState, type ReactNode } from 'react';
import LookIcon from '../icons/LookIcon';
import SceneLookIcon from '../icons/SceneLookIcon';
import { useTranslation } from '../utils/I18nContext';
import { isUnseenSceneVersion } from '../utils/seenSceneVersions';
import LookPicker from './LookPicker';
import SceneLikeButton from './SceneLikeButton';
import { useLookGallery, type IGalleryEntry } from './lookGallery';
import { useLookThumbnail, type ILookThumbnailRef } from './lookThumbnails';
import '../styles/GraphGallery.scss';

/**
 * THE GRAPH'S LOOKS AS A GALLERY (Ivan, 2026-11-19: round 3's "I", "La escena
 * es una diapositiva"). The options used to be one row across the top of the
 * plot, over the picture for as long as they were out, in an ink that could
 * not be right over a scene bright in one place and dark in the next.
 *
 * Now nothing stands on the scene's middle. One reel runs along the plot's
 * foot: the look on the graph has its credit there, its name, who made it,
 * its like and where it stands in the walk, with the looks either side of it
 * pictured beside it, a press on either stepping to it; the switches that
 * belong to the look open from the credit under the pointer or the keyboard.
 * View and full screen keep the corner every page's row ends in
 * (`GraphGalleryKeys`). Each is a crystal (`scene-crystal`), with its ink
 * read from the picture behind it alone (`useSceneInk.ts`).
 *
 * All of it comes and goes with the rest of the chrome (`ViewBar`): the
 * strip it hangs from now spans the plot, its pieces placed in it.
 */

/** Dots in the credit's place mark; a longer walk is read as a share of it. */
const PLACE_DOTS = 5;

const ScenePicture = ({
  thumbnail,
  swatch,
  lookId,
  isAsleep,
}: {
  thumbnail: ILookThumbnailRef;
  swatch: readonly string[];
  lookId: string;
  /** With the chrome away nothing is asked for: nobody would see it. */
  isAsleep: boolean;
}) => {
  const [element, setElement] = useState<HTMLSpanElement | null>(null);
  const picture = useLookThumbnail(thumbnail, isAsleep ? null : element);
  return (
    <span ref={setElement} className="graph-gallery-picture">
      {picture.state === 'ready' ? (
        <img src={picture.url} alt="" draggable={false} />
      ) : (
        <SceneLookIcon
          className="graph-gallery-picture__glyph"
          swatch={swatch}
          lookId={lookId}
        />
      )}
    </span>
  );
};

const GalleryPicture = ({
  entry,
  isAsleep,
}: {
  entry: IGalleryEntry;
  isAsleep: boolean;
}) => {
  if (entry.thumbnail) {
    return (
      <ScenePicture
        thumbnail={entry.thumbnail}
        swatch={entry.swatch ?? []}
        lookId={entry.id}
        isAsleep={isAsleep}
      />
    );
  }
  return (
    <span className="graph-gallery-picture graph-gallery-picture--look">
      {entry.look && (
        <LookIcon
          className="graph-gallery-picture__glyph"
          style={entry.look.style}
          palette={entry.look.palette}
          colours={entry.look.colours}
        />
      )}
    </span>
  );
};

const STEP_PATHS = {
  previous: 'M10 3.5l-4 4.5 4 4.5',
  next: 'M6 3.5l4 4.5-4 4.5',
} as const;

const GalleryEdge = ({
  side,
  entry,
  isAsleep,
  onStep,
}: {
  side: 'previous' | 'next';
  entry: IGalleryEntry;
  isAsleep: boolean;
  onStep: (direction: 1 | -1) => void;
}) => {
  const { t } = useTranslation();
  const label = `${t(
    side === 'previous' ? 'graph.style.previous' : 'graph.style.next',
  )}: ${entry.name}`;
  return (
    <button
      type="button"
      className={`graph-gallery-edge graph-gallery-edge--${side}`}
      aria-label={label}
      title={`${label} (${side === 'previous' ? 'Ctrl+Space' : 'Space'})`}
      onClick={() => onStep(side === 'previous' ? -1 : 1)}
    >
      <GalleryPicture entry={entry} isAsleep={isAsleep} />
      <span className="graph-gallery-edge__step" aria-hidden>
        <svg viewBox="0 0 16 16">
          <path d={STEP_PATHS[side]} />
        </svg>
      </span>
    </button>
  );
};

/** Which of `dots` stands for place `index` of `count`. */
const dotForPlace = (index: number, count: number, dots: number) =>
  dots === count ? index : Math.round((index / (count - 1)) * (dots - 1));

interface IGraphGalleryProps {
  /** The selection, not the resolved look: a draft's id is in no list. */
  selectedLookId: string;
  /** No stepping or choosing: the wave is off, so there is no look shown. */
  isDisabled: boolean;
  /** Away with the rest of the chrome. */
  isIdle: boolean;
  onStep: (direction: 1 | -1) => void;
  onChoose: (lookId: string) => void;
  /** The switches that belong to the look, shown beside its credit. */
  tools: ReactNode;
}

const GraphGallery = ({
  selectedLookId,
  isDisabled,
  isIdle,
  onStep,
  onChoose,
  tools,
}: IGraphGalleryProps) => {
  const { t } = useTranslation();
  const { previous, current, next, index, count } =
    useLookGallery(selectedLookId);
  const dots = Math.min(PLACE_DOTS, count);
  const here = dotForPlace(index, count, dots);
  const place = t('graph.gallery.place', { index: index + 1, count });

  return (
    // One reel along the plot's foot: the look before, this look's credit,
    // the look after. The neighbours stood at the plot's sides first, and
    // there they lay over the dB scales, which have the margins to
    // themselves (session 0's review, 2026-11-19).
    <div className="graph-gallery-reel">
      {previous && !isDisabled && (
        <GalleryEdge
          side="previous"
          entry={previous}
          isAsleep={isIdle}
          onStep={onStep}
        />
      )}
      <div
        className="graph-gallery-credit"
        role="group"
        aria-label={t('graph.picker.label')}
      >
        <span className="graph-gallery-credit__head">
          {/* The credit's picture and name are the picker's trigger: the
              list of every look opens from the name of the one on show. */}
          <LookPicker
            value={selectedLookId}
            disabled={isDisabled}
            onChoose={onChoose}
            trigger={
              current ? (
                <>
                  <GalleryPicture entry={current} isAsleep={isIdle} />
                  <span className="graph-gallery-credit__who">
                    <span className="graph-gallery-credit__name">
                      {current.name}
                      {isUnseenSceneVersion(current.id, current.version) && (
                        <span
                          className="look-picker__dot"
                          role="img"
                          aria-label={t('graph.version.dot')}
                          title={t('graph.version.dot')}
                        />
                      )}
                    </span>
                    <span className="graph-gallery-credit__byline">
                      {current.byline}
                    </span>
                  </span>
                </>
              ) : undefined
            }
            triggerClassName={
              current ? 'graph-gallery-credit__title' : undefined
            }
            triggerTitle={current ? t('graph.picker.label') : undefined}
          />
          {/* A scene's heart, FluidEQ's own or a member's, keyed on the scene
              so a count never carries over from the last one. */}
          {current?.liked && (
            <SceneLikeButton key={current.id} scene={current.liked} />
          )}
          {dots > 1 && index >= 0 && (
            <span
              className="graph-gallery-credit__place"
              role="img"
              aria-label={place}
              title={place}
            >
              {Array.from({ length: dots }, (_, dot) => (
                <i key={dot} className={dot === here ? 'is-here' : undefined} />
              ))}
            </span>
          )}
        </span>
        <span className="graph-gallery-credit__tools">
          <span className="graph-gallery-credit__tools-row">{tools}</span>
        </span>
      </div>
      {next && !isDisabled && (
        <GalleryEdge
          side="next"
          entry={next}
          isAsleep={isIdle}
          onStep={onStep}
        />
      )}
    </div>
  );
};

/** View and full screen, in the corner every page's row ends in. */
export const GraphGalleryKeys = ({ children }: { children: ReactNode }) => (
  <span className="graph-gallery-keys">{children}</span>
);

export default GraphGallery;
