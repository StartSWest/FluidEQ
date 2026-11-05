/* FluidEQ — GPL-3.0-or-later */

import { CSSProperties, ReactNode, useId } from 'react';
import ColumnResizer from '../components/ColumnResizer';
import PaneResizer from '../components/PaneResizer';
import Chevron from '../icons/Chevron';
import { useTranslation } from '../utils/I18nContext';
import useGamingGamesLayout from './useGamingGamesLayout';
import '../styles/GamingGamesLayout.scss';

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
  const toggleLabel = t(
    layout.collapsed ? 'gaming.list.show' : 'gaming.list.hide',
  );
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
      <aside className="gaming-games__sidebar">
        <button
          type="button"
          className="button small subtle gaming-games__list-toggle"
          aria-label={toggleLabel}
          title={toggleLabel}
          aria-expanded={!layout.collapsed}
          aria-controls={listId}
          onClick={layout.toggle}
        >
          <span>{t('gaming.list.count', { count })}</span>
          <Chevron />
        </button>
        <div
          id={listId}
          className="gaming-games__list"
          hidden={layout.collapsed}
        >
          {list}
        </div>
      </aside>
      {!layout.collapsed &&
        (layout.stacked ? (
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
        ))}
      {children}
    </div>
  );
}
