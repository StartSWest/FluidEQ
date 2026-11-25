/* Copyright (C) 2026 Ivan Carmenates Garcia. SPDX-License-Identifier: GPL-3.0-or-later */

import type { ReactNode } from 'react';
import { format } from 'd3';
import type { GraphStyle } from 'common/graphStyles';
import { DEFAULT_GRAPH_TILT, GRAPH_TILTS } from 'common/graphAnalysis';
import { OWN_GROUP_TITLE, SETTINGS_GROUP_TITLE } from 'common/settingsGroups';
import {
  DEFAULT_GRAPH_FREQUENCY_RANGE,
  GRAPH_FREQUENCY_RANGES,
  GRAPH_FREQUENCY_SPANS,
} from '../../graph/graphFrequencyRanges';
import { Group, Icon } from '../../graph/GraphViewMenuFrame';
import ViewMenuSwitch from '../../graph/ViewMenuSwitch';
import LookIcon from '../../icons/LookIcon';
import PaletteIcon from '../../icons/PaletteIcon';
import { FluidEqProviderWrapper } from '../../utils/FluidEqContext';
import { useTranslation } from '../../utils/I18nContext';
import DesktopGlyph from '../../wallpaper/DesktopGlyph';
import Dropdown from '../../widgets/Dropdown';
import { HelpEqGraphCard } from './HelpEqGraph';
import helpEqState from './helpEqState';
import aurora from '../../../../assets/tour/scene-aurora.jpg';
import bloom from '../../../../assets/tour/scene-bloom.jpg';
import neonCity from '../../../../assets/tour/scene-neon-city.jpg';

/**
 * The graph chapter's figures (`helpChapters/visuals.ts`): the EQ page's
 * graph with its options out, on a standard style and on a scene, and its
 * View menu open.
 *
 * The plot is `HelpEqGraph`'s (the graph's own `Chart`, made-up bands). The
 * options — the gallery reel along the plot's foot with the look's credit
 * and its switches, and the View menu — are their markup, class for class
 * (`GraphGallery`, `GraphAutoCycle`, `LightingToggle`, `GraphWallpaperToggle`,
 * `SceneLikeButton`, `GraphViewMenu`, `GraphScaleChoices`), around the
 * menu's own groups and switches: the real ones read and change the reader's
 * graph settings, their scenes and their likes. A scene is a still the app
 * already ships, laid where its canvas would be.
 */

const nothing = () => undefined;

const GRAPH = { width: 1180, height: 400 };
const VALUE = helpEqState();

/** A standard look's picture in the reel, as `GalleryPicture` draws one. */
const LookPicture = ({ look }: { look: GraphStyle }) => (
  <span className="graph-gallery-picture graph-gallery-picture--look">
    <LookIcon
      className="graph-gallery-picture__glyph"
      style={look}
      palette="auto"
    />
  </span>
);

/** A scene's picture in the reel: its still. */
const ScenePicture = ({ src }: { src: string }) => (
  <span className="graph-gallery-picture">
    <img src={src} alt="" draggable={false} />
  </span>
);

const STEP_PATHS = {
  previous: 'M10 3.5l-4 4.5 4 4.5',
  next: 'M6 3.5l4 4.5-4 4.5',
} as const;

const Edge = ({
  side,
  picture,
  name,
}: {
  side: 'previous' | 'next';
  picture: ReactNode;
  name: string;
}) => {
  const { t } = useTranslation();
  return (
    <button
      type="button"
      className={`graph-gallery-edge graph-gallery-edge--${side}`}
      aria-label={`${t(
        side === 'previous' ? 'graph.style.previous' : 'graph.style.next',
      )}: ${name}`}
    >
      {picture}
      <span className="graph-gallery-edge__step" aria-hidden>
        <svg viewBox="0 0 16 16">
          <path d={STEP_PATHS[side]} />
        </svg>
      </span>
    </button>
  );
};

const CYCLE_ICON = (
  <svg className="graph-auto-cycle__icon" viewBox="0 0 16 16" aria-hidden>
    <path d="M13.2 7.2a5.2 5.2 0 0 0-9.3-2.6" />
    <path d="M3.4 1.9v2.9h2.9" />
    <path d="M2.8 8.8a5.2 5.2 0 0 0 9.3 2.6" />
    <path d="M12.6 14.1v-2.9H9.7" />
  </svg>
);

const AutoCycle = () => {
  const { t } = useTranslation();
  const label = t('graph.autoSwitch.every', { seconds: 120 });
  return (
    <Dropdown
      name={t('graph.autoSwitch.label')}
      className="graph-auto-cycle is-on"
      leading={CYCLE_ICON}
      options={[{ value: '120', label, display: label }]}
      value="120"
      isDisabled={false}
      placement="down"
      handleChange={nothing}
    />
  );
};

const GridToggle = () => {
  const { t } = useTranslation();
  return (
    <button
      type="button"
      className="graph-look-step graph-look-step--toggle"
      aria-pressed
      aria-label={t('graph.hide', { item: t('graph.item.grid') })}
    >
      <svg viewBox="0 0 16 16" aria-hidden>
        <path d="M2.5 2.5h11v11h-11zM2.5 6.2h11M2.5 9.8h11M6.2 2.5v11M9.8 2.5v11" />
      </svg>
    </button>
  );
};

const EditHint = () => {
  const { t } = useTranslation();
  return (
    <span
      className="graph-edit-hint-mark"
      role="img"
      aria-label={t('graph.editHint')}
    >
      ?
    </span>
  );
};

/** The credit: the look's picture, name and maker, its place in the walk. */
const Credit = ({
  picture,
  name,
  byline,
  extra,
  tools,
}: {
  picture: ReactNode;
  name: string;
  byline: string;
  extra?: ReactNode;
  tools: ReactNode;
}) => {
  const { t } = useTranslation();
  return (
    <div className="graph-gallery-credit" role="group">
      <span className="graph-gallery-credit__head">
        <div className="dropdown look-picker">
          <button
            type="button"
            className="graph-gallery-credit__title"
            aria-haspopup="dialog"
            aria-label={t('graph.picker.label')}
          >
            {picture}
            <span className="graph-gallery-credit__who">
              <span className="graph-gallery-credit__name">
                <span className="graph-gallery-credit__name-text">{name}</span>
              </span>
              <span className="graph-gallery-credit__byline">{byline}</span>
            </span>
          </button>
        </div>
        {extra}
        <span className="graph-gallery-credit__place" role="img">
          <i />
          <i className="is-here" />
          <i />
          <i />
          <i />
        </span>
      </span>
      <span className="graph-gallery-credit__tools">
        <span className="graph-gallery-credit__tools-row">{tools}</span>
      </span>
    </div>
  );
};

/** The reel on a standard style: the Analyzer, between Horizon and Before & after. */
const StyleReel = () => {
  const { t } = useTranslation();
  return (
    <div className="graph-gallery-reel">
      <Edge
        side="previous"
        picture={<LookPicture look="horizon" />}
        name={t('graph.styleName.horizon')}
      />
      <Credit
        picture={<LookPicture look="analyzer" />}
        name={t('graph.styleName.analyzer')}
        byline={t('graph.family.analysis')}
        tools={
          <>
            <AutoCycle />
            <button
              type="button"
              className="graph-look-step graph-look-step--toggle"
              aria-pressed
              aria-label={`${t('look.palette.cycle')}: ${t('look.palette.auto')}`}
            >
              <PaletteIcon palette="auto" />
            </button>
            <button type="button" className="graph-solo" aria-pressed={false}>
              {t('graph.design.new')}
            </button>
            <GridToggle />
            <EditHint />
          </>
        }
      />
      <Edge
        side="next"
        picture={<LookPicture look="compare" />}
        name={t('graph.styleName.compare')}
      />
    </div>
  );
};

/** The heart `SceneLikeButton` draws. */
const Heart = () => (
  <svg className="graph-like__heart" viewBox="0 0 16 16" aria-hidden="true">
    <path d="M8 13.6S2.2 10 2.2 6.1A2.9 2.9 0 0 1 8 4.6a2.9 2.9 0 0 1 5.8 1.5C13.8 10 8 13.6 8 13.6z" />
  </svg>
);

/** The reel on a scene: Aurora, between Bloom and Neon City. */
const SceneReel = () => {
  const { t } = useTranslation();
  const name = t('help.graph.sampleScene');
  return (
    <div className="graph-gallery-reel">
      <Edge
        side="previous"
        picture={<ScenePicture src={bloom} />}
        name={t('help.graph.sampleScenePrevious')}
      />
      <Credit
        picture={<ScenePicture src={aurora} />}
        name={name}
        byline={t('graph.member.by', { name: t('help.graph.sampleMaker') })}
        extra={
          <button
            type="button"
            className="graph-solo graph-like"
            aria-pressed={false}
            aria-label={t('graph.member.like', { name })}
          >
            <Heart />
            128
          </button>
        }
        tools={
          <>
            <AutoCycle />
            <button
              type="button"
              className="graph-look-step graph-look-step--toggle graph-lighting is-live"
              aria-pressed
              aria-label={t('lighting.graph.on')}
            >
              <svg viewBox="0 0 16 16" aria-hidden>
                <rect x="2.5" y="8" width="11" height="6" rx="1.6" />
                <path d="M6 11h4" />
                <path d="M8 2v2.4M3.6 3.6l1.6 1.6M12.4 3.6l-1.6 1.6" />
              </svg>
            </button>
            <button
              type="button"
              className="graph-look-step graph-look-step--toggle graph-wallpaper"
              aria-pressed={false}
              aria-label={t('wallpaper.action')}
            >
              <DesktopGlyph />
            </button>
            <GridToggle />
            <EditHint />
          </>
        }
      />
      <Edge
        side="next"
        picture={<ScenePicture src={neonCity} />}
        name={t('help.graph.sampleSceneNext')}
      />
    </div>
  );
};

/** The graph with its options out, on a standard style. */
export function GraphStyleDrawing() {
  return (
    <FluidEqProviderWrapper value={VALUE}>
      <HelpEqGraphCard size={GRAPH} isIdle={false}>
        <StyleReel />
      </HelpEqGraphCard>
    </FluidEqProviderWrapper>
  );
}

/** The graph with its options out, on a scene: its still under the plot. */
export function GraphSceneDrawing() {
  return (
    <FluidEqProviderWrapper value={VALUE}>
      <div style={{ position: 'relative' }}>
        <img
          src={aurora}
          alt=""
          style={{
            position: 'absolute',
            inset: 0,
            width: '100%',
            height: '100%',
            objectFit: 'cover',
          }}
        />
        <HelpEqGraphCard size={GRAPH} isIdle={false}>
          <SceneReel />
        </HelpEqGraphCard>
      </div>
    </FluidEqProviderWrapper>
  );
}

/** The frequency ranges, written as `GraphScaleChoices` writes them. */
const shortHz = format('~s');
const FREQUENCY_SPANS = GRAPH_FREQUENCY_RANGES.map((range) => {
  const [low, high] = GRAPH_FREQUENCY_SPANS[range];
  return `${shortHz(low)}–${shortHz(high)}`;
});

/** A row of choices, as `GraphScaleChoices` writes one. */
const ChoiceRow = ({
  icon,
  name,
  choices,
  chosen,
}: {
  icon: ReactNode;
  name: string;
  choices: readonly string[];
  chosen: number;
}) => (
  <div className="graph-view-menu__slider graph-view-menu__slider--switch">
    <svg className="graph-view-menu__icon" viewBox="0 0 16 16" aria-hidden>
      {icon}
    </svg>
    <span>{name}</span>
    <span className="segmented graph-view-menu__choice" role="radiogroup">
      {choices.map((choice, at) => (
        <button
          key={choice}
          type="button"
          role="radio"
          aria-checked={at === chosen}
          className={`segmented__option${at === chosen ? ' is-selected' : ''}`}
        >
          {choice}
        </button>
      ))}
    </span>
  </div>
);

/** The View menu, open, as `GraphViewMenu` lays it out on a standard style. */
const ViewMenuList = () => {
  const { t } = useTranslation();
  return (
    <div
      className="graph-view-menu__list is-left"
      role="menu"
      style={{ position: 'static' }}
    >
      <Group title={t(OWN_GROUP_TITLE.graph)} isOpen isFirst onToggle={nothing}>
        <button type="button" role="menuitemradio" aria-checked={false}>
          <Icon>
            <path d="M2.5 6V2.5H6M10 2.5h3.5V6M13.5 10v3.5H10M6 13.5H2.5V10" />
          </Icon>
          <span>{t('graph.view.fullscreen')}</span>
          <kbd>Ctrl+F</kbd>
        </button>
      </Group>
      <Group title={t(SETTINGS_GROUP_TITLE.picture)} isOpen onToggle={nothing}>
        {(['graph.curve.eq', 'graph.curve.total'] as const).map((curve) => (
          <ViewMenuSwitch
            key={curve}
            icon={<path d="M1.5 11c2.2 0 3-6 5.2-6s3 6 5.2 6 2.6-3 2.6-3" />}
            name={t(curve)}
            isOn
            onToggle={nothing}
          />
        ))}
        <ViewMenuSwitch
          icon={<path d="M2 2.5h12v7H9l-3 3v-3H2zM5 5h6M5 7h4" />}
          name={t('graph.switch.eqLabels')}
          isOn={false}
          onToggle={nothing}
        />
        <ViewMenuSwitch
          icon={<path d="M2.5 4h2M2.5 8h2M2.5 12h2M7 4h6.5M7 8h6.5M7 12h6.5" />}
          name={t('graph.switch.legend')}
          isOn
          onToggle={nothing}
        />
        <ViewMenuSwitch
          icon={
            <path d="M1.5 8c1.6 0 1.6-4 3.2-4s1.6 8 3.2 8 1.6-8 3.2-8 1.6 4 3.2 4" />
          }
          name={t('graph.switch.wave')}
          isOn
          onToggle={nothing}
        />
        <ViewMenuSwitch
          icon={
            <path d="M2.5 2.5h11v11h-11zM2.5 6.2h11M2.5 9.8h11M6.2 2.5v11M9.8 2.5v11" />
          }
          name={t('graph.switch.grid')}
          isOn
          onToggle={nothing}
        />
        <ChoiceRow
          icon={
            <path d="M1.5 13.5h13M3 13.5v-3M6 13.5V8M10 13.5V5M13 13.5V2.5" />
          }
          name={t('graph.frequencyRange')}
          choices={FREQUENCY_SPANS}
          chosen={GRAPH_FREQUENCY_RANGES.indexOf(DEFAULT_GRAPH_FREQUENCY_RANGE)}
        />
        <ChoiceRow
          icon={<path d="M1.5 12.5l13-6M1.5 13.5h13" />}
          name={t('graph.analyserSlope')}
          choices={GRAPH_TILTS.map((tilt) =>
            tilt === 0 ? t('look.off') : String(tilt),
          )}
          chosen={GRAPH_TILTS.indexOf(DEFAULT_GRAPH_TILT)}
        />
        <ViewMenuSwitch
          icon={<path d="M6 13.5V2.5h4v11zM6 8.5h4" />}
          name={t('graph.switch.meter')}
          isOn
          onToggle={nothing}
        />
        <button type="button" role="menuitem">
          <Icon>
            <path d="M2 8h12M5 5l-3 3 3 3M11 5l3 3-3 3" />
          </Icon>
          <span>{t('graph.orientation.down')}</span>
          <kbd>Ctrl+I</kbd>
        </button>
      </Group>
      <Group
        title={t(SETTINGS_GROUP_TITLE.visualizer)}
        isOpen
        onToggle={nothing}
      >
        <button type="button" role="menuitem">
          <Icon>
            <path d="M6 3.5l4 4.5-4 4.5" />
          </Icon>
          <span>{t('graph.style.next')}</span>
          <kbd>Space</kbd>
        </button>
        <button type="button" role="menuitem">
          <Icon>
            <path d="M10 3.5l-4 4.5 4 4.5" />
          </Icon>
          <span>{t('graph.style.previous')}</span>
          <kbd>Ctrl+Space</kbd>
        </button>
      </Group>
      <Group
        title={`${t(SETTINGS_GROUP_TITLE.drawing)} · ${t('graph.family.scenes')}`}
        isOpen={false}
        onToggle={nothing}
      >
        {null}
      </Group>
    </div>
  );
};

/** The View menu open from the graph's corner. */
export function GraphViewMenuDrawing() {
  return (
    <div
      className="graph-view-menu"
      style={{ position: 'relative', width: 380 }}
    >
      <ViewMenuList />
    </div>
  );
}
