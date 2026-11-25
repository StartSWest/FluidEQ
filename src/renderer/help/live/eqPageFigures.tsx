/* Copyright (C) 2026 Ivan Carmenates Garcia. SPDX-License-Identifier: GPL-3.0-or-later */

import { type CSSProperties, useLayoutEffect, useRef, useState } from 'react';
import {
  MAX_FREQUENCY,
  MAX_GAIN,
  MAX_QUALITY,
  MIN_FREQUENCY,
  MIN_GAIN,
  MIN_QUALITY,
} from 'common/constants';
import ConfirmIcon from '../../icons/ConfirmIcon';
import { labelledFilterOptions } from '../../icons/FilterTypeIcon';
import MenuIcon from '../../icons/MenuIcon';
import TrashIcon from '../../icons/TrashIcon';
import { FluidEqProviderWrapper } from '../../utils/FluidEqContext';
import frequencyText from '../../utils/frequencyText';
import { useTranslation } from '../../utils/I18nContext';
import Dropdown from '../../widgets/Dropdown';
import Knob from '../../widgets/Knob';
import Switch from '../../widgets/Switch';
import { HelpEqGraphCard } from './HelpEqGraph';
import helpEqState, { HELP_EQ_FILTERS, HELP_EQ_SELECTED } from './helpEqState';
import { HelpEqBands, HelpEqHead, HelpEqTabRow } from './eqPageParts';

/**
 * The EQ page as it opens, and Your EQ's band popover and right-click menu,
 * for the start and EQ chapters (`helpChapters/start.ts`, `sound.ts`).
 *
 * The page is the centre column on the EQ page with the graph over the bands
 * (`App`'s `is-graph-first`): the section pills, the graph's card, the tab
 * row and the bands, laid out at a width where the tab row keeps every word,
 * with the made-up EQ injected through `FluidEqProviderWrapper` in place of
 * the reader's. The band popover and the band menu are `EqBandEditor`'s and
 * `BandMenu`'s markup round the app's own dials, switch and filter list: the
 * real ones act on the reader's bands, follow the keyboard on `window` and
 * portal themselves into the page.
 */

const nothing = () => undefined;
const nowhere = async () => undefined;

/** The column's width, and the graph's plot within it. */
const PAGE_WIDTH = 1180;
const GRAPH = { width: PAGE_WIDTH, height: 340 };
const EDITOR_HEIGHT = 470;

const VALUE = helpEqState();
const SELECTED_VALUE = helpEqState([HELP_EQ_SELECTED]);

const EqPage = ({ selected }: { selected?: readonly string[] }) => (
  <div
    className="center-workspace is-graph-first"
    style={{
      width: PAGE_WIDTH,
      height: 49 + GRAPH.height + 10 + EDITOR_HEIGHT,
    }}
  >
    <HelpEqHead />
    <div
      className="middle-content"
      style={{ '--editor-height': `${EDITOR_HEIGHT}px` } as CSSProperties}
    >
      <div className="workspace-tab-panel workspace-tab-panel--eq">
        <div className="workspace-tab-panel__row">
          <HelpEqTabRow />
        </div>
        <div className="workspace-tab-panel__scroll">
          <HelpEqBands selected={selected} />
        </div>
      </div>
    </div>
    <HelpEqGraphCard size={GRAPH} isIdle selected={selected} />
  </div>
);

/** The whole page, nothing selected. */
export function EqPageDrawing() {
  return (
    <FluidEqProviderWrapper value={VALUE}>
      <EqPage />
    </FluidEqProviderWrapper>
  );
}

/**
 * The band popover, `EqBandEditor`'s markup, for the selected band: placed
 * the way `useBandPopoverPlace` places it, against its slider's handle on
 * the side with room, its point at the handle's height.
 */
const BandPopover = () => {
  const { t } = useTranslation();
  const element = useRef<HTMLDivElement>(null);
  const [place, setPlace] = useState<{
    left: number;
    top: number;
    arrow: number;
  }>();
  const sorted = Object.values(HELP_EQ_FILTERS).sort(
    (a, b) => a.frequency - b.frequency,
  );
  const at = sorted.findIndex((band) => band.id === HELP_EQ_SELECTED);
  const band = sorted[at];

  // Measured in the panel's own pixels: the figure is drawn under CSS zoom,
  // which client rectangles include and `left`/`top` do not.
  useLayoutEffect(() => {
    const popover = element.current;
    const room = popover?.offsetParent;
    const slider = room?.querySelector<HTMLInputElement>(
      `.bandWrapper[data-filter-id="${HELP_EQ_SELECTED}"] input[type="range"]`,
    );
    if (!popover || !(room instanceof HTMLElement) || !slider) {
      return;
    }
    const roomBox = room.getBoundingClientRect();
    const unit = roomBox.width / room.offsetWidth;
    const track = slider.getBoundingClientRect();
    const share = (Number(slider.value) - MIN_GAIN) / (MAX_GAIN - MIN_GAIN);
    const x = (track.left + track.width / 2 - roomBox.left) / unit;
    const y = (track.bottom - share * track.height - roomBox.top) / unit;
    const height = popover.offsetHeight;
    const top = Math.max(6, y - height / 2);
    setPlace({ left: x + 24, top, arrow: Math.max(18, y - top) });
  }, []);

  if (!band) {
    return null;
  }
  return (
    <div
      ref={element}
      className="eq-flat-editor eq-flat-editor--popover is-right"
      role="dialog"
      style={
        place
          ? ({
              left: place.left,
              top: place.top,
              '--popover-arrow': `${place.arrow}px`,
            } as CSSProperties)
          : { visibility: 'hidden' }
      }
    >
      <div className="eq-band-popover__head">
        <button
          type="button"
          className="eq-band-popover__step"
          aria-label={t('eq.popover.previous')}
        >
          <svg viewBox="0 0 16 16" aria-hidden>
            <path d="M10 3.5l-4 4.5 4 4.5" />
          </svg>
        </button>
        <strong className="eq-band-popover__title">
          {t('eq.popover.title', {
            index: at + 1,
            frequency: frequencyText(band.frequency),
          })}
        </strong>
        <button
          type="button"
          className="eq-band-popover__step"
          aria-label={t('eq.popover.next')}
        >
          <svg viewBox="0 0 16 16" aria-hidden>
            <path d="M6 3.5l4 4.5-4 4.5" />
          </svg>
        </button>
        <div className="eq-band-popover__filter">
          <Dropdown
            name="help-band-filter-type"
            value={band.type}
            options={labelledFilterOptions(t)}
            isDisabled={false}
            placement="down"
            handleChange={nothing}
          />
        </div>
        <button
          type="button"
          className="eq-band-popover__close"
          aria-label={t('eq.popover.close')}
        >
          <ConfirmIcon variant="cancel" />
        </button>
      </div>
      <div className="eq-band-popover__dials">
        <div className="eq-flat-editor__control eq-flat-editor__control--centred eq-flat-editor__control--frequency">
          <span>{t('eq.frequency')}</span>
          <Knob
            name={t('eq.frequency')}
            value={band.frequency}
            min={MIN_FREQUENCY}
            max={MAX_FREQUENCY}
            sensitivity={0.2}
            isDisabled={false}
            step={1}
            unit="Hz"
            handleChange={nowhere}
          />
        </div>
        <div className="eq-flat-editor__control eq-flat-editor__control--centred eq-flat-editor__control--gain">
          <span>{t('eq.gain')}</span>
          <Knob
            name={t('eq.gain')}
            value={band.gain}
            min={MIN_GAIN}
            max={MAX_GAIN}
            isDisabled={false}
            step={0.01}
            unit="dB"
            defaultValue={0}
            handleChange={nowhere}
          />
        </div>
        <div className="eq-flat-editor__control eq-flat-editor__control--centred eq-flat-editor__control--quality">
          <span>{t('eq.quality')}</span>
          <Knob
            name={t('eq.quality')}
            value={band.quality}
            min={MIN_QUALITY}
            max={MAX_QUALITY}
            isDisabled={false}
            step={0.01}
            unit="Q"
            handleChange={nowhere}
          />
        </div>
      </div>
      <div className="eq-band-popover__foot">
        <div className="eq-flat-editor__control eq-flat-editor__control--centred eq-flat-editor__control--active">
          <span>{t('eq.active')}</span>
          <div className="eq-flat-editor__switch">
            <Switch
              id="help-band-active"
              isOn
              isDisabled={false}
              handleToggle={nothing}
            />
          </div>
        </div>
        <div className="eq-flat-editor__delete-cell">
          <button type="button" className="eq-flat-editor__delete">
            <TrashIcon
              className="eq-flat-editor__delete-icon"
              fill="currentColor"
            />
          </button>
        </div>
      </div>
    </div>
  );
};

/** The bands with the fifth selected and its popover up against its slider. */
export function EqBandPopoverDrawing() {
  return (
    <FluidEqProviderWrapper value={SELECTED_VALUE}>
      <div className="workspace-tab-panel workspace-tab-panel--eq">
        <div
          className="workspace-tab-panel__scroll"
          style={{ width: PAGE_WIDTH, height: EDITOR_HEIGHT - 50 }}
        >
          <HelpEqBands selected={[HELP_EQ_SELECTED]}>
            <BandPopover />
          </HelpEqBands>
        </div>
      </div>
    </FluidEqProviderWrapper>
  );
}

/** A band's right-click menu, `BandMenu`'s markup, on the fifth band. */
export function BandMenuDrawing() {
  const { t } = useTranslation();
  const band = HELP_EQ_FILTERS[HELP_EQ_SELECTED];
  return (
    <div style={{ width: 240, padding: 8 }}>
      <div
        className="band-menu"
        role="menu"
        style={{ position: 'relative', inset: 'auto' }}
      >
        <p className="band-menu__subject">
          {t('eq.menu.subject', { frequency: band?.frequency ?? 0 })}
        </p>
        <button type="button">
          <MenuIcon name="reset" className="band-menu__icon" />
          <span>{t('eq.menu.reset')}</span>
        </button>
        <button type="button">
          <MenuIcon name="power" className="band-menu__icon" />
          <span>{t('eq.menu.disable')}</span>
        </button>
        <button type="button">
          <MenuIcon name="trash" className="band-menu__icon" />
          <span>{t('eq.delete')}</span>
        </button>
        <div className="band-menu__rule" role="none" />
        <button type="button" role="menuitemradio" aria-checked>
          <MenuIcon name="check" className="band-menu__icon is-on" />
          <span>{t('eq.channels.both')}</span>
        </button>
        <button type="button" role="menuitemradio" aria-checked={false}>
          <span className="band-menu__icon" aria-hidden="true" />
          <span>{t('eq.channels.split')}</span>
        </button>
        <div className="band-menu__rule" role="none" />
        <button type="button">
          <MenuIcon name="previous" className="band-menu__icon" />
          <span>{t('eq.menu.addLeft')}</span>
        </button>
        <button type="button">
          <MenuIcon name="next" className="band-menu__icon" />
          <span>{t('eq.menu.addRight')}</span>
        </button>
      </div>
    </div>
  );
}
