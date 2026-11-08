import { useId, type CSSProperties, type ReactNode } from 'react';
import type { TranslationKey } from 'common/i18n';
import {
  resolveParamName,
  type IScenePackColour,
  type IScenePackPalette,
  type IScenePackParam,
} from 'common/scenePacks';
import type { IScenePaletteValue } from 'common/scenePalette';
import { RESPONSE_KEYS, type ISceneResponse } from 'common/sceneResponse';
import { isShownBy } from 'common/sceneShowWhen';
import sceneSliderParams from '../graph/sceneSliders';
import { useTranslation } from '../utils/I18nContext';
import {
  RESPONSE_SLIDER_STEPS as STEPS,
  responseFromPosition as fromPosition,
  responseToPosition as toPosition,
} from '../utils/responseSlider';
import { isAmbientMode, useWindowTintMode } from '../utils/sceneTintStore';
import StudioAmbientIcon from './StudioAmbientIcon';
import StudioPalette from './StudioPalette';
import StudioColour from './StudioColour';
import SceneChoice from '../graph/SceneChoice';
import type { IStudioAmbientTuning } from './useStudioAmbientTuning';
import { SAVED_KEYS, type TTuningSaved } from './useStudioTuning';
import '../styles/StudioControls.scss';

const RESPONSE_TEXT: Record<
  keyof ISceneResponse,
  { label: TranslationKey; hint: TranslationKey }
> = {
  sensitivity: {
    label: 'studio.settings.sensitivity',
    hint: 'studio.settings.sensitivityHint',
  },
  threshold: {
    label: 'studio.settings.threshold',
    hint: 'studio.settings.thresholdHint',
  },
  attack: {
    label: 'studio.settings.attack',
    hint: 'studio.settings.attackHint',
  },
  release: {
    label: 'studio.settings.release',
    hint: 'studio.settings.releaseHint',
  },
};

interface ISliderProps {
  label: string;
  hint?: string;
  value: string;
  /** 0..1 along the track. */
  position: number;
  disabled: boolean;
  onPosition: (position: number) => void;
  /** Letting go; absent for a setting that is only tried, never saved. */
  onCommit?: () => void;
  /**
   * Where the thumb falls into, 0..1 along the track, marked on it as the
   * graph's View menu marks the same quarters (`percentSnaps.ts`).
   */
  snaps?: readonly number[];
  /** What the setting moves, drawn beside its name and its slider. */
  icon?: ReactNode;
}

/**
 * One setting: its name and value on a line, the slider under them. Moving
 * it moves the stage; letting go — the pointer, or the key that moved it —
 * saves, for the settings that are saved into the scene.
 */
export function Setting({
  label,
  hint,
  value,
  position,
  disabled,
  onPosition,
  onCommit,
  snaps,
  icon,
}: ISliderProps) {
  const id = useId();
  return (
    <div
      className={`studio-setting${icon ? ' studio-setting--icon' : ''}`}
      title={hint}
    >
      {icon}
      <label className="studio-setting__head" htmlFor={id}>
        <span className="studio-setting__label">{label}</span>
        {/* Out of the name and left to `aria-valuetext`: a reading inside
            the label makes the slider's accessible name "Glow 0.50", which
            is read out again the moment the value changes, and changes the
            control's own name every time it is dragged. */}
        <span className="studio-setting__value" aria-hidden="true">
          {value}
        </span>
      </label>
      <span className="studio-setting__track">
        {/* Under the input, so a thumb resting on its quarter covers the
            mark it fell into rather than wearing it. */}
        {snaps?.map((snap) => (
          <i
            key={snap}
            className="studio-setting__snap"
            style={{ '--snap-frac': snap } as CSSProperties}
            aria-hidden
          />
        ))}
        <input
          id={id}
          type="range"
          className="studio-slider"
          min={0}
          max={STEPS}
          step={1}
          value={Math.round(position * STEPS)}
          aria-label={label}
          aria-valuetext={value}
          disabled={disabled}
          style={{ '--fill': `${position * 100}%` } as CSSProperties}
          onChange={(event) => onPosition(Number(event.target.value) / STEPS)}
          onPointerUp={onCommit}
          onKeyUp={onCommit}
          onBlur={onCommit}
        />
      </span>
    </div>
  );
}

function Group({
  title,
  lead,
  canReset,
  resetsTo,
  onReset,
  children,
}: {
  title: string;
  lead: string;
  canReset: boolean;
  /** Where Reset puts these, said on the button so it is read before it is pressed. */
  resetsTo: string;
  onReset: () => void;
  children: ReactNode;
}) {
  const { t } = useTranslation();
  return (
    <section className="studio-settings__group">
      <div className="studio-settings__group-head">
        <span className="studio-settings__group-title">{title}</span>
        <button
          type="button"
          className="studio-settings__reset"
          title={resetsTo}
          disabled={!canReset}
          onClick={onReset}
        >
          {t('studio.settings.reset')}
        </button>
      </div>
      <span className="studio-settings__lead">{lead}</span>
      {children}
    </section>
  );
}

/**
 * A control's value as its range reads best: two significant decimals of
 * its span, so 0..1 reads 0.25, 0..100 reads 25 and 0..0.01 reads 0.0025
 * instead of a slider that says 0.00 the whole way along.
 */
const formatParam = (param: IScenePackParam, value: number) => {
  const span = param.max - param.min;
  const digits = Math.min(6, Math.max(0, 2 - Math.floor(Math.log10(span))));
  return value.toFixed(digits);
};

interface IStudioSettingsProps {
  params: readonly IScenePackParam[];
  values: Readonly<Record<string, number>>;
  response: ISceneResponse;
  saved: TTuningSaved;
  /** Nothing is on the stage: the settings wait, unlit, where they will be. */
  idle: boolean;
  canResetParams: boolean;
  canResetResponse: boolean;
  /**
   * The published version Reset goes back to, when the scene has one. Absent
   * means Reset goes back to the scene's own settings instead.
   */
  publishedVersion?: number;
  onParam: (id: string, value: number) => void;
  /** A choice picked: on the stage and saved in one go. */
  onChoose: (id: string, value: number) => void;
  onResponse: (key: keyof ISceneResponse, value: number) => void;
  onCommit: () => void;
  onResetParams: () => void;
  onResetResponse: () => void;
  /**
   * The scene's ambient controls (`useStudioAmbientTuning.ts`), when it has
   * any: its elements in the window, shown in the Ambient mode.
   */
  ambient?: IStudioAmbientTuning;
  /** Its palettes (contract 9), and their colours as the member has them. */
  palettes?: IStudioPalettes;
  /** Its single colours (contract 9), and their values as the member has them. */
  colours?: IStudioColours;
}

/** A scene's single colours in the column (`useStudioTuning.ts`). */
export interface IStudioColours {
  params: readonly IScenePackColour[];
  values: Readonly<Record<string, string>>;
  canReset: (id: string) => boolean;
  onChange: (id: string, value: string) => void;
  onCommit: (id: string, value: string) => void;
  onReset: (id: string) => void;
}

/** A scene's palettes in the column (`useStudioTuning.ts`). */
export interface IStudioPalettes {
  params: readonly IScenePackPalette[];
  values: Readonly<Record<string, IScenePaletteValue>>;
  canReset: (id: string) => boolean;
  onChange: (id: string, value: IScenePaletteValue) => void;
  onCommit: (id: string, value: IScenePaletteValue) => void;
  onReset: (id: string) => void;
}

/**
 * The scene's settings, in the Studio's column beside the stage: its own
 * controls — the sliders its `pack.json` declares, named as it names them —
 * and how it answers the music: sensitivity, threshold, attack and release
 * (see `sceneResponse.ts`). Both move the stage as they are dragged and are
 * saved into the scene when let go, so the look and anything published carry
 * what the member settled on.
 */
export default function StudioSettings({
  params,
  values,
  response,
  saved,
  idle,
  canResetParams,
  canResetResponse,
  publishedVersion,
  onParam,
  onChoose,
  onResponse,
  onCommit,
  onResetParams,
  onResetResponse,
  ambient,
  palettes,
  colours,
}: IStudioSettingsProps) {
  const { t, locale } = useTranslation();
  // A control whose `showWhen` its choices do not meet is put away, not
  // switched off: it keeps its value and still reaches the shader
  // (`sceneShowWhen.ts`).
  const choiceIds = new Set(
    params.filter((param) => param.options).map((param) => param.id),
  );
  const shown = (control: { showWhen?: IScenePackParam['showWhen'] }) =>
    isShownBy(control.showWhen, values, choiceIds);
  const controls = sceneSliderParams(params).filter(shown);
  const shownPalettes = (palettes?.params ?? []).filter(shown);
  const shownColours = (colours?.params ?? []).filter(shown);
  // Whether what the ambient sliders set is drawn at all: the scene puts its
  // elements around the app only while the window's look is on Ambient.
  const ambientShows = isAmbientMode(useWindowTintMode());
  const resetsTo =
    publishedVersion === undefined
      ? t('studio.settings.resetsToScene')
      : t('studio.settings.resetsToPublished', { version: publishedVersion });

  const responseValue = (key: keyof ISceneResponse) => {
    const value = response[key];
    if (key === 'sensitivity' || key === 'threshold') {
      return t('studio.settings.percent', { percent: Math.round(value * 100) });
    }
    return t('studio.settings.ms', { ms: Math.round(value) });
  };

  return (
    // A section of the card that tries the scene, not a card of its own: the
    // graph's menu and this column show the same settings in the same order
    // under the same headings (`common/settingsGroups.ts`), and the scene's
    // own controls come between the picture and how it is drawn.
    <section
      className={`studio-settings${idle ? ' is-idle' : ''}`}
      aria-label={t('studio.settings.title')}
    >
      <div className="studio-settings__groups">
        {controls.length > 0 && (
          <Group
            title={t('studio.settings.controls')}
            lead={t('studio.settings.controlsLead')}
            canReset={canResetParams && !idle}
            resetsTo={resetsTo}
            onReset={onResetParams}
          >
            {controls.map((param) => {
              const value = values[param.id] ?? param.value;
              // A choice picks and saves at once: a press is a let-go.
              if (param.options) {
                return (
                  <SceneChoice
                    key={param.id}
                    label={resolveParamName(param, locale)}
                    options={param.options.map((option) => ({
                      name: resolveParamName(option, locale),
                      ...(option.icon ? { icon: option.icon } : {}),
                      ...(option.swatch ? { swatch: option.swatch } : {}),
                    }))}
                    value={Math.round(value)}
                    disabled={idle}
                    onPick={(index) => onChoose(param.id, index)}
                  />
                );
              }
              const span = param.max - param.min;
              return (
                <Setting
                  key={param.id}
                  label={resolveParamName(param, locale)}
                  value={formatParam(param, value)}
                  position={Math.min(
                    1,
                    Math.max(0, (value - param.min) / span),
                  )}
                  disabled={idle}
                  onPosition={(position) =>
                    onParam(param.id, param.min + position * span)
                  }
                  onCommit={onCommit}
                />
              );
            })}
          </Group>
        )}

        {/* The scene's colours, apart from its sliders: each palette resets
            on its own, beside its name, so there is no group-wide Reset. */}
        {(shownPalettes.length > 0 || shownColours.length > 0) && (
          <section className="studio-settings__group">
            <div className="studio-settings__group-head">
              <span className="studio-settings__group-title">
                {t('studioPalette.group')}
              </span>
            </div>
            <span className="studio-settings__lead">
              {t('studioPalette.lead')}
            </span>
            {colours &&
              shownColours.map((colour) => (
                <StudioColour
                  key={colour.id}
                  label={resolveParamName(colour, locale)}
                  value={colours.values[colour.id] ?? colour.value}
                  disabled={idle}
                  canReset={colours.canReset(colour.id)}
                  resetsTo={resetsTo}
                  onChange={(value) => colours.onChange(colour.id, value)}
                  onCommit={(value) => colours.onCommit(colour.id, value)}
                  onReset={() => colours.onReset(colour.id)}
                />
              ))}
            {palettes &&
              shownPalettes.map((palette) => (
                <StudioPalette
                  key={palette.id}
                  label={resolveParamName(palette, locale)}
                  value={palettes.values[palette.id] ?? palette}
                  disabled={idle}
                  canReset={palettes.canReset(palette.id)}
                  resetsTo={resetsTo}
                  onChange={(value) => palettes.onChange(palette.id, value)}
                  onCommit={(value) => palettes.onCommit(palette.id, value)}
                  onReset={() => palettes.onReset(palette.id)}
                />
              ))}
            {/* Said once, under every palette: how a strip is used is the
                same on each, and under each it was the same line twice. */}
            {shownPalettes.length > 0 && (
              <span className="studio-settings__lead">
                {t('studioPalette.hint')}
              </span>
            )}
            {/* Which of a scene's palettes the window's own colours follow
                (`sceneAppColours.ts`): with two, the author has to know it
                is the first. */}
            {shownPalettes.length > 0 && (
              <span className="studio-settings__lead">
                {t('studioPalette.appColours')}
              </span>
            )}
          </section>
        )}

        <Group
          title={t('studio.settings.response')}
          lead={t('studio.settings.responseLead')}
          canReset={canResetResponse && !idle}
          resetsTo={resetsTo}
          onReset={onResetResponse}
        >
          {RESPONSE_KEYS.map((key) => (
            <Setting
              key={key}
              label={t(RESPONSE_TEXT[key].label)}
              hint={t(RESPONSE_TEXT[key].hint)}
              value={responseValue(key)}
              position={toPosition(key, response[key])}
              disabled={idle}
              onPosition={(position) =>
                onResponse(key, fromPosition(key, position))
              }
              onCommit={onCommit}
            />
          ))}
        </Group>

        {/* These reach the scene, and the scene draws nothing with them
            unless the window's look is Ambient or the Backdrop - the app's
            one mode, which somebody may have set to less. A member could
            drag every one of them, read "Saved into the scene" and see
            nothing move. They rest until the mode that shows them is on,
            and the lead says which mode that is. */}
        {ambient && ambient.params.length > 0 && (
          <Group
            title={t('studio.settings.ambient')}
            lead={
              ambientShows
                ? t('studio.settings.ambientLead')
                : `${t('studio.settings.ambientLead')} ${t('studio.settings.ambientOff')}`
            }
            canReset={ambient.canReset && !idle}
            resetsTo={resetsTo}
            onReset={ambient.reset}
          >
            {ambient.params.map((param) => {
              const value = ambient.values[param.id] ?? param.value;
              return (
                <Setting
                  key={param.id}
                  label={param.names[locale] ?? param.names.en}
                  value={t('studio.settings.percent', {
                    percent: Math.round(value * 100),
                  })}
                  position={value}
                  disabled={idle || !ambientShows}
                  onPosition={(position) =>
                    ambient.setValue(param.id, position)
                  }
                  onCommit={ambient.commit}
                  icon={
                    <StudioAmbientIcon
                      param={param}
                      elements={ambient.elements}
                      pictures={ambient.pictures}
                      sky={ambient.sky}
                    />
                  }
                />
              );
            })}
          </Group>
        )}
      </div>

      <span
        className={`studio-settings__saved${saved === 'failed' ? ' is-failed' : ''}`}
        role="status"
      >
        {saved ? t(SAVED_KEYS[saved]) : t('studio.settings.carries')}
      </span>
      {/* Said once, under all three groups: the same Reset serves them all,
          and where it goes is the thing worth knowing before pressing it. */}
      <span className="studio-settings__resets">{resetsTo}</span>
    </section>
  );
}
