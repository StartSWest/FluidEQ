/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>

This program is free software: you can redistribute it and/or modify
it under the terms of the GNU General Public License version 3 or later.
*/

import { useState } from 'react';
import OpraLibraryStatus from './components/OpraLibraryStatus';
import OpraPicker from './OpraPicker';
import SquiglinkImport from './SquiglinkImport';
import MyCurvesPanel from './eq/MyCurvesPanel';
import { useMyCurves } from './eq/myCurvesStore';
import { useTranslation } from './utils/I18nContext';
import './styles/AutoEQPanel.scss';

type TLibrary = 'opra' | 'mine';

/**
 * The page the reference picker lives on.
 *
 * It is a page rather than a component with a heading because the picker had
 * been a strip across the top of the EQ tab, where it was combo boxes and
 * a button with no room to say what any of them were for — and every band below
 * it paid for the height.
 *
 * The curves come from two libraries, one tab each: OPRA's, bundled, and the
 * listener's own (My curves, Ivan 2026-10-20). A Squiglink export somebody
 * pasted in sits below both, because it can go either way — played at once,
 * or kept in My curves. Each card is controls on the left and the curve they
 * produce on the right, and each control carries its own sentence of help
 * underneath it.
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
        <button
          type="button"
          role="tab"
          id="autoeq-tab-opra"
          aria-selected={library === 'opra'}
          aria-controls="autoeq-library"
          className="autoeq-panel__tab"
          onClick={() => setLibrary('opra')}
        >
          {t('myCurves.tab.opra')}
        </button>
        <button
          type="button"
          role="tab"
          id="autoeq-tab-mine"
          aria-selected={library === 'mine'}
          aria-controls="autoeq-library"
          className="autoeq-panel__tab"
          onClick={() => setLibrary('mine')}
        >
          {t('myCurves.tab.mine')}
          <span className="autoeq-panel__tab-count">{myCurves.length}</span>
        </button>
      </div>

      <div
        id="autoeq-library"
        role="tabpanel"
        aria-labelledby={
          library === 'opra' ? 'autoeq-tab-opra' : 'autoeq-tab-mine'
        }
        className="autoeq-panel__picker"
      >
        {library === 'opra' ? <OpraPicker /> : <MyCurvesPanel />}
      </div>

      <SquiglinkImport />
    </section>
  );
};

export default EqPresetsPanel;
