/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>

This program is free software: you can redistribute it and/or modify
it under the terms of the GNU General Public License version 3 or later.
*/

import OpraLibraryStatus from './components/OpraLibraryStatus';
import OpraPicker from './OpraPicker';
import SquiglinkImport from './SquiglinkImport';
import { useTranslation } from './utils/I18nContext';
import './styles/AutoEQPanel.scss';

/**
 * The page the reference picker lives on.
 *
 * It is a page rather than a component with a heading because the picker had
 * been a strip across the top of the EQ tab, where it was combo boxes and
 * a button with no room to say what any of them were for — and every band below
 * it paid for the height.
 *
 * The two sections are the two ways a curve gets here: OPRA's bundled library
 * above, and a Squiglink export somebody pasted in below. Each card is now
 * controls on the left and the curve they produce on the right, and each
 * control carries its own sentence of help underneath it. A separate row of
 * hints between the two cards used to do that job, and it did it badly: it
 * repeated both field labels word for word, and its 1-2 sat directly above
 * Squiglink's 1-2-3 as though the page were one five-step recipe.
 */
const EqPresetsPanel = () => {
  const { t } = useTranslation();

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

      <div className="autoeq-panel__picker">
        <OpraPicker />
      </div>

      <SquiglinkImport />
    </section>
  );
};

export default EqPresetsPanel;
