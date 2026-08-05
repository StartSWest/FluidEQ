import { createMirrorEqChain } from '../../../renderer/audio/mirrorEq';
import { FilterTypeEnum, IFilter } from '../../../common/constants';
import {
  getTFCoefficients,
  RESPONSE_SAMPLE_FREQUENCY,
} from '../../../common/response';

const makeFilter = (overrides: Partial<IFilter> = {}): IFilter =>
  ({
    id: 'band',
    frequency: 1000,
    gain: 6,
    quality: 1,
    type: FilterTypeEnum.PK,
    ...overrides,
  }) as IFilter;

const createFakeContext = (sampleRate: number) => {
  const iirCalls: { feedforward: number[]; feedback: number[] }[] = [];
  const disconnects: jest.Mock[] = [];
  const makeNode = () => {
    const disconnect = jest.fn();
    disconnects.push(disconnect);
    return { connect: jest.fn(), disconnect };
  };
  const context = {
    sampleRate,
    createGain: jest.fn(() => ({ ...makeNode(), gain: { value: 1 } })),
    createIIRFilter: jest.fn((feedforward: number[], feedback: number[]) => {
      iirCalls.push({ feedforward, feedback });
      return makeNode();
    }),
  };
  return { context, iirCalls, disconnects };
};

const build = (
  sampleRate: number,
  filters: IFilter[],
  preAmp = 0,
): ReturnType<typeof createFakeContext> & {
  chain: ReturnType<typeof createMirrorEqChain>;
} => {
  const fakes = createFakeContext(sampleRate);
  const chain = createMirrorEqChain(
    fakes.context as unknown as BaseAudioContext,
    filters,
    preAmp,
  );
  return { ...fakes, chain };
};

describe('the mirror’s own equaliser', () => {
  it('turns the preamp from dB into a linear gain', () => {
    const { chain } = build(48000, [], -6);

    // -6 dB is half the amplitude, which is what APO's Preamp: line means too.
    expect((chain.input as unknown as GainNode).gain.value).toBeCloseTo(
      0.5012,
      3,
    );
  });

  it('creates one filter per band and chains them', () => {
    const { iirCalls } = build(48000, [
      makeFilter({ id: 'a', frequency: 100 }),
      makeFilter({ id: 'b', frequency: 1000 }),
      makeFilter({ id: 'c', frequency: 8000 }),
    ]);

    expect(iirCalls).toHaveLength(3);
  });

  it('builds coefficients at the context rate, not the graph’s', () => {
    // The bug this exists to prevent: the response curve is derived at a fixed
    // 96 kHz, but a chain that actually processes audio runs at whatever the
    // endpoint runs at. Coefficients made at twice the running rate put every
    // band an octave low, which is audible and very hard to attribute.
    const filter = makeFilter({ frequency: 1000 });
    const { iirCalls } = build(48000, [filter]);

    const atContextRate = getTFCoefficients(filter, 48000);
    const atGraphRate = getTFCoefficients(filter, RESPONSE_SAMPLE_FREQUENCY);

    expect(iirCalls[0].feedforward[0]).toBeCloseTo(atContextRate.b0, 10);
    expect(iirCalls[0].feedforward[0]).not.toBeCloseTo(atGraphRate.b0, 6);
  });

  it('states a0 as 1, because the shared maths already divided it out', () => {
    const { iirCalls } = build(48000, [makeFilter()]);

    expect(iirCalls[0].feedback[0]).toBe(1);
  });

  it('skips a degenerate band instead of silencing the whole mirror', () => {
    // Zero quality sends alpha to infinity and the coefficients to NaN.
    // Chromium throws on those, which would take the good bands down too.
    const { iirCalls } = build(48000, [
      makeFilter({ id: 'good', frequency: 1000 }),
      makeFilter({ id: 'bad', quality: 0 }),
      makeFilter({ id: 'alsoGood', frequency: 4000 }),
    ]);

    expect(iirCalls).toHaveLength(2);
  });

  it('passes audio straight through when there are no bands', () => {
    const { chain } = build(48000, []);

    expect(chain.output).toBe(chain.input);
  });

  it('releases every node it made', () => {
    const { chain, disconnects } = build(48000, [
      makeFilter({ id: 'a' }),
      makeFilter({ id: 'b', frequency: 500 }),
    ]);

    chain.dispose();

    // The gain plus both filters.
    expect(disconnects).toHaveLength(3);
    disconnects.forEach((disconnect) => expect(disconnect).toHaveBeenCalled());
  });
});

describe('the shared band maths', () => {
  it('still defaults to the graph’s rate, so the curve is unchanged', () => {
    const filter = makeFilter();

    expect(getTFCoefficients(filter)).toEqual(
      getTFCoefficients(filter, RESPONSE_SAMPLE_FREQUENCY),
    );
  });
});
