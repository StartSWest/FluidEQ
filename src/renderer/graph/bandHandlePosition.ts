/** Keep a band's largest halo inside the plot, including off-scale bands. */
export const handleXInPlot = (
  x: number,
  [start, end]: readonly number[],
): number => {
  const left = Math.min(start, end) + 12;
  const right = Math.max(start, end) - 12;
  return left < right ? Math.min(right, Math.max(left, x)) : x;
};

export default handleXInPlot;
