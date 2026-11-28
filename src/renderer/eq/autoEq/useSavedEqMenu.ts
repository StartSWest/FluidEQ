/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

import { useEffect, useState } from 'react';
import { type TViewStep } from '../../utils/viewStep';
import { isInsideAnchoredMenu } from '../../widgets/AnchoredMenu';

/**
 * How the saved EQs' two menus open, move between their views and close
 * (`LoadEqMenu`, `SaveEqMenu`): a press anywhere but the menu and its key
 * closes it (a saved EQ's own row menu is a menu too, and inside), and Escape
 * steps back to the view the menu opened on, then closes it. A row's own menu
 * and its rename take their Escape first.
 */
const useSavedEqMenu = <TView extends string>(home: TView) => {
  const [isOpen, setIsOpen] = useState(false);
  const [view, setView] = useState<TView>(home);
  // The view it opened on: the Save menu opens straight on its form while no
  // saved EQ is on, and Escape there closes it rather than stepping back.
  const [root, setRoot] = useState<TView>(home);
  // Further in slides from the right, back from the left.
  const [step, setStep] = useState<TViewStep>();
  const [search, setSearch] = useState('');
  const [anchor, setAnchor] = useState<HTMLButtonElement | null>(null);

  const close = () => {
    setIsOpen(false);
    setView(home);
    setRoot(home);
    setStep(undefined);
    setSearch('');
  };
  const go = (next: TView) => {
    setView(next);
    setStep(next === root ? 'back' : 'forward');
    if (next === root) {
      setSearch('');
    }
  };
  /** Open on `start`, or close if it is open. */
  const toggle = (start: TView = home) => {
    if (isOpen) {
      close();
      return;
    }
    setView(start);
    setRoot(start);
    setStep(undefined);
    setSearch('');
    setIsOpen(true);
  };

  useEffect(() => {
    if (!isOpen) {
      return undefined;
    }
    const onPointerDown = (event: MouseEvent) => {
      if (
        !isInsideAnchoredMenu(event.target) &&
        !anchor?.contains(event.target as Node)
      ) {
        setIsOpen(false);
        setView(home);
        setRoot(home);
        setStep(undefined);
        setSearch('');
      }
    };
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key !== 'Escape') {
        return;
      }
      if (view === root) {
        setIsOpen(false);
        setView(home);
        setRoot(home);
        setStep(undefined);
        anchor?.focus();
      } else {
        setView(root);
        setStep('back');
      }
      setSearch('');
    };
    window.addEventListener('mousedown', onPointerDown);
    window.addEventListener('keydown', onKeyDown);
    return () => {
      window.removeEventListener('mousedown', onPointerDown);
      window.removeEventListener('keydown', onKeyDown);
    };
  }, [anchor, home, isOpen, root, view]);

  return {
    isOpen,
    view,
    root,
    step,
    search,
    setSearch,
    anchor,
    setAnchor,
    close,
    go,
    toggle,
  };
};

export default useSavedEqMenu;
