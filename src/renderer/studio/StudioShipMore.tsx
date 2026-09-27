/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

import { useEffect, useRef, useState } from 'react';
import Glyph, { type TCommunityGlyph } from '../community/Glyph';
import Chevron from '../icons/Chevron';
import { useTranslation } from '../utils/I18nContext';
import AnchoredMenu, { isInsideAnchoredMenu } from '../widgets/AnchoredMenu';

export interface IShipMoreItem {
  key: string;
  glyph: TCommunityGlyph;
  label: string;
  onSelect: () => void;
  disabled?: boolean;
  /** Running now: pressed once already and still going. */
  busy?: boolean;
  /** Plus's, shown locked where it would be pressed; it offers Plus instead. */
  locked?: boolean;
}

interface IStudioShipMoreProps {
  items: readonly IShipMoreItem[];
  /** A line above the rows, saying why they are what they are. */
  lead?: string;
}

/**
 * The bar's less-used ways out of the Studio behind one button: sending the
 * scene as a file and putting it on the desktop, beside Publish and the loud
 * Add to my looks (layout A, Ivan 2026-09-27). Four equal buttons in a pinned
 * card was what the side column ended on; in the bar the one most members
 * press stands alone.
 */
export default function StudioShipMore({ items, lead }: IStudioShipMoreProps) {
  const { t } = useTranslation();
  const [isOpen, setIsOpen] = useState(false);
  const holder = useRef<HTMLSpanElement>(null);

  // Closes on a press elsewhere and on Escape, like every other menu here.
  useEffect(() => {
    if (!isOpen) {
      return undefined;
    }
    const onPointerDown = (event: MouseEvent) => {
      if (
        !holder.current?.contains(event.target as Node) &&
        !isInsideAnchoredMenu(event.target)
      ) {
        setIsOpen(false);
      }
    };
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setIsOpen(false);
      }
    };
    window.addEventListener('mousedown', onPointerDown);
    window.addEventListener('keydown', onKeyDown);
    return () => {
      window.removeEventListener('mousedown', onPointerDown);
      window.removeEventListener('keydown', onKeyDown);
    };
  }, [isOpen]);

  return (
    <span className="studio-ship-more" ref={holder}>
      <button
        type="button"
        className={`button small subtle studio-ship-more__trigger${isOpen ? ' is-open' : ''}`}
        aria-haspopup="menu"
        aria-expanded={isOpen}
        onClick={() => setIsOpen((wasOpen) => !wasOpen)}
      >
        {t('studio.ship.more')}
        <Chevron className="studio-ship-more__chevron" />
      </button>
      <AnchoredMenu
        anchor={holder.current}
        isOpen={isOpen}
        className="studio-ship-more__menu"
        ariaLabel={t('studio.ship.more')}
      >
        {lead && <p className="studio-ship-more__lead">{lead}</p>}
        {items.map((item) => (
          <button
            key={item.key}
            type="button"
            role="menuitem"
            className={`studio-ship-more__item${item.busy ? ' is-running' : ''}`}
            aria-busy={item.busy}
            title={item.locked ? t('studio.plus.locked') : undefined}
            disabled={item.disabled}
            onClick={() => {
              setIsOpen(false);
              item.onSelect();
            }}
          >
            <Glyph name={item.glyph} />
            <span className="studio-ship-more__label">{item.label}</span>
            {item.locked && (
              <Glyph name="lock" className="studio-ship-more__lock" />
            )}
          </button>
        ))}
      </AnchoredMenu>
    </span>
  );
}
