/* FluidEQ — GPL-3.0-or-later */

/** Native Windows cases must exercise Windows gates even on the Linux host. */
const setUpPlatform = (platform: NodeJS.Platform) => {
  const original = Object.getOwnPropertyDescriptor(process, 'platform');
  beforeAll(() =>
    Object.defineProperty(process, 'platform', { value: platform }),
  );
  afterAll(() => {
    if (original) {
      Object.defineProperty(process, 'platform', original);
    }
  });
};

export default setUpPlatform;
