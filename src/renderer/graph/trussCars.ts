import type { Projected } from 'common/graphStyles';

/** A fixed fleet wraps at the edge: continuous traffic without accumulating particles. */
const paintTrussCars = (
  context: CanvasRenderingContext2D,
  road: readonly Projected[],
  phase: number,
) => {
  if (road.length < 2) {
    return;
  }
  const transform = context.getTransform();
  if (!transform.d) {
    return;
  }
  const aspect = Math.abs(transform.a / transform.d);
  const left = road[0][0];
  const width = road[road.length - 1][0] - left;
  const size = Math.max(0.8, Math.min(1.7, width / 1000));
  ['#77efdb', '#f7cf76', '#ed93c7', '#9bbcff'].forEach((colour, index) => {
    const x = left + ((phase + index / 4) % 1) * width;
    let at = 1;
    while (at < road.length - 1 && road[at][0] < x) {
      at += 1;
    }
    const [ax, ay] = road[at - 1];
    const [bx, by] = road[at];
    const t = (x - ax) / Math.max(0.001, bx - ax);
    const y = ay + (by - ay) * t;
    context.save();
    context.translate(x, y);
    context.scale(size, size * aspect);
    context.rotate(Math.atan2((by - ay) / aspect, bx - ax));
    context.fillStyle = colour;
    context.fillRect(-9, -8, 18, 5);
    context.fillRect(-5, -12, 10, 5);
    context.fillStyle = '#10242c';
    context.fillRect(-3, -11, 6, 3);
    context.beginPath();
    context.arc(-5, -2.7, 2.7, 0, Math.PI * 2);
    context.moveTo(7.7, -2.7);
    context.arc(5, -2.7, 2.7, 0, Math.PI * 2);
    context.fill();
    context.restore();
  });
};

export default paintTrussCars;
