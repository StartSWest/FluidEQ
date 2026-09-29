/**
 * "Fix audio problems" (`AudioTroubleshooter.tsx`), step by step. Names
 * inside Equalizer APO's own English-only window (Device Selector,
 * Troubleshooting options, APO, Install as SFX/EFX) stay English in every
 * language. `**…**` is bold, rendered by `renderInline`.
 */
const troubleshoot = {
  'troubleshoot.title': 'Fix audio problems',
  'troubleshoot.description':
    'Work down the list and stop at the first one that helps. Each is more disruptive than the last, and the first fixes most problems.',
  'troubleshoot.footer':
    'Still wrong after all of that? Use **{report}** in the same menu — it collects the logs, with anything identifying you stripped out, and shows you the whole thing before it goes anywhere.',
  'troubleshoot.tried': 'Tried',
  'troubleshoot.restart.title': 'Restart Windows Audio',
  'troubleshoot.restart.when':
    'Sound has stopped, or the graph has gone flat while something is playing. This is the fix for almost every case, and the one to try first.',
  'troubleshoot.restart.cost':
    'A few seconds of silence. Windows asks for permission.',
  'troubleshoot.apo.reselect.title': 'Re-select your devices in Equalizer APO',
  'troubleshoot.apo.reselect.when':
    'One device is equalised and another is not, or a headset you have just plugged in is being ignored. Equalizer APO attaches to each output separately, and a new device is not attached until you tick it.',
  'troubleshoot.apo.reselect.cost':
    'Opens Equalizer APO’s Device Selector. A restart afterwards.',
  'troubleshoot.apo.openSelector': 'Open Device Selector',
  'troubleshoot.apo.mode.title': 'Try the other installation mode',
  'troubleshoot.apo.mode.when':
    'A device is ticked in the Device Selector and still has no effect, or ticking it makes that device stop playing altogether. Equalizer APO can attach itself to Windows audio in two different ways, and some hardware only works with one of them.',
  'troubleshoot.apo.mode.cost':
    'A restart. Reversible — switch back the same way.',
  'troubleshoot.apo.mode.detail':
    'In the Device Selector, open **Troubleshooting options**. The default is to install as an **APO**, which is the one that works on most machines. **Install as SFX/EFX** is the alternative, and it is what to reach for on devices whose drivers bring their own effects — a lot of laptop and gaming audio. If a device stopped working after you ticked it, try the other mode before concluding it cannot be equalised.',
  'troubleshoot.apo.reinstall.title': 'Reinstall Equalizer APO',
  'troubleshoot.apo.reinstall.when':
    'The first two changed nothing, or Windows updated and the equaliser has not worked since. Its installer is also its repair tool: it re-registers the audio component and reopens the device list.',
  'troubleshoot.apo.reinstall.cost':
    'Administrator permission, and your computer needs to restart afterwards. Your FluidEQ profiles and presets are not touched.',
  'troubleshoot.apo.readd.title': 'Remove the device, restart, add it back',
  'troubleshoot.apo.readd.when':
    'Only if a specific device is still wrong after a reinstall. Untick it in the Device Selector, restart the computer, then tick it again and restart once more.',
  'troubleshoot.apo.readd.cost': 'Two restarts.',
  'troubleshoot.apo.readd.detail':
    'The two restarts are not superstition. Equalizer APO attaches itself to an audio endpoint as the machine starts, so a device that is detached while Windows is running stays half-attached until it is not — and adding it back before that has happened puts the broken state straight back.',
  'troubleshoot.engine.enable.title':
    'Put the FluidEQ Engine back on your outputs',
  'troubleshoot.engine.enable.when':
    'One device is equalised and another is not, or a headset you have just plugged in is being ignored. The engine attaches to each output separately, and a Windows update can detach it from one it was already on.',
  'troubleshoot.engine.permission':
    'Windows asks for permission, and audio restarts for a moment. No reboot.',
  'troubleshoot.engine.remove.title':
    'Remove the FluidEQ Engine from this output',
  'troubleshoot.engine.remove.when':
    'This one output is wrong in a way none of the above fixes, or you want to hand it back to another audio program. The engine comes off the output Windows is playing through right now, and whatever it replaced goes back on.',
  'troubleshoot.engine.remove.cost':
    'Windows asks for permission, and audio restarts for a moment. Your other outputs are untouched, and the step above puts it back.',
  'troubleshoot.engine.remove.action': 'Remove from this output',
} as const;

export default troubleshoot;
