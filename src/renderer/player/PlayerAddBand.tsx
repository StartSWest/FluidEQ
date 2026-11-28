/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

import { MAX_NUM_FILTERS } from 'common/constants';
import { ErrorDescription } from 'common/errors';
import freeBandFrequency from '../eq/freeBandFrequency';
import MenuIcon from '../icons/MenuIcon';
import { addEqualizerSlider } from '../utils/equalizerApi';
import { FilterActionEnum, useFluidEqContext } from '../utils/FluidEqContext';
import { useTranslation } from '../utils/I18nContext';
import Button from '../widgets/Button';

/**
 * The EQ page's Add, in the amp's bottom row: a band at 1 kHz or the nearest
 * free hertz to it, where the page puts one with nothing selected. The amp
 * selects no band, so the page's other way — beside the selected one — has
 * nothing to stand beside here.
 */
const PlayerAddBand = () => {
  const { t } = useTranslation();
  const { filters, dispatchFilter, setGlobalError } = useFluidEqContext();
  const bands = Object.values(filters);
  const add = async () => {
    const frequency = freeBandFrequency(
      new Set(bands.map((band) => band.frequency)),
    );
    if (frequency === undefined) {
      return;
    }
    try {
      const id = await addEqualizerSlider(frequency);
      dispatchFilter({ type: FilterActionEnum.ADD, id, frequency });
    } catch (e) {
      setGlobalError(e as ErrorDescription);
    }
  };
  return (
    <Button
      ariaLabel={t('eq.addBandAria')}
      title={t('eq.addBandAria')}
      isDisabled={bands.length >= MAX_NUM_FILTERS}
      className="small subtle eq-toolbar__add"
      handleChange={() => {
        add().catch(() => undefined);
      }}
    >
      <MenuIcon name="plus" className="eq-toolbar__icon" />
      <span className="eq-toolbar__word">{t('eq.tools.add')}</span>
    </Button>
  );
};

export default PlayerAddBand;
