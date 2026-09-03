/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>

This program is free software: you can redistribute it and/or modify
it under the terms of the GNU General Public License version 3 or later.
*/

const remoteAudio = {
  'tabs.share': 'Share',
  'remoteAudio.eyebrow': 'LAN AUDIO LINK',
  'remoteAudio.title': 'Hear your other computers here',
  'remoteAudio.subtitle':
    'Make the computer with your headset the listener. Any number of other FluidEQ computers on the same local network can join and send their system audio here.',
  'remoteAudio.security': 'Connection properties',
  'remoteAudio.badge.local': 'Local network only',
  'remoteAudio.badge.lossless': 'Lossless 32-bit PCM',
  'remoteAudio.badge.encrypted': 'AES-256 encrypted',
  'remoteAudio.listen.kicker': 'COMPUTER B · HEADSET',
  'remoteAudio.listen.title': 'Play audio on this computer',
  'remoteAudio.listen.body':
    'Choose the headset or speakers connected here, then share the pairing code with every computer you want to hear.',
  'remoteAudio.listen.start': 'Start listening',
  'remoteAudio.listen.activeTitle': 'This computer is listening',
  'remoteAudio.listen.stop': 'Stop listening',
  'remoteAudio.send.kicker': 'COMPUTER A · SOURCE',
  'remoteAudio.send.title': 'Send this computer’s audio',
  'remoteAudio.send.body':
    'Paste a pairing code from the headset computer. FluidEQ sends this computer’s system loopback without audio compression.',
  'remoteAudio.send.codeLabel': 'Pairing code from the headset computer',
  'remoteAudio.send.codePlaceholder': 'Paste FLUIDEQ-LAN-1…',
  'remoteAudio.send.start': 'Start sending',
  'remoteAudio.send.activeTitle': 'Sending system audio',
  'remoteAudio.send.activeBody':
    'Keep FluidEQ open on both computers. The listener plays this lossless stream together with every other connected sender.',
  'remoteAudio.send.stop': 'Stop sending',
  'remoteAudio.output.label': 'Play through',
  'remoteAudio.output.default': 'Default audio output',
  'remoteAudio.output.unnamed': 'Audio output {number}',
  'remoteAudio.status.preparing': 'Preparing…',
  'remoteAudio.status.waiting': 'Waiting for computers',
  'remoteAudio.status.connecting': 'Connecting…',
  'remoteAudio.status.connectedOne': '{count} computer connected',
  'remoteAudio.status.connectedMany': '{count} computers connected',
  'remoteAudio.status.sending': 'Sending lossless audio',
  'remoteAudio.status.playbackBlocked': 'Press Resume to hear audio',
  'remoteAudio.status.disconnected': 'Listener disconnected',
  'remoteAudio.code.title': 'Pair other computers',
  'remoteAudio.code.hint':
    'Copy one code into each sender. The same code can connect multiple computers while this listener stays on. If several addresses appear, use the one on the network shared by both computers.',
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
  'remoteAudio.error.connection':
    'The encrypted audio connection stopped. Stop this session and reconnect with a current pairing code.',
} as const;

export default remoteAudio;
