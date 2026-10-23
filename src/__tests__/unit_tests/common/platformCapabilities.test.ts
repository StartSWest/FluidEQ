import { capabilitiesFor } from '../../../common/platformCapabilities';
import { helpChaptersFor, helpTextKey } from '../../../common/helpPlatformText';

describe('platform-specific engine choices and help', () => {
  it('offers the built-in engine on Mac and APO on Windows', () => {
    expect(capabilitiesFor('darwin')).toEqual({
      apoConfig: false,
      builtInEngine: true,
    });
    expect(capabilitiesFor('win32')).toEqual({
      apoConfig: true,
      builtInEngine: false,
    });
    expect(capabilitiesFor('linux')).toEqual({
      apoConfig: false,
      builtInEngine: false,
    });
  });

  it('does not let a caller change another window’s capabilities', () => {
    const changed = capabilitiesFor('darwin');
    changed.builtInEngine = false;
    expect(capabilitiesFor('darwin').builtInEngine).toBe(true);
  });

  it('removes Windows installation instructions only from the Mac guide', () => {
    expect(helpChaptersFor(true).map(({ id }) => id)).not.toContain('engine');
    expect(helpChaptersFor(false).map(({ id }) => id)).toContain('engine');
    expect(helpTextKey('help.start.steps', true)).toBe('help.start.steps.mac');
    expect(helpTextKey('help.start.steps', false)).toBe('help.start.steps');
  });
});
