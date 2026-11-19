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

interface IStudioRailProps {
  /** The rail's width and its drag (`useRailWidth`), remembered per page. */
  rail: ILibraryRailWidth;
  isPinned: boolean;
  onPinnedChange: (next: boolean) => void;
  /** The rail's name beside the pin: the page's own title, usually. */
  heading: ReactNode;
  /** The places down the rail, with their own landmark. */
  children: ReactNode;
}

/**
 * THE STUDIO RAIL AS A PAGE'S LEFT COLUMN: the Library's rail (its hairline,
 * its rows through the studio mixins, its splitter and width memory) with the
 * Scenes tab's pin, so it can be folded to its glyphs and opened over the
 * page while the pointer is on it (Ivan, 2026-11-19, of the DSP page: "con el
 * panel izquierdo siempre como es, resizable, todo eso. Y togglable").
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
    <>
      <div
        className={`studio-rail-slot${isPinned ? '' : ' is-folded'}${
          rail.isResizing ? ' is-resizing' : ''
        }`}
        style={{ '--rail-width': `${rail.width}px` } as CSSProperties}
      >
        <div className="studio-rail">
          <div className="studio-rail__head">
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
            <div className="studio-rail__heading">{heading}</div>
          </div>
          <div className="studio-rail__body">{children}</div>
        </div>
      </div>
      {/* Only while pinned: a folded rail has no width of its own to give. */}
      {isPinned && <LibraryRailSplitter rail={rail} />}
    </>
  );
}
