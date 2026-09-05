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
  'remoteAudio.badge.local': 'Private LAN only',
  'remoteAudio.badge.lossless': 'Lossless Float32 PCM transport',
  'remoteAudio.badge.encrypted': 'AES-256-GCM encrypted',
  'remoteAudio.listen.kicker': 'RECEIVER · SERVER',
  'remoteAudio.listen.title': 'Play audio on this computer',
  'remoteAudio.listen.body':
    'Use this on the computer connected to your headset or speakers. It accepts one or more senders and plays them through the output already selected in FluidEQ.',
  'remoteAudio.listen.start': 'Create connection code',
  'remoteAudio.listen.activeTitle': 'This computer is listening',
  'remoteAudio.listen.newCode': 'Create new code',
  'remoteAudio.listen.stop': 'Stop listening',
  'remoteAudio.stream.title': 'Stream priority',
  'remoteAudio.stream.lossless': 'Both send lossless PCM',
  'remoteAudio.stream.video.title': 'Game/Video',
  'remoteAudio.stream.video.body':
    'Lowest delay for lip-sync. May stutter sooner on busy Wi-Fi.',
  'remoteAudio.stream.video.buffer': '~40 ms start',
  'remoteAudio.stream.music.title': 'Music',
  'remoteAudio.stream.music.body':
    'Larger safety buffer for uninterrupted listening.',
  'remoteAudio.stream.music.buffer': '~240 ms start',
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
  'remoteAudio.send.readyHint': 'Your saved code stays here after stopping.',
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
  'remoteAudio.monitor.buffer': 'Playback {milliseconds} ms',
  'remoteAudio.monitor.sendQueue': 'Send queue {milliseconds} ms',
  'remoteAudio.monitor.noRole': 'No role selected',
  'remoteAudio.monitor.noSources': 'No source computers connected',
  'remoteAudio.monitor.waitingSource': 'Waiting for a sender',
  'remoteAudio.monitor.outgoing': 'Audio sent by this computer',
  'remoteAudio.monitor.transmitting': 'Transmitting',
  'remoteAudio.monitor.quiet': 'Quiet',
  'remoteAudio.monitor.peakLevel': 'Live peak audio level',
  'remoteAudio.monitor.peak': 'Peak {decibels} dB',
  'remoteAudio.monitor.networkUsage': '{megabits} Mb/s LAN',
  'remoteAudio.monitor.networkHealthy': 'Network clear',
  'remoteAudio.monitor.networkQueued': '{milliseconds} ms queued',
  'remoteAudio.code.title': 'Connect your source computers',
  'remoteAudio.code.hint':
    'Copy one code to every sender. The pairing stays saved through app closes and PC restarts. Use the entry for the network shared by both computers.',
  'remoteAudio.code.copy': 'Copy code',
  'remoteAudio.code.copied': 'Copied',
  'remoteAudio.code.forAddress': 'Pairing code for {address}',
  'remoteAudio.resume': 'Resume audio',
  'remoteAudio.note.title': 'Start quietly.',
  'remoteAudio.note.body':
    'Several computers are mixed together and can add up quickly. Lower the headset volume before the first connection. Only creating a new code disconnects saved pairings.',
  'remoteAudio.error.lan':
    'FluidEQ could not open that local connection. Make sure both computers are on the same private network and FluidEQ is allowed through the firewall.',
  'remoteAudio.error.capture':
    'FluidEQ could not capture this computer’s system audio. Check the current output device, then stop and try again.',
  'remoteAudio.error.playback':
    'FluidEQ could not start the lossless audio engine. Restart FluidEQ and try again.',
  'remoteAudio.error.connection':
    'The encrypted audio connection stopped. Your saved code is still below; reconnect when the receiver is ready.',
} as const;

export default remoteAudio;
