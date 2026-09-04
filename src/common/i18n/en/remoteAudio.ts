/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>

This program is free software: you can redistribute it and/or modify
it under the terms of the GNU General Public License version 3 or later.
*/

const remoteAudio = {
  'tabs.share': 'Share Audio',
  'remoteAudio.eyebrow': 'LAN AUDIO',
  'remoteAudio.title': 'Share audio between your computers',
  'remoteAudio.subtitle':
    'Choose one role for this computer. The receiver is the PC with your headset; every other PC can connect as a sender.',
  'remoteAudio.choose': "Choose this computer's role",
  'remoteAudio.security': 'Connection properties',
  'remoteAudio.badge.local': 'Local network only',
  'remoteAudio.badge.lossless': 'Lossless 32-bit PCM',
  'remoteAudio.badge.encrypted': 'AES-256 encrypted',
  'remoteAudio.listen.kicker': 'RECEIVER · SERVER',
  'remoteAudio.listen.title': 'Play audio on this computer',
  'remoteAudio.listen.body':
    'Use this on the computer connected to your headset or speakers. It accepts one or more senders and plays them through the output already selected in FluidEQ.',
  'remoteAudio.listen.start': 'Create connection code',
  'remoteAudio.listen.activeTitle': 'This computer is listening',
  'remoteAudio.listen.stop': 'Stop listening',
  'remoteAudio.send.kicker': 'SENDER · CLIENT',
  'remoteAudio.send.title': 'Send audio from this computer',
  'remoteAudio.send.body':
    'Do this on each computer you want to hear. Paste the code shown on the headset computer.',
  'remoteAudio.send.codeLabel': 'Connection code',
  'remoteAudio.send.codePlaceholder': 'Paste FLUIDEQ-LAN-2…',
  'remoteAudio.send.start': 'Connect and send',
  'remoteAudio.send.activeTitle': 'Sending system audio',
  'remoteAudio.send.activeBody':
    'Keep FluidEQ open on both computers. The listener plays this lossless stream together with every other connected sender.',
  'remoteAudio.send.destination': 'Playing on {name}',
  'remoteAudio.send.stop': 'Stop sending',
  'remoteAudio.status.preparing': 'Preparing…',
  'remoteAudio.status.waiting': 'Waiting for computers',
  'remoteAudio.status.connecting': 'Connecting…',
  'remoteAudio.status.connectedOne': '{count} computer connected',
  'remoteAudio.status.connectedMany': '{count} computers connected',
  'remoteAudio.status.sending': 'Sending lossless audio',
  'remoteAudio.status.playbackBlocked': 'Press Resume to hear audio',
  'remoteAudio.status.disconnected': 'Listener disconnected',
  'remoteAudio.monitor.title': 'Live connection',
  'remoteAudio.monitor.inactive': 'Choose a role to begin',
  'remoteAudio.monitor.ready': 'Ready for a connection code',
  'remoteAudio.monitor.waveform': 'Live shared audio waveform',
  'remoteAudio.monitor.waveformFor': 'Live audio waveform for {name}',
  'remoteAudio.monitor.buffer': '{milliseconds} ms buffer',
  'remoteAudio.monitor.noRole': 'No role selected',
  'remoteAudio.monitor.noSources': 'No source computers connected',
  'remoteAudio.monitor.waitingSource': 'Waiting for a sender',
  'remoteAudio.monitor.outgoing': 'Audio sent by this computer',
  'remoteAudio.monitor.transmitting': 'Transmitting',
  'remoteAudio.monitor.quiet': 'Quiet',
  'remoteAudio.code.title': 'Connect your source computers',
  'remoteAudio.code.hint':
    'On each source computer, open Share Audio, choose “Send audio from this computer,” and paste one code below. Use the entry for the network shared by both computers.',
  'remoteAudio.code.copy': 'Copy code',
  'remoteAudio.code.copied': 'Copied',
  'remoteAudio.code.forAddress': 'Pairing code for {address}',
  'remoteAudio.resume': 'Resume audio',
  'remoteAudio.note.title': 'Start quietly.',
  'remoteAudio.note.body':
    'Several computers are mixed together and can add up quickly. Lower the headset volume before the first connection. Stopping the listener immediately invalidates its pairing code.',
  'remoteAudio.error.lan':
    'FluidEQ could not open that local connection. Make sure both computers are on the same private network and FluidEQ is allowed through the firewall.',
  'remoteAudio.error.capture':
    'FluidEQ could not capture this computer’s system audio. Check the current output device, then stop and try again.',
  'remoteAudio.error.playback':
    'FluidEQ could not start the lossless audio engine. Restart FluidEQ and try again.',
  'remoteAudio.error.connection':
    'The encrypted audio connection stopped. Stop this session and reconnect with a current pairing code.',
} as const;

export default remoteAudio;
