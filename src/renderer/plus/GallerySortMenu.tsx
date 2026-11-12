/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

import type { TGallerySort } from 'common/plusGallery';
import Chevron from '../icons/Chevron';
import useChatPopover from '../studio/chat/useChatPopover';
import AnchoredMenu from '../widgets/AnchoredMenu';
import '../styles/SceneChoice.scss';

export interface IGallerySortItem {
  sort: TGallerySort;
  /** Its name in the menu. */
  name: string;
  /** What the segment says while it is the chosen one. */
  chosen: string;
  /** A few words after the name, saying what the choice counts. */
  hint?: string;
}

interface IGallerySortMenuProps {
  items: readonly IGallerySortItem[];
  /** What the segment says while none of its items is chosen. */
  label: string;
  sort: TGallerySort;
  onPick: (sort: TGallerySort) => void;
}

/**
 * One segment of the gallery's order control that opens a menu of related
 * orders (Ivan, 2026-11-12): "This week" holds most liked, new and updated
 * this week, "Most liked" holds Most used. One segment for a family, so the
 * control keeps its three places at every width instead of five side by side
 * breaking onto two lines. While one of its orders is chosen the segment says
 * which ("This week: new"); otherwise it reads as it always did.
 */
export default function GallerySortMenu({
  items,
  label,
  sort,
  onPick,
}: IGallerySortMenuProps) {
  const menu = useChatPopover();
  const current = items.find((item) => item.sort === sort);
  return (
    <>
      <button
        ref={menu.setAnchor}
        type="button"
        className={`segmented__option gallery-sorts__menu${current ? ' is-selected' : ''}`}
        aria-pressed={Boolean(current)}
        aria-haspopup="menu"
        aria-expanded={menu.isOpen}
        onClick={menu.toggle}
      >
        {current?.chosen ?? label}
        <Chevron />
      </button>
      <AnchoredMenu
        anchor={menu.anchor}
        isOpen={menu.isOpen}
        role="menu"
        className="scene-choice__menu gallery-sorts__list"
        ariaLabel={label}
        align="left"
      >
        {items.map((item) => (
          <button
            key={item.sort}
            type="button"
            role="menuitemradio"
            aria-checked={item.sort === sort}
            className={`scene-choice__item${item.sort === sort ? ' is-chosen' : ''}`}
            onClick={() => {
              menu.close();
              onPick(item.sort);
            }}
          >
            <span className="scene-choice__mark" aria-hidden />
            <span className="scene-choice__name">{item.name}</span>
            {item.hint && (
              <span className="gallery-sorts__hint">{item.hint}</span>
            )}
          </button>
        ))}
      </AnchoredMenu>
    </>
  );
}
