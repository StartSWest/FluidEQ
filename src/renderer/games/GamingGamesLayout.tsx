/* FluidEQ — GPL-3.0-or-later */

import { CSSProperties, ReactNode, useId } from 'react';
import ColumnResizer from '../components/ColumnResizer';
import PaneResizer from '../components/PaneResizer';
import MenuIcon from '../icons/MenuIcon';
import { useTranslation } from '../utils/I18nContext';
import useGamingGamesLayout from './useGamingGamesLayout';
import '../styles/GamingGamesLayout.scss';

/** Also drawn in Help, without reading or changing the listener's layout. */
export const GamingGamesListToggle = ({
  count,
  collapsed,
  controls,
  onToggle,
}: {
  count: number;
  collapsed: boolean;
  controls: string;
  onToggle: () => void;
}) => {
  const { t } = useTranslation();
  const label = t(collapsed ? 'gaming.list.show' : 'gaming.list.hide');
  const heading = t('gaming.list.count', { count });
  return (
    <div className="gaming-games__list-head">
      <span className="gaming-cap" title={heading}>
        {heading}
      </span>
      <button
        type="button"
        className="button small subtle gaming-games__list-toggle"
        aria-label={label}
        title={label}
        aria-expanded={!collapsed}
        aria-controls={controls}
        onClick={onToggle}
      >
        <MenuIcon name="pin" />
      </button>
    </div>
  );
};

/** Same keyboard and captured-pointer dividers as Library and Karaoke. */
export default function GamingGamesLayout({
  count,
  isOn,
  list,
  children,
}: {
  count: number;
  isOn: boolean;
  list: ReactNode;
  children: ReactNode;
}) {
  const { t } = useTranslation();
  const layout = useGamingGamesLayout();
  const listId = useId();
  return (
    <div
      ref={layout.host}
      className={`gaming-games gaming-games--split${isOn ? '' : ' is-off'}${layout.stacked ? ' is-stacked' : ''}${layout.collapsed ? ' is-list-collapsed' : ''}`}
      style={
        {
          '--gaming-list-width': `${layout.width}px`,
          '--gaming-list-height': `${layout.height}px`,
        } as CSSProperties
      }
    >
      <GamingGamesListToggle
        count={count}
        collapsed={layout.collapsed}
        controls={listId}
        onToggle={layout.toggle}
      />
      <aside
        className="gaming-games__sidebar"
        inert={layout.collapsed}
        aria-hidden={layout.collapsed}
      >
        <div id={listId} className="gaming-games__list">
          {list}
        </div>
      </aside>
      <div
        className="gaming-games__divider"
        inert={layout.collapsed}
        aria-hidden={layout.collapsed}
      >
        {layout.stacked ? (
          <PaneResizer
            ariaLabel={t('gaming.list.resize')}
            valuePercent={layout.valuePercent}
            onStart={layout.start}
            onDrag={layout.resize}
            onEnd={layout.commit}
          />
        ) : (
          <ColumnResizer
            ariaLabel={t('gaming.list.resize')}
            valuePercent={layout.valuePercent}
            onStart={layout.start}
            onDrag={layout.resize}
            onEnd={layout.commit}
            onReset={layout.reset}
          />
        )}
      </div>
      <div className="gaming-games__detail">{children}</div>
    </div>
  );
}
