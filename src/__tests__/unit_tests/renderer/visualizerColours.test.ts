import { createFluidBarPaint, heatColour } from 'renderer/graph/lookColours';
import {
  resolveFigureStroke,
  resolveTracePaint,
} from 'renderer/graph/liveTracePaint';
import { GRAPH_PALETTES } from 'common/graphStyles';

const plot = { left: 40, right: 640, top: 20, bottom: 300 };
const capture = () => {
  const stops: { at: number; colour: string }[] = [];
  const gradient = {
    addColorStop: (at: number, colour: string) => stops.push({ at, colour }),
  } as CanvasGradient;
  const context = {
    createLinearGradient: () => gradient,
  } as unknown as CanvasRenderingContext2D;
  return { context, stops };
};

it('Heat interpolates chosen colours instead of switching abruptly between swatches', () => {
  expect(heatColour(['#000', '#fff'], 0.5)).toBe('rgb(128, 128, 128)');
  expect(heatColour(['#000', '#fff'], 0)).toBe('rgb(0, 0, 0)');
  expect(heatColour(['#000', '#fff'], 1)).toBe('rgb(255, 255, 255)');
  expect(
    resolveTracePaint('heat', ['#000', '#fff'], '#ff0000', plot, 0.5),
  ).toBe('rgb(128, 128, 128)');
});

it.each(GRAPH_PALETTES)(
  'Fluid honours custom %s colours and preserves the fade',
  (palette) => {
    const { context, stops } = capture();
    const paint = createFluidBarPaint(
      context,
      palette,
      ['#123456'],
      plot.top,
      plot.bottom,
    );
    paint(0.8, 0.7, 100, 200, 0.8);
    expect(stops[0].colour).toBe('rgba(18, 52, 86, 0.8)');
    expect(stops[stops.length - 1].colour).toMatch(/^rgba\(18, 52, 86, 0\.0*6/);
  },
);

it('Flat stays the same colour across the figure and Frequency changes across it', () => {
  const { context, stops } = capture();
  const flat = createFluidBarPaint(
    context,
    'signal',
    [],
    plot.top,
    plot.bottom,
  );
  flat(0, 0.2, 100, 200, 0.8);
  const first = stops[0].colour;
  stops.length = 0;
  flat(1, 0.9, 100, 200, 0.8);
  expect(stops[0].colour).toBe(first);
  const frequency = createFluidBarPaint(
    context,
    'rainbow',
    [],
    plot.top,
    plot.bottom,
  );
  stops.length = 0;
  frequency(0, 0.2, 100, 200, 0.8);
  const low = stops[0].colour;
  stops.length = 0;
  frequency(1, 0.2, 100, 200, 0.8);
  expect(stops[0].colour).not.toBe(low);
});

it('Level colour is pinned to the plot height rather than renormalized to each bar', () => {
  const { context, stops } = capture();
  const paint = createFluidBarPaint(
    context,
    'level',
    ['#000000', '#ffffff'],
    plot.top,
    plot.bottom,
  );
  paint(0.2, 0.1, 160, 140, 0.8);
  expect(stops[0].colour).toBe('rgba(128, 128, 128, 0.8)');
  stops.length = 0;
  paint(0.9, 0.9, 20, 280, 0.8);
  expect(stops[0].colour).toBe('rgba(255, 255, 255, 0.8)');
});

it('Rainbow border is absent when Rainbow is off and Stroked stays visible', () => {
  expect(
    resolveFigureStroke('#123456', true, true, true, { isOn: false, hue: 0 }),
  ).toBeUndefined();
  expect(
    resolveFigureStroke('#123456', false, false, true, { isOn: false, hue: 0 }),
  ).toBe('#123456');
  expect(
    resolveFigureStroke('#123456', true, true, true, { isOn: true, hue: 120 }),
  ).toBeDefined();
});
