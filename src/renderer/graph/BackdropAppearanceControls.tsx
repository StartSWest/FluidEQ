/* FluidEQ — GPL-3.0-or-later */
import type { CSSProperties } from 'react';
import { useTranslation } from '../utils/I18nContext';
import { PERCENT_SNAPS, snapPercent } from '../utils/percentSnaps';
import { Icon } from './GraphViewMenuFrame';

/** The existing transparency and blur faders, shared by graph and scenery menus. */
export default function BackdropAppearanceControls({
  opacity,
  onChangeOpacity,
  blur,
  onChangeBlur,
  minOpacity,
  maxBlur,
  idPrefix = 'graph',
  transparencyHint,
}: {
  opacity: number;
  onChangeOpacity: (value: number) => void;
  blur: number;
  onChangeBlur: (value: number) => void;
  minOpacity: number;
  maxBlur: number;
  idPrefix?: string;
  transparencyHint?: string;
}) {
  const { t } = useTranslation();
  return (
    <>
      <label
        className="graph-view-menu__slider graph-view-menu__slider--overlay"
        htmlFor={`${idPrefix}-see-through`}
        title={transparencyHint ?? t('graph.seeThroughHint')}
      >
        <Icon>
          <path d="M8 3.5c3 0 5 2.3 5.5 4.5-.5 2.2-2.5 4.5-5.5 4.5S3 10.2 2.5 8C3 5.8 5 3.5 8 3.5z" />
          <path d="M8 6.2a1.8 1.8 0 100 3.6 1.8 1.8 0 100-3.6z" />
        </Icon>
        <span>{t('graph.seeThrough')}</span>
        <span className="graph-view-menu__track">
          {PERCENT_SNAPS.map((snap) => (
            <i
              key={snap}
              className="graph-view-menu__snap"
              style={{ '--snap-frac': snap / 100 } as CSSProperties}
              aria-hidden
            />
          ))}
          <input
            id={`${idPrefix}-see-through`}
            type="range"
            aria-label={t('graph.seeThrough')}
            min={minOpacity * 100}
            max={100}
            step={1}
            // Inverted, so right is more see-through. The stored value
            // is an opacity because that is what CSS wants; the slider
            // is a transparency because that is what the label says.
            value={Math.round((1 - opacity) * 100)}
            onChange={(event) =>
              onChangeOpacity(1 - snapPercent(Number(event.target.value)) / 100)
            }
          />
        </span>
        <span className="graph-view-menu__value" aria-hidden>
          {t('graph.scene.percent', {
            percent: String(Math.round((1 - opacity) * 100)),
          })}
        </span>
      </label>
      <label
        className="graph-view-menu__slider graph-view-menu__slider--overlay"
        htmlFor={`${idPrefix}-see-through-blur`}
        title={t('graph.blurHint')}
      >
        <Icon>
          <path d="M8 2.5C5.5 5.4 4 7.3 4 9a4 4 0 008 0c0-1.7-1.5-3.6-4-6.5z" />
        </Icon>
        <span>{t('graph.blur')}</span>
        <input
          id={`${idPrefix}-see-through-blur`}
          type="range"
          aria-label={t('graph.blur')}
          min={0}
          max={maxBlur}
          step={1}
          value={blur}
          onChange={(event) => onChangeBlur(Number(event.target.value))}
        />
        <span className="graph-view-menu__value" aria-hidden>
          {t('graph.scene.percent', {
            percent: String(Math.round((blur / maxBlur) * 100)),
          })}
        </span>
      </label>
    </>
  );
}
