import {
  createMirrorEqChain,
  getMirrorFilters,
} from '../../../renderer/audio/mirrorEq';
import {
  AutoEqFormat,
  FilterTypeEnum,
  getDefaultState,
  IFilter,
  IState,
} from '../../../common/constants';
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

describe('which layers a mirror reproduces', () => {
  const baseState = (): IState => ({
    ...getDefaultState(),
    preAmp: 0,
    filters: { band: makeFilter({ id: 'band' }) },
  });

  it('carries the user’s own bands', () => {
    expect(getMirrorFilters(baseState())).toHaveLength(1);
  });

  it('carries the voicing layer', () => {
    const withVoicing = getMirrorFilters({
      ...baseState(),
      voicing: { profileId: 'music', intensity: 1 },
    });

    expect(withVoicing.length).toBeGreaterThan(1);
  });

  it('carries the driver compensation layer', () => {
    const withDriver = getMirrorFilters({
      ...baseState(),
      driver: { profileId: 'dynamic-headphone', intensity: 1 },
    });

    expect(withDriver.length).toBeGreaterThan(1);
  });

  it('carries the Smart EQ layer', () => {
    const withSmartEq = getMirrorFilters({
      ...baseState(),
      smartEq: {
        filters: { correction: makeFilter({ id: 'correction', gain: 3 }) },
      },
    });

    expect(withSmartEq).toHaveLength(2);
  });

  it('keeps APO’s order: bands, voicing, driver, Smart EQ', () => {
    // Cascaded biquads multiply, so order does not change the response. It is
    // held identical anyway, so the two paths can be compared line by line the
    // day they disagree.
    const chain = getMirrorFilters({
      ...baseState(),
      voicing: { profileId: 'music', intensity: 1 },
      driver: { profileId: 'dynamic-headphone', intensity: 1 },
      smartEq: {
        filters: { correction: makeFilter({ id: 'correction', gain: 3 }) },
      },
    });

    const bands = getMirrorFilters(baseState()).length;
    const throughVoicing = getMirrorFilters({
      ...baseState(),
      voicing: { profileId: 'music', intensity: 1 },
    }).length;

    expect(chain.slice(0, bands)).toEqual(getMirrorFilters(baseState()));
    expect(chain).toHaveLength(
      throughVoicing +
        (getMirrorFilters({
          ...baseState(),
          driver: { profileId: 'dynamic-headphone', intensity: 1 },
        }).length -
          bands) +
        1,
    );
  });

  it('applies nothing at all to a GraphicEQ profile', () => {
    // A GraphicEQ profile is an arbitrary curve, not a filter list. Applying
    // whatever editable projection happens to be in `filters` would put a
    // fragment of the curve on the speaker, which is worse than none of it.
    expect(
      getMirrorFilters({
        ...baseState(),
        eqFormat: AutoEqFormat.GRAPHIC,
        graphicEq: [{ frequency: 100, gain: 3 }],
      }),
    ).toEqual([]);
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
