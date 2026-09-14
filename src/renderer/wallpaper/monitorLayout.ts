import type { IWallpaperDisplay } from '../../common/wallpaper';

/** The stage's width in its own units; its height follows the arrangement. */
const STAGE_WIDTH = 1000;
const STAGE_PADDING = 26;
/** Between neighbouring monitors, which Windows reports edge to edge. */
const MONITOR_GAP = 10;
/**
 * How flat or tall the stage may be. A row of monitors would otherwise make a
 * strip too thin to read, and one tall monitor a stage taller than the dialog
 * has room for.
 */
const WIDEST_STAGE = 3.2;
const TALLEST_STAGE = 2.4;

export interface IMonitorPlacement {
  display: IWallpaperDisplay;
  /** Counted left to right, as the monitors stand on the desk. */
  number: number;
  /** Percentages of the stage. */
  left: number;
  top: number;
  width: number;
  height: number;
}

export interface IMonitorLayout {
  /** The stage's width over its height. */
  ratio: number;
  placements: IMonitorPlacement[];
}

/**
 * Monitors drawn where they stand relative to each other, scaled to fit the
 * stage: the arrangement is how a person tells "the one on the left" from
 * "the tall one", which names and ids never did.
 */
export const layoutMonitors = (
  displays: readonly IWallpaperDisplay[],
): IMonitorLayout => {
  if (displays.length === 0) {
    return { ratio: WIDEST_STAGE, placements: [] };
  }
  const ordered = [...displays].sort((a, b) => a.x - b.x || a.y - b.y);
  const left = Math.min(...ordered.map((display) => display.x));
  const top = Math.min(...ordered.map((display) => display.y));
  const right = Math.max(
    ...ordered.map((display) => display.x + display.width),
  );
  const bottom = Math.max(
    ...ordered.map((display) => display.y + display.height),
  );
  const spanWidth = Math.max(1, right - left);
  const spanHeight = Math.max(1, bottom - top);
  const ratio = Math.min(
    WIDEST_STAGE,
    Math.max(TALLEST_STAGE, spanWidth / spanHeight),
  );
  const stageHeight = STAGE_WIDTH / ratio;
  const scale = Math.min(
    (STAGE_WIDTH - STAGE_PADDING * 2) / spanWidth,
    (stageHeight - STAGE_PADDING * 2) / spanHeight,
  );
  const offsetX = (STAGE_WIDTH - spanWidth * scale) / 2;
  const offsetY = (stageHeight - spanHeight * scale) / 2;
  return {
    ratio,
    placements: ordered.map((display, index) => ({
      display,
      number: index + 1,
      left:
        (((display.x - left) * scale + offsetX + MONITOR_GAP / 2) /
          STAGE_WIDTH) *
        100,
      top:
        (((display.y - top) * scale + offsetY + MONITOR_GAP / 2) /
          stageHeight) *
        100,
      width: ((display.width * scale - MONITOR_GAP) / STAGE_WIDTH) * 100,
      height: ((display.height * scale - MONITOR_GAP) / stageHeight) * 100,
    })),
  };
};
