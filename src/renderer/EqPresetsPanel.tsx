/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>

This program is free software: you can redistribute it and/or modify
it under the terms of the GNU General Public License version 3 or later.
*/

import { useState, type ReactNode } from 'react';
import OpraLibraryStatus from './components/OpraLibraryStatus';
import OpraPicker from './OpraPicker';
import MyCurvesPanel from './eq/MyCurvesPanel';
import { useMyCurves } from './eq/myCurvesStore';
import { useTranslation } from './utils/I18nContext';
import './styles/AutoEQPanel.scss';

type TLibrary = 'opra' | 'mine';

const LibraryTab = ({
  id,
  library,
  onPick,
  children,
}: {
  id: TLibrary;
  library: TLibrary;
  onPick: (id: TLibrary) => void;
  children: ReactNode;
}) => (
  <button
    type="button"
    role="tab"
    id={`autoeq-tab-${id}`}
    aria-selected={library === id}
    aria-controls="autoeq-library"
    className="autoeq-panel__tab"
    onClick={() => onPick(id)}
  >
    {children}
  </button>
);

/**
 * The page the reference picker lives on.
 *
 * It is a page rather than a component with a heading because the picker had
 * been a strip across the top of the EQ tab, where it was combo boxes and
 * a button with no room to say what any of them were for — and every band below
 * it paid for the height.
 *
 * Squiglink is a source for My curves, rather than a second library holding
 * the same imports (Ivan, 2026-10-25, approved Unified library mockup). Its
 * shortcut stays above the saved list so a growing list cannot bury it.
 */
const EqPresetsPanel = () => {
  const { t } = useTranslation();
  const [library, setLibrary] = useState<TLibrary>('opra');
  const myCurves = useMyCurves();

  return (
    <section className="autoeq-panel" aria-labelledby="autoeq-panel-title">
      <div className="autoeq-panel__intro">
        <div>
          <p className="eyebrow">{t('autoeq.page.eyebrow')}</p>
          <h2 id="autoeq-panel-title">{t('autoeq.page.title')}</h2>
          <p>{t('autoeq.page.intro')}</p>
        </div>
        <OpraLibraryStatus />
      </div>

      <div className="autoeq-panel__libraries" role="tablist">
        <LibraryTab id="opra" library={library} onPick={setLibrary}>
          {t('myCurves.tab.opra')}
        </LibraryTab>
        <LibraryTab id="mine" library={library} onPick={setLibrary}>
          {t('myCurves.tab.mine')}
          <span className="autoeq-panel__tab-count">{myCurves.length}</span>
        </LibraryTab>
      </div>

      <div
        id="autoeq-library"
        role="tabpanel"
        aria-labelledby={`autoeq-tab-${library}`}
        className="autoeq-panel__picker"
      >
        {library === 'opra' && <OpraPicker />}
        {library === 'mine' && <MyCurvesPanel />}
      </div>
    </section>
  );
};

export default EqPresetsPanel;
