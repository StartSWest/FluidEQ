/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>

This program is free software: you can redistribute it and/or modify
it under the terms of the GNU General Public License version 3 or later.
*/

import { useEffect, useState } from 'react';
import AnchoredMenu, { isInsideAnchoredMenu } from '../widgets/AnchoredMenu';
import { useTranslation } from '../utils/I18nContext';
import ColourPickerPopover from './ColourPickerPopover';

/**
 * The colours a point can be set to without leaving the panel: the app's own
 * accents first, then a spread around the wheel. One click, nothing covered —
 * the graph the colour is being judged against stays in view. "Custom" opens
 * FluidEQ's own picker for anything this set does not have.
 */
const SWATCH_CHOICES = [
  '#00e5cf',
  '#54ff8a',
  '#ffcc4d',
  '#ff8a3d',
  '#ff4f4f',
  '#ff4f9a',
  '#c86bff',
  '#6b8aff',
  '#00b3ff',
  '#ffffff',
  '#9aa7b8',
  '#0d1420',
];

interface ILookColourPaneProps {
  /** The point or swatch it opens from, and stays attached to. */
  anchor: HTMLElement | null;
  isOpen: boolean;
  /** What is being coloured, for the custom picker's heading. */
  title: string;
  colour: string;
  onChange: (colour: string) => void;
  onClose: () => void;
  /** A point that can go; absent where there is nothing to take away. */
  onRemove?: () => void;
  removeLabel?: string;
}

/**
 * A point's colours, hung off the point.
 *
 * It used to be absolutely positioned inside the point's own box, which sits
 * inside the panel's scrolling body: a point on the right of the row put it
 * past the panel's edge, where the body clipped it (Ivan, 2026-11-26: "that
 * color pane not placed correctly"). It is an `AnchoredMenu` now — drawn over
 * everything, kept inside the window at both edges, flipped above the point
 * when there is no room below, and moved with the point while the panel
 * scrolls. Escape, or a press anywhere else, closes it.
 */
const LookColourPane = ({
  anchor,
  isOpen,
  title,
  colour,
  onChange,
  onClose,
  onRemove,
  removeLabel,
}: ILookColourPaneProps) => {
  const { t } = useTranslation();
  // The colour the custom picker opened on, which Cancel goes back to.
  const [customFrom, setCustomFrom] = useState<string>();
  const isGridOpen = isOpen && customFrom === undefined;

  useEffect(() => {
    if (!isOpen) {
      setCustomFrom(undefined);
    }
  }, [isOpen]);

  useEffect(() => {
    if (!isGridOpen) {
      return undefined;
    }
    // Pointer-down, so the pane is gone before whatever was pressed reacts;
    // the point itself toggles it, so a press there is left to the point.
    const onPress = (event: PointerEvent) => {
      if (
        !isInsideAnchoredMenu(event.target) &&
        !(
          anchor &&
          event.target instanceof Node &&
          anchor.contains(event.target)
        )
      ) {
        onClose();
      }
    };
    // In the capture phase, ahead of the graph's own Escape, which would
    // otherwise close the whole look editor with the pane still on it.
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.stopPropagation();
        onClose();
        anchor?.focus();
      }
    };
    window.addEventListener('pointerdown', onPress);
    window.addEventListener('keydown', onKey, true);
    return () => {
      window.removeEventListener('pointerdown', onPress);
      window.removeEventListener('keydown', onKey, true);
    };
  }, [isGridOpen, anchor, onClose]);

  return (
    <>
      <AnchoredMenu
        anchor={anchor}
        isOpen={isGridOpen}
        className="look-colour-pane"
        role="dialog"
        ariaLabel={title}
        align="left"
      >
        <div className="look-colour-pane__grid">
          {SWATCH_CHOICES.map((choice) => (
            <button
              key={choice}
              type="button"
              className={`look-colour-pane__choice${
                choice === colour.toLowerCase() ? ' is-on' : ''
              }`}
              style={{ background: choice }}
              aria-label={choice}
              aria-pressed={choice === colour.toLowerCase()}
              title={choice}
              onClick={() => {
                onChange(choice);
                onClose();
              }}
            />
          ))}
        </div>
        <div className="look-colour-pane__foot">
          <button
            type="button"
            className="look-colour-pane__more"
            title={t('look.customColour')}
            onClick={() => setCustomFrom(colour)}
          >
            {t('look.custom')}
          </button>
          {onRemove && (
            <button
              type="button"
              className="look-colour-pane__more look-colour-pane__more--remove"
              onClick={() => {
                onRemove();
                onClose();
              }}
            >
              {removeLabel}
            </button>
          )}
        </div>
      </AnchoredMenu>
      <ColourPickerPopover
        anchor={anchor}
        isOpen={isOpen && customFrom !== undefined}
        title={title}
        value={customFrom ?? colour}
        onChange={onChange}
        onAccept={(next) => {
          onChange(next);
          onClose();
        }}
        onCancel={() => {
          if (customFrom !== undefined) {
            onChange(customFrom);
          }
          onClose();
        }}
      />
    </>
  );
};

export default LookColourPane;
