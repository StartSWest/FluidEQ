import {
  useCallback,
  useRef,
  useState,
  type CSSProperties,
  type RefObject,
} from 'react';
import { readStored, writeStored } from '../utils/graphStorage';
import { PANE_MIN_HEIGHT } from '../utils/paneSizes';

/**
 * How tall the Studio's stage is at the graph's size, set by dragging the
 * divider under it.
 *
 * The graph in the EQ tab is as tall as its divider leaves it, so a scene is
 * seen at many shapes there; the stage was held to one, the graph's 2.35:1,
 * and a scene could not be judged on the taller graph most members give it.
 *
 * Kept as the stage's shape, width over height, not a height in pixels: the
 * Studio is as wide as the window, and a shape set on one window is the same
 * shape on the next. Only the graph's size is resized this way; the narrow
 * and wide sizes stand for fixed panels.
 */

/** The graph's own shape, and the stage's until it is dragged. */
export const GRAPH_STAGE_RATIO = 2.35;

const STORAGE_KEY = 'fluideq.studio.stageRatio';

/** Read by the stage's stylesheet. */
const RATIO_PROPERTY = '--studio-stage-ratio';

/** On the stage's area while its divider is held; see the stylesheet. */
const RESIZING_ATTRIBUTE = 'data-resizing';

/**
 * Kept below the stage when it is dragged tallest: the divider and a sliver
 * of what is under it, so the handle never ends up out of sight.
 */
const ROOM_UNDER_STAGE = 44;

/** Shapes a stored value may take, so a bad one cannot make the stage vanish. */
const MIN_RATIO = 0.4;
const MAX_RATIO = 8;

const readRatio = (): number => {
  const stored = Number(readStored(STORAGE_KEY));
  return Number.isFinite(stored) && stored >= MIN_RATIO && stored <= MAX_RATIO
    ? stored
    : GRAPH_STAGE_RATIO;
};

export interface IStageDrag {
  /** The stage's width and height when the drag began. */
  width: number;
  height: number;
  /** The tallest it may become: what its scrolling pane can show of it. */
  tallest: number;
}

export interface IStageShape {
  /** Width over height. */
  ratio: number;
  /** Where the height sits between the shortest and tallest it may be, 0–100. */
  percent: number;
}

/** The stage's shape `deltaY` pixels into a drag. */
export const stageAfterDrag = (
  drag: IStageDrag,
  deltaY: number,
): IStageShape => {
  const tallest = Math.max(drag.tallest, PANE_MIN_HEIGHT);
  const height = Math.min(
    Math.max(drag.height + deltaY, PANE_MIN_HEIGHT),
    tallest,
  );
  const span = tallest - PANE_MIN_HEIGHT;
  return {
    ratio: Math.min(Math.max(drag.width / height, MIN_RATIO), MAX_RATIO),
    percent:
      span > 0 ? Math.round(((height - PANE_MIN_HEIGHT) / span) * 100) : 0,
  };
};

/**
 * The pane that scrolls the stage: the Studio's main pane side by side, the
 * whole Studio when folded into one column, where the main pane is only a
 * group of its parts and has no height of its own.
 */
const scrollerOf = (area: HTMLElement): HTMLElement | undefined => {
  const pane = area.closest<HTMLElement>('.studio-bench__main');
  if (pane && pane.clientHeight > 0) {
    return pane;
  }
  return area.closest<HTMLElement>('.studio') ?? undefined;
};

export default function useStudioStageRatio(
  area: RefObject<HTMLElement | null>,
) {
  const [shape, setShape] = useState<IStageShape>(() => ({
    ratio: readRatio(),
    percent: 0,
  }));
  const drag = useRef<IStageDrag | undefined>(undefined);
  // What the drag has reached. During a drag the shape is written onto the
  // area itself, and only its end goes through a render: the bench holds the
  // stage, the code and every card, and rendering all of it on each pointer
  // move is the per-event re-render this app has had to take out before.
  const latest = useRef(shape);

  const onStart = useCallback(() => {
    const element = area.current;
    // The stage's well, which is exactly as tall as the stage in it.
    const stage = element?.firstElementChild;
    if (!element || !stage) {
      drag.current = undefined;
      return;
    }
    const box = stage.getBoundingClientRect();
    const scroller = scrollerOf(element);
    // Measured from where the stage starts on screen, not from the pane's
    // top: the stage sits under the pane's bar, and a height of the whole
    // pane put the divider below the pane's bottom edge, out of reach.
    const visibleBottom = scroller
      ? scroller.getBoundingClientRect().top +
        scroller.clientTop +
        scroller.clientHeight
      : box.bottom;
    drag.current = {
      width: box.width,
      height: box.height,
      // Never below the stage's own height, so taking hold of the divider of
      // a stage already taller than that does not make it jump.
      tallest: Math.max(visibleBottom - box.top - ROOM_UNDER_STAGE, box.height),
    };
    latest.current = {
      ratio: latest.current.ratio,
      percent: stageAfterDrag(drag.current, 0).percent,
    };
    element.toggleAttribute(RESIZING_ATTRIBUTE, true);
  }, [area]);

  const onDrag = useCallback(
    (deltaY: number) => {
      const element = area.current;
      if (!element || !drag.current || drag.current.width <= 0) {
        return;
      }
      latest.current = stageAfterDrag(drag.current, deltaY);
      element.style.setProperty(RATIO_PROPERTY, String(latest.current.ratio));
    },
    [area],
  );

  const onEnd = useCallback(() => {
    area.current?.toggleAttribute(RESIZING_ATTRIBUTE, false);
    if (!drag.current) {
      return;
    }
    drag.current = undefined;
    setShape(latest.current);
    writeStored(STORAGE_KEY, String(latest.current.ratio));
  }, [area]);

  return {
    /** For the stage's area: the shape every stage in it takes at graph size. */
    style: { [RATIO_PROPERTY]: String(shape.ratio) } as CSSProperties,
    resizer: { valuePercent: shape.percent, onStart, onDrag, onEnd },
  };
}
