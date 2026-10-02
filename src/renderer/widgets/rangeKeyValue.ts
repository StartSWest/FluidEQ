/** Keyboard steps use the setting's units, independent of a dial's sweep. */
const rangeKeyValue = (
  key: string,
  value: number,
  step: number,
  min: number,
  max: number,
): number | undefined => {
  switch (key) {
    case 'ArrowUp':
    case 'ArrowRight':
      return value + step;
    case 'ArrowDown':
    case 'ArrowLeft':
      return value - step;
    case 'PageUp':
      return value + step * 10;
    case 'PageDown':
      return value - step * 10;
    case 'Home':
      return min;
    case 'End':
      return max;
    default:
      return undefined;
  }
};

export default rangeKeyValue;
