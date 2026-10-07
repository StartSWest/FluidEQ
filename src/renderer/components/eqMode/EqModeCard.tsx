/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

import {
  type KeyboardEvent,
  type RefObject,
  useEffect,
  useId,
  useRef,
  useState,
} from 'react';
import type { TEqModeScope } from '../../../common/eqMode';
import EqModeIcon from '../../icons/EqModeIcon';
import MenuIcon from '../../icons/MenuIcon';
import { useTranslation } from '../../utils/I18nContext';
import {
  takeEqModeReveal,
  unpinEqMode,
  useEqModeCardShown,
  useEqModeRevealGeneration,
} from '../../utils/eqModePin';
import SidebarSection from '../SidebarSection';
import { EqModeReset, EqModeRows } from './EqModeRows';
import useEqModeChoices, { EQ_MODE_SCOPES } from './useEqModeChoices';
// The segmented track every closed set of choices in the app is drawn on.
import '../../styles/Dsp.scss';
import '../../styles/EqModeSelect.scss';

interface IEqModeCardProps {
  /** The panel is on screen: beside the page, or open over it. */
  isPaneShown: boolean;
  /** The panel's own scroll, which the card brings itself into. */
  scrollRef: RefObject<HTMLDivElement | null>;
}

/**
 * Scrolls the panel, and nothing else, until the card is in view. Not
 * `scrollIntoView`, which scrolls every clipped ancestor on the way — the
 * shell's included, mid-slide.
 */
const bringIntoPanel = (card: HTMLElement, panel: HTMLElement) => {
  const box = card.getBoundingClientRect();
  const view = panel.getBoundingClientRect();
  if (box.top < view.top) {
    panel.scrollTop -= view.top - box.top;
  } else if (box.bottom > view.bottom) {
    panel.scrollTop += Math.min(box.bottom - view.bottom, box.top - view.top);
  }
};

const PinnedEqModeCard = ({ isPaneShown, scrollRef }: IEqModeCardProps) => {
  const { t } = useTranslation();
  const choices = useEqModeChoices();
  const [group, setGroup] = useState<TEqModeScope>('eq');
  const generation = useEqModeRevealGeneration();
  const [arrival, setArrival] = useState<number>();
  const section = useRef<HTMLElement>(null);
  const tabs = useRef<Partial<Record<TEqModeScope, HTMLButtonElement | null>>>(
    {},
  );
  const id = useId();

  // A reveal waits for the panel to be on screen: the drawer opened, or the
  // column unfolded, in the same press. Then the card comes into view, the
  // group on show takes the focus, and the card's edge lights.
  useEffect(() => {
    const panel = scrollRef.current;
    if (!isPaneShown || !panel || !section.current || !takeEqModeReveal()) {
      return;
    }
    bringIntoPanel(section.current, panel);
    tabs.current[group]?.focus({ preventScroll: true });
    setArrival(generation);
  }, [generation, group, isPaneShown, scrollRef]);

  // The groups are tabs: the arrows move between them, as on any tab row.
  const onTabKey = (event: KeyboardEvent<HTMLButtonElement>) => {
    const index = EQ_MODE_SCOPES.indexOf(group);
    const last = EQ_MODE_SCOPES.length - 1;
    let next: number | undefined;
    if (event.key === 'ArrowRight') {
      next = index === last ? 0 : index + 1;
    } else if (event.key === 'ArrowLeft') {
      next = index === 0 ? last : index - 1;
    } else if (event.key === 'Home') {
      next = 0;
    } else if (event.key === 'End') {
      next = last;
    }
    if (next === undefined) {
      return;
    }
    event.preventDefault();
    setGroup(EQ_MODE_SCOPES[next]);
    tabs.current[EQ_MODE_SCOPES[next]]?.focus();
  };

  return (
    <SidebarSection
      // A new reveal opens the card again if it was folded away.
      key={generation}
      ref={section}
      className={`eq-mode-card${arrival === generation ? ' is-arriving' : ''}`}
      glyph={<MenuIcon name="settings" />}
      title={t('eq.mode')}
      status={t(choices.customized ? 'eq.mode.customized' : 'eq.mode.normal')}
      aside={
        <button
          type="button"
          className="button small subtle eq-mode-card__unpin"
          aria-label={t('eq.mode.unpin')}
          title={t('eq.mode.unpin')}
          onClick={unpinEqMode}
        >
          <MenuIcon name="pin" />
        </button>
      }
    >
      <div
        className="eq-mode-choices eq-mode-card__body"
        aria-busy={choices.isSaving}
      >
        <div
          className="eq-mode-card__groups"
          role="tablist"
          aria-label={t('eq.mode')}
        >
          {EQ_MODE_SCOPES.map((scope) => (
            <button
              key={scope}
              ref={(node) => {
                tabs.current[scope] = node;
              }}
              type="button"
              role="tab"
              id={`${id}-${scope}`}
              aria-selected={group === scope}
              aria-controls={`${id}-${scope}-rows`}
              tabIndex={group === scope ? 0 : -1}
              className="eq-mode-card__group"
              onClick={() => setGroup(scope)}
              onKeyDown={onTabKey}
            >
              <EqModeIcon kind={scope} />
              <span>
                {t(scope === 'eq' ? 'eq.mode.yourEq' : 'eq.mode.curves')}
              </span>
            </button>
          ))}
        </div>
        {/* Both groups, one over the other, the one not on show hidden: the
            card stands as tall as the taller, so changing tabs never moves
            Reset, or the output card under it. */}
        <div className="eq-mode-card__panels">
          {EQ_MODE_SCOPES.map((scope) => (
            <div
              key={scope}
              className="eq-mode-card__rows"
              role="tabpanel"
              id={`${id}-${scope}-rows`}
              aria-labelledby={`${id}-${scope}`}
              inert={group !== scope}
            >
              <EqModeRows choices={choices} scope={scope} />
            </div>
          ))}
        </div>
        <div className="eq-mode-card__foot">
          <p className="eq-mode-choices__note">{t('eq.mode.shapeHint')}</p>
          <EqModeReset choices={choices} />
        </div>
      </div>
    </SidebarSection>
  );
};

/**
 * The EQ mode menu pinned beside the graph (`eqModePin.ts`): the same
 * settings, one group at a time, as the first card of the sound panel, where
 * they no longer cover the curves they change.
 */
const EqModeCard = ({ isPaneShown, scrollRef }: IEqModeCardProps) => {
  const isShown = useEqModeCardShown();
  return isShown ? (
    <PinnedEqModeCard isPaneShown={isPaneShown} scrollRef={scrollRef} />
  ) : null;
};

export default EqModeCard;
