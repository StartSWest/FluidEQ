/* FluidEQ — GPL-3.0-or-later */
import { screen } from 'electron';
import { isUsableRect, type IRect } from '../../common/windowMode';

/** Keep an integer-DIP conversion error from becoming the next saved size. */
const linuxPlayerBounds = (
  actual: IRect,
  remembered: Partial<IRect> | undefined,
): IRect => {
  if (!isUsableRect(remembered)) {
    return actual;
  }
  const scale = screen.getDisplayMatching(actual).scaleFactor;
  if (!Number.isFinite(scale) || scale <= 0 || Number.isInteger(scale)) {
    return actual;
  }
  // At 125%, restoring a 901-DIP height reports 902 after frame/pixel
  // conversion. Saving that answer grew the amp by one DIP on every switch.
  // A real size change replaces the record; a rounding-only change keeps it.
  return {
    ...actual,
    width:
      Math.abs(actual.width - remembered.width) <= 1
        ? remembered.width
        : actual.width,
    height:
      Math.abs(actual.height - remembered.height) <= 1
        ? remembered.height
        : actual.height,
  };
};

export default linuxPlayerBounds;
