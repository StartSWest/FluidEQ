/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

import { Fragment, useEffect, useRef, useState } from 'react';
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
  /**
   * Why it is off, said under it, and the step that shows what to fix: an
   * item that is only off reads as one that does nothing when pressed.
   */
  why?: {
    reason: string;
    step: string;
    glyph: TCommunityGlyph;
    onStep: () => void;
  };
}

interface IStudioShipMoreProps {
  items: readonly IShipMoreItem[];
}

/**
 * The bar's less-used ways out of the Studio behind one button: sending the
 * scene as a file and putting it on the desktop, beside Publish and the loud
 * Add to my looks (layout A, Ivan 2026-09-27). Four equal buttons in a pinned
 * card was what the side column ended on; in the bar the one most members
 * press stands alone.
 */
export default function StudioShipMore({ items }: IStudioShipMoreProps) {
  const { t } = useTranslation();
  const [isOpen, setIsOpen] = useState(false);
  const busy = items.some((item) => item.busy);
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
      {/* Busy while one of its items runs: the menu closes on the press, so
          the item's own busy state is out of sight from its first second —
          and getting a scene ready for the desktop reads its whole folder. */}
      <button
        type="button"
        className={`button small subtle studio-ship-more__trigger${isOpen ? ' is-open' : ''}${busy ? ' is-running' : ''}`}
        aria-haspopup="menu"
        aria-expanded={isOpen}
        aria-busy={busy}
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
        {items.map((item) => {
          const { why } = item;
          const whyId = `studio-ship-more-${item.key}-why`;
          return (
            <Fragment key={item.key}>
              <button
                type="button"
                role="menuitem"
                className={`studio-ship-more__item${item.busy ? ' is-running' : ''}`}
                aria-busy={item.busy}
                aria-describedby={item.disabled && why ? whyId : undefined}
                disabled={item.disabled}
                onClick={() => {
                  setIsOpen(false);
                  item.onSelect();
                }}
              >
                <Glyph name={item.glyph} />
                <span className="studio-ship-more__label">{item.label}</span>
              </button>
              {item.disabled && why && (
                <div className="studio-ship-more__note">
                  <span id={whyId}>{why.reason}</span>
                  <button
                    type="button"
                    role="menuitem"
                    className="button small subtle"
                    onClick={() => {
                      setIsOpen(false);
                      why.onStep();
                    }}
                  >
                    <Glyph name={why.glyph} />
                    {why.step}
                  </button>
                </div>
              )}
            </Fragment>
          );
        })}
      </AnchoredMenu>
    </span>
  );
}
