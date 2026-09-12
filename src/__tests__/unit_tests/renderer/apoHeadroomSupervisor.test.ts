import ApoHeadroomSupervisor from 'renderer/utils/apoHeadroomSupervisor';
import { shouldPushMeasurement } from 'renderer/utils/headroomCapture';

describe('file-safe APO headroom', () => {
  it('re-evaluates an actual EQ edit sooner without accelerating file writes', () => {
    const edited = new ApoHeadroomSupervisor(-4);
    const unchanged = new ApoHeadroomSupervisor(-4);
    edited.notifyEdit();
    for (let frame = 0; frame < 19; frame += 1) {
      expect(edited.observe(-10, 100)).toBeUndefined();
      expect(unchanged.observe(-10, 100)).toBeUndefined();
    }
    expect(edited.observe(-10, 100)).toBe(-3.5);
    expect(unchanged.observe(-10, 100)).toBeUndefined();
    edited.acknowledge(-3.5);
    for (let frame = 0; frame < 20; frame += 1) {
      expect(edited.observe(-10, 100)).toBeUndefined();
    }
  });
  it('does not repeat the old five-writes-per-second peak response', () => {
    expect(
      shouldPushMeasurement({
        sincePushMs: 200,
        trimDb: -1,
        lastPushedTrimDb: 0,
        programmeDeltaDb: 0,
      }),
    ).toBe(true);
    const supervisor = new ApoHeadroomSupervisor();
    for (let frame = 0; frame < 19; frame += 1) {
      expect(supervisor.observe(0, 100)).toBeUndefined();
    }
    expect(supervisor.observe(0, 100)).toBe(-0.5);
    for (let frame = 0; frame < 100; frame += 1) {
      expect(supervisor.observe(0, 100)).toBeUndefined();
    }
    supervisor.acknowledge(-0.5);
    for (let frame = 0; frame < 19; frame += 1) {
      expect(supervisor.observe(0, 100)).toBeUndefined();
    }
    expect(supervisor.observe(0, 100)).toBe(-1);
  });

  it('holds through silence and short gaps, then returns only a small step', () => {
    const supervisor = new ApoHeadroomSupervisor(-4);
    for (let frame = 0; frame < 1000; frame += 1) {
      expect(supervisor.observe(-240, 100)).toBeUndefined();
    }
    for (let frame = 0; frame < 100; frame += 1) {
      expect(supervisor.observe(-20, 100)).toBeUndefined();
    }
    let result: number | undefined;
    for (let frame = 0; frame < 60 && result === undefined; frame += 1) {
      result = supervisor.observe(-20, 100);
    }
    expect(result).toBeCloseTo(-3.75, 2);
  });

  it('does not lift between recurring peaks or above unity', () => {
    const supervisor = new ApoHeadroomSupervisor(-2);
    for (let frame = 0; frame < 1000; frame += 1) {
      expect(
        supervisor.observe(frame % 10 === 0 ? -2 : -20, 100),
      ).toBeUndefined();
    }
    const unity = new ApoHeadroomSupervisor();
    for (let frame = 0; frame < 1000; frame += 1) {
      expect(unity.observe(-20, 100)).toBeUndefined();
    }
  });

  it('cannot rush the writer with a paused or invalid capture clock', () => {
    const supervisor = new ApoHeadroomSupervisor();
    expect(supervisor.observe(0, Number.NaN)).toBeUndefined();
    expect(supervisor.observe(0, 100000)).toBeUndefined();
    expect(supervisor.observe(0, -100)).toBeUndefined();
  });
});
