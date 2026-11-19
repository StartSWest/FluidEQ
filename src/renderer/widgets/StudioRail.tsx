/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

import {
  type CSSProperties,
  type ReactNode,
  useSyncExternalStore,
} from 'react';
import Glyph from '../community/Glyph';
import LibraryRailSplitter, {
  type ILibraryRailWidth,
} from '../library/LibraryRailSplitter';
import { createFlagSetting } from '../utils/graphStorage';
import { useTranslation } from '../utils/I18nContext';
import '../styles/StudioRail.scss';

/**
 * One remembered pin per rail, made once per key: two rails on one key would
 * otherwise each hold a copy of the answer and drift apart.
 */
const pinnedSettings = new Map<string, ReturnType<typeof createFlagSetting>>();

const pinnedSettingFor = (storageKey: string) => {
  const known = pinnedSettings.get(storageKey);
  if (known) {
    return known;
  }
  const setting = createFlagSetting(storageKey, true);
  pinnedSettings.set(storageKey, setting);
  return setting;
};

/**
 * Whether a page's rail is pinned beside the page or folded to its glyphs,
 * remembered under `storageKey`. Pinned at first, which is the rail as it
 * always was; somebody who folded it away for the room wants that room again
 * next time.
 */
export const useRailPinned = (
  storageKey: string,
): readonly [boolean, (next: boolean) => void] => {
  const setting = pinnedSettingFor(storageKey);
  const isPinned = useSyncExternalStore(
    setting.subscribe,
    setting.get,
    () => true,
  );
  return [isPinned, setting.set] as const;
};

interface IRailFrameProps {
  /** The rail's width and its drag (`useRailWidth`), remembered per page. */
  rail: ILibraryRailWidth;
  /** The slot's own state classes, after `studio-rail-slot`. */
  slotState: string;
  /** What stands before the page's name in the head: the pin, or nothing. */
  lead: ReactNode;
  heading: ReactNode;
  /** Whether the rail has a width of its own to drag at its edge. */
  hasSplitter: boolean;
  children: ReactNode;
}

/**
 * What every studio rail is, folding or not: the slot the grid gives room
 * to, the head with the page's name (`studio-rail-title`), the places under
 * it, and the splitter on its hairline. The two rails below differ only in
 * what they put in front of the name and whether they fold.
 */
const RailFrame = ({
  rail,
  slotState,
  lead,
  heading,
  hasSplitter,
  children,
}: IRailFrameProps) => (
  <>
    <div
      className={`studio-rail-slot${slotState}${
        rail.isResizing ? ' is-resizing' : ''
      }`}
      style={{ '--rail-width': `${rail.width}px` } as CSSProperties}
    >
      <div className="studio-rail">
        <div className="studio-rail__head">
          {lead}
          <div className="studio-rail__heading">{heading}</div>
        </div>
        <div className="studio-rail__body">{children}</div>
      </div>
    </div>
    {hasSplitter && <LibraryRailSplitter rail={rail} />}
  </>
);

interface IStudioRailProps {
  rail: ILibraryRailWidth;
  isPinned: boolean;
  onPinnedChange: (next: boolean) => void;
  /** The rail's name beside the pin: the page's own title. */
  heading: ReactNode;
  /** The places down the rail, with their own landmark. */
  children: ReactNode;
}

/**
 * THE STUDIO RAIL AS A PAGE'S LEFT COLUMN: the Library's rail (its hairline,
 * its rows through the studio mixins, its splitter and width memory) with the
 * Scenes tab's pin, so it can be folded to its glyphs and opened over the
 * page while the pointer is on it (Ivan, 2026-11-19, of the DSP page: "con el
 * panel izquierdo siempre como es, resizable, todo eso. Y togglable"). The
 * Library, the DSP, the Gaming Lab and Scenes stand on it, each with its own
 * name in the head ("the same header that the DSP has", the same day).
 *
 * The page lays itself out as a grid of `auto minmax(0, 1fr)`; the slot and
 * the splitter place themselves in its first column (`StudioRail.scss`), so
 * the page needs no rule of its own for either. The rail stands in its slot
 * at its own width, and the slot only decides how much room the grid gives
 * it: folded, the slot narrows and the rail can still open over the page.
 *
 * A plain `div`, never a `nav`: what the rail holds names itself (the DSP's
 * chain is a `nav` of its own), and a landmark around a landmark is read out
 * twice.
 */
export default function StudioRail({
  rail,
  isPinned,
  onPinnedChange,
  heading,
  children,
}: IStudioRailProps) {
  const { t } = useTranslation();
  const pinLabel = t(isPinned ? 'plus.rail.collapse' : 'plus.rail.pin');
  return (
    <RailFrame
      rail={rail}
      slotState={isPinned ? '' : ' is-folded'}
      lead={
        <button
          type="button"
          className="studio-rail__pin"
          aria-pressed={isPinned}
          aria-label={pinLabel}
          title={pinLabel}
          onClick={() => onPinnedChange(!isPinned)}
        >
          <Glyph name={isPinned ? 'rail-collapse' : 'pin'} />
        </button>
      }
      heading={heading}
      // Only while pinned: a folded rail has no width of its own to give.
      hasSplitter={isPinned}
    >
      {children}
    </RailFrame>
  );
}

interface IFixedStudioRailProps {
  rail: ILibraryRailWidth;
  heading: ReactNode;
  children: ReactNode;
}

/**
 * The same rail, always open: the head with the page's name and no pin, the
 * width still dragged at its edge, and no fold on a narrow page either
 * (`is-fixed`). Share Audio's, whose mix is faders that mean nothing as a
 * column of icons (Ivan, 2026-11-19: "in Share Audio don't do collapsible").
 */
export function FixedStudioRail({
  rail,
  heading,
  children,
}: IFixedStudioRailProps) {
  return (
    <RailFrame
      rail={rail}
      slotState=" is-fixed"
      lead={null}
      heading={heading}
      hasSplitter
    >
      {children}
    </RailFrame>
  );
}
