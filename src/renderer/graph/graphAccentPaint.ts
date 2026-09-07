import type { IPaintAccentArgs } from './graphAccents';

const circle = (
  context: CanvasRenderingContext2D,
  x: number,
  y: number,
  radius: number,
  aspect: number,
  paint: () => void,
) => {
  // The wave stretches positions, not the circular mark itself. Cancel its
  // unequal scale locally; keeping the correction through stroke also keeps
  // the ring's thickness even in mirrored half-height views.
  context.save();
  context.translate(x, y);
  context.scale(1, aspect);
  context.beginPath();
  context.arc(0, 0, Math.max(0.5, radius), 0, Math.PI * 2);
  paint();
  context.restore();
};

/** Only paint here: mirrored views must never advance a particle twice. */
const paintGraphAccent = (args: IPaintAccentArgs): boolean => {
  const {
    context,
    behaviour,
    peaks,
    heights,
    positions,
    baseline,
    top = 0,
    left,
    right,
    state,
    weight,
    filled = true,
    paint,
  } = args;
  const depth = Math.max(1, baseline - top);
  const rowOf = (fraction: number) => baseline - fraction * depth;
  context.save();
  context.lineCap = 'round';
  context.lineJoin = 'round';
  context.fillStyle = paint;
  context.strokeStyle = paint;
  const opacity = context.globalAlpha;
  const transform = context.getTransform();
  const aspect = transform.d === 0 ? 1 : Math.abs(transform.a / transform.d);
  context.lineWidth = Math.max(0.8, 1.2 * weight);
  const drawPath = () => {
    if (filled) {
      context.fill();
    } else {
      context.stroke();
    }
  };
  const drawRect = (x: number, y: number, width: number, height: number) => {
    if (filled) {
      context.fillRect(x, y, width, height);
    } else {
      context.strokeRect(x, y, width, height);
    }
  };

  switch (behaviour) {
    case 'blink': {
      peaks.forEach((peak) => {
        const strength = state.blinks.get(peak.x) ?? 0;
        if (strength <= 0) {
          return;
        }
        const size = Math.max(3, peak.size * weight);
        context.globalAlpha = opacity * strength;
        drawRect(
          peak.x - size / 2,
          peak.y - (size * aspect) / 2,
          size,
          size * aspect,
        );
      });
      break;
    }
    case 'live':
    case 'fall': {
      const live = behaviour === 'live';
      const step = positions.length > 1 ? (right - left) / positions.length : 0;
      const bar = Math.max(1, step * (live ? 0.68 : 0.72));
      for (let i = 0; i < positions.length; i += 1) {
        if (
          state.held[i] >= 0.01 &&
          (live || state.held[i] - heights[i] > 0.004)
        ) {
          const row = rowOf(state.held[i]);
          const thick = (live ? 1.5 : 2.4) * weight;
          context.globalAlpha = opacity * (live ? 0.88 : 0.22);
          if (!live) {
            drawRect(positions[i] - bar / 2, row - thick, bar, thick * 2);
          }
          context.globalAlpha = opacity;
          drawRect(positions[i] - bar / 2, row - thick / 2, bar, thick);
        }
      }
      break;
    }
    case 'bead': {
      peaks.forEach((peak) => {
        const size = Math.max(2, peak.size * weight);
        context.globalAlpha = opacity * 0.2;
        drawRect(
          peak.x - size * 0.75,
          peak.y - size * 0.75,
          size * 1.5,
          size * 1.5,
        );
        context.globalAlpha = opacity;
        drawRect(peak.x - size / 2, peak.y - size / 2, size, size);
        context.fillStyle = '#fff';
        context.globalAlpha = opacity * 0.75;
        drawRect(
          peak.x - size * 0.18,
          peak.y - size * 0.18,
          size * 0.36,
          size * 0.36,
        );
        context.fillStyle = paint;
      });
      break;
    }
    case 'ghost': {
      // The ghost occupies only the gap left by a falling spectrum, so it
      // cannot wash out the entire live figure underneath it.
      if (!positions.length) {
        break;
      }
      context.beginPath();
      context.moveTo(positions[0], rowOf(state.envelope[0]));
      for (let i = 1; i < positions.length; i += 1) {
        context.lineTo(positions[i], rowOf(state.envelope[i]));
      }
      context.globalAlpha = opacity * 0.55;
      context.lineWidth = 1.2 * weight;
      context.stroke();
      for (let i = positions.length - 1; i >= 0; i -= 1) {
        context.lineTo(positions[i], rowOf(heights[i]));
      }
      context.closePath();
      context.globalAlpha = opacity * Math.min(0.3, 0.14 * weight);
      if (filled) {
        context.fill();
      }
      break;
    }
    case 'ripple': {
      state.motes.forEach((mote) => {
        const age = 1 - mote.life;
        const growth = 1 - (1 - age) * (1 - age);
        const radius = Math.max(2, mote.size) * weight * (1 + growth * 4);
        context.lineWidth = Math.max(0.7, (1 - age * 0.55) * 1.5 * weight);
        context.globalAlpha = opacity * mote.life * mote.life * 0.85;
        circle(context, mote.x, mote.y, radius, aspect, () => {
          if (filled) {
            const ringOpacity = context.globalAlpha;
            context.globalAlpha *= 0.16;
            context.fill();
            context.globalAlpha = ringOpacity;
          }
          context.stroke();
        });
        context.globalAlpha *= 0.4;
        circle(context, mote.x, mote.y, radius * 0.65, aspect, () =>
          context.stroke(),
        );
      });
      break;
    }
    case 'sparks': {
      state.motes.forEach((mote) => {
        const size = Math.max(0.8, Math.min(3.5, mote.size * 0.65)) * weight;
        context.globalAlpha = opacity * mote.life;
        context.lineWidth = Math.max(0.7, size * 0.6);
        context.beginPath();
        context.moveTo(mote.x - mote.vx * 0.065, mote.y - mote.vy * 0.065);
        context.lineTo(mote.x, mote.y);
        context.stroke();
        circle(
          context,
          mote.x,
          mote.y,
          size * (0.45 + mote.life * 0.55),
          aspect,
          drawPath,
        );
      });
      break;
    }
    case 'beam': {
      // Six tapered bands reuse the selected paint; allocating a white
      // gradient per peak used to discard the look's colours on every frame.
      peaks.forEach((peak) => {
        const reach = Math.max(0, peak.y - top);
        const width = Math.max(2, peak.size * weight);
        for (let band = 0; band < 6; band += 1) {
          const from = band / 6;
          const to = (band + 1) / 6;
          const y1 = peak.y - reach * from;
          const y2 = peak.y - reach * to;
          const w1 = width * (0.3 + from);
          const w2 = width * (0.3 + to);
          context.globalAlpha = opacity * (1 - from) * (1 - from) * 0.22;
          context.beginPath();
          context.moveTo(peak.x - w1, y1);
          context.lineTo(peak.x - w2, y2);
          context.lineTo(peak.x + w2, y2);
          context.lineTo(peak.x + w1, y1);
          context.closePath();
          drawPath();
        }
        context.globalAlpha = opacity;
        circle(
          context,
          peak.x,
          peak.y,
          Math.max(1.2, width * 0.25),
          aspect,
          drawPath,
        );
      });
      break;
    }
    case 'ceiling': {
      const highest = Math.max(0, ...heights);
      if (highest > 0.01) {
        const row = rowOf(highest);
        context.globalAlpha = opacity * 0.16;
        drawRect(left, row - 3 * weight, right - left, 6 * weight);
        context.globalAlpha = opacity * 0.8;
        drawRect(left, row - 0.6 * weight, right - left, 1.2 * weight);
        context.globalAlpha = opacity;
        [left, right - 2 * weight].forEach((x) =>
          drawRect(x, row - 4 * weight, 2 * weight, 8 * weight),
        );
      }
      break;
    }
    case 'comet': {
      peaks.forEach((peak) => {
        const radius = Math.max(1.2, peak.size * 0.36 * weight);
        const tail =
          Math.min((right - left) * 0.08, Math.max(12, peak.size * 7)) * weight;
        for (let part = 0; part < 6; part += 1) {
          const from = part / 6;
          const to = (part + 1) / 6;
          context.globalAlpha = opacity * (1 - from) * (1 - from) * 0.8;
          context.lineWidth = Math.max(0.5, radius * (1 - from));
          context.beginPath();
          context.moveTo(
            peak.x - from * tail,
            peak.y + from * from * radius * 2,
          );
          context.lineTo(peak.x - to * tail, peak.y + to * to * radius * 2);
          context.stroke();
        }
        context.globalAlpha = opacity;
        circle(context, peak.x, peak.y, radius, aspect, drawPath);
      });
      break;
    }
    case 'drip': {
      state.motes.forEach((mote) => {
        const size = Math.max(1.2, mote.size * 0.75) * weight;
        context.globalAlpha = opacity * mote.life * 0.9;
        context.beginPath();
        context.moveTo(mote.x, mote.y - size * 2.6);
        context.quadraticCurveTo(
          mote.x + size * 1.7,
          mote.y + size,
          mote.x,
          mote.y + size,
        );
        context.quadraticCurveTo(
          mote.x - size * 1.7,
          mote.y + size,
          mote.x,
          mote.y - size * 2.6,
        );
        drawPath();
      });
      break;
    }
    default:
      break;
  }
  context.restore();
  return state.motes.length > 0;
};

export default paintGraphAccent;
