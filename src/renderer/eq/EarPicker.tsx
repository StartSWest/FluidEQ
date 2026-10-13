import type { TBandSide } from 'common/constants';
import { useFluidEqContext } from '../utils/FluidEqContext';
import { useTranslation } from '../utils/I18nContext';
import { SIDE_NAME_KEYS } from './earNames';
import '../styles/Dsp.scss';
import '../styles/EqChannels.scss';

const SIDES: readonly TBandSide[] = ['both', 'left', 'right'];

/**
 * Which ear the EQ page is editing, above the graph and only while the
 * output's channels are apart. Left draws the right ear's curve and bands
 * back and lands a new band on the left; Both edits as the page always did.
 */
const EarPicker = () => {
  const { t } = useTranslation();
  const { channelsApart, editingEar, setEditingEar } = useFluidEqContext();
  if (!channelsApart) {
    return null;
  }
  return (
    <div className="eq-ear-picker">
      <span className="eq-ear-picker__label" id="eq-ear-picker-label">
        {t('eq.channels.editing')}
      </span>
      <div
        className="segmented eq-ear-picker__track"
        role="radiogroup"
        aria-labelledby="eq-ear-picker-label"
      >
        {SIDES.map((side) => (
          <button
            type="button"
            role="radio"
            key={side}
            aria-checked={editingEar === side}
            className={`segmented__option eq-ear-picker__option eq-ear-picker__option--${side}${
              editingEar === side ? ' is-selected' : ''
            }`}
            onClick={() => setEditingEar(side)}
          >
            {side !== 'both' && (
              <span className="eq-ear-picker__swatch" aria-hidden="true" />
            )}
            {t(SIDE_NAME_KEYS[side])}
          </button>
        ))}
      </div>
    </div>
  );
};

export default EarPicker;
