/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

import { useId, useSyncExternalStore, type ReactNode } from 'react';
import Chevron from '../icons/Chevron';
import { createFlagSetting } from '../utils/graphStorage';

/**
 * A card in the Studio's side column that folds away.
 *
 * The column does not fit on a laptop screen: reaching the response sliders
 * meant scrolling the scene being tuned off the top. Folding a card not in
 * use is what gives the room back, and each stays where it was left.
 *
 * Two of them now. Everything a scene is tried and tuned with — what it is
 * played with, the picture, the visualizer's own settings and how hard it is
 * drawn — is one card in one order, the order the graph's View menu shows
 * the same settings in (`common/settingsGroups.ts`); the other says what to
 * do with the scene when it is ready.
 *
 * What it hears now is deliberately not one of these: it is the meter the
 * scene is judged by, and a meter nobody can see is a meter that was not
 * consulted.
 *
 * Open unless it was folded before. Collapsing reclaims space; it is not a
 * setting to go looking for — the same rule the output sidebar's sections
 * follow (`SidebarSection.tsx`), whose reveal this borrows.
 */

/** Which cards fold, and where each one's state is kept. */
export type TStudioFold = 'test' | 'ship';

const SETTINGS: Record<TStudioFold, ReturnType<typeof createFlagSetting>> = {
  // A key of its own, because this card is no longer the one that was
  // folded: it took in the performance rows, which were a card beside it, so
  // a member who had folded the test signals away would have folded away
  // settings they never put there. It opens once, then remembers again.
  test: createFlagSetting('fluideq.studioFold.trying', true),
  ship: createFlagSetting('fluideq.studioFold.ship', true),
};

interface IStudioFoldCardProps {
  fold: TStudioFold;
  /** The card's own eyebrow, which is also what opens and closes it. */
  title: string;
  /**
   * The one part of the card that never folds away — how the scene is keeping
   * up, on the card that says so. A live reading is the thing somebody folding
   * the controls above it still wants on screen, so it sits under the fold
   * rather than inside it.
   */
  aside?: ReactNode;
  /** Extra classes on the card itself, as the card had before it folded. */
  className?: string;
  /**
   * Nothing is on the stage: the card waits, unlit, where it will be. Shown,
   * not announced — every control inside is already `disabled`, which is what
   * a screen reader reads, and `aria-disabled` is not a thing a region takes.
   */
  idle?: boolean;
  children: ReactNode;
}

export default function StudioFoldCard({
  fold,
  title,
  aside,
  className,
  idle = false,
  children,
}: IStudioFoldCardProps) {
  const setting = SETTINGS[fold];
  const open = useSyncExternalStore(setting.subscribe, setting.get, () => true);
  const bodyId = useId();
  const titleId = useId();

  return (
    <section
      className={`studio-card studio-fold${open ? ' is-open' : ''}${
        idle ? ' is-idle' : ''
      }${className ? ` ${className}` : ''}`}
      // Named by its own title, so a folded card is announced as a region
      // with a name rather than as an unlabelled box with a button in it.
      aria-labelledby={titleId}
    >
      <button
        type="button"
        className="studio-fold__head"
        aria-expanded={open}
        aria-controls={bodyId}
        onClick={() => setting.set(!open)}
      >
        <span className="studio-card__eyebrow" id={titleId}>
          {title}
        </span>
        <Chevron className="studio-fold__chevron" />
      </button>
      {/* A 0fr to 1fr grid row: the one height transition that needs no
          measured pixel value, so a card can hold anything and still open
          smoothly. The contents stay in the page — the transition needs them
          there — so `inert` is what keeps Tab and a screen reader out of a
          card that has been folded away. */}
      <div className="studio-fold__reveal" id={bodyId} inert={!open}>
        <div className="studio-fold__body">{children}</div>
      </div>
      {aside && <div className="studio-fold__aside">{aside}</div>}
    </section>
  );
}
