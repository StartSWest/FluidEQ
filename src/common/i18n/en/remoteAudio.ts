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
    'Link two computers and each one plays the other’s sound. Each sends its sound untouched; the computer you listen on applies its own EQ, curves and DSP.',
  'remoteAudio.security': 'Connection properties',
  'remoteAudio.badge.local': 'Private LAN only',
  'remoteAudio.badge.lossless': 'Lossless Float32 PCM transport',
  'remoteAudio.badge.encrypted': 'AES-256-GCM encrypted',
  'remoteAudio.link.section': 'Link a computer',
  'remoteAudio.link.thisComputer': 'This computer',
  'remoteAudio.link.thisHint':
    'Paste this code on the other computer, or paste that computer’s code here. Either way works.',
  'remoteAudio.link.or': 'or',
  'remoteAudio.link.otherComputer': 'The other computer’s code',
  'remoteAudio.link.codeLabel': 'Connection code',
  'remoteAudio.link.placeholder': 'Paste FLUIDEQ-LAN-2…',
  'remoteAudio.link.start': 'Link',
  'remoteAudio.link.otherHint':
    'Both computers play each other right away. Switch either direction off later if you only want one.',
  'remoteAudio.link.once':
    'Do it once. Linked computers find each other again after a restart, from either side.',
  'remoteAudio.rule.echoTitle': 'Both ways, no echo',
  'remoteAudio.rule.echo':
    'Each computer sends only what it plays itself — never the sound it is receiving — so nothing comes back around.',
  'remoteAudio.rule.eqTitle': 'Your EQ where you listen',
  'remoteAudio.rule.eq':
    'Sound leaves untouched. The computer you hear it on applies its EQ, headphone curve and DSP — once.',
  'remoteAudio.rule.steadyTitle': 'Steady, never drifting',
  'remoteAudio.rule.steady':
    'About 30 ms behind and held there: the two clocks are kept in step, so there are no dropouts and no slow drift.',
  'remoteAudio.linked.section': 'Linked',
  'remoteAudio.linked.cardLabel': 'Link with {name}',
  'remoteAudio.linked.bothWays': 'Both ways',
  'remoteAudio.linked.incomingOnly': 'Incoming only',
  'remoteAudio.linked.outgoingOnly': 'Outgoing only',
  'remoteAudio.linked.paused': 'Paused',
  'remoteAudio.linked.looking': 'Looking for {name} on your network…',
  'remoteAudio.linked.lossless': 'Lossless',
  'remoteAudio.linked.unlink': 'Unlink',
  'remoteAudio.linked.noEcho':
    'No echo: {name}’s sound is never sent back to it.',
  'remoteAudio.linked.untouched':
    'Leaves untouched both ways — each computer applies its own EQ and DSP.',
  'remoteAudio.lane.from': 'From {name}',
  'remoteAudio.lane.to': 'To {name}',
  'remoteAudio.lane.playsHere': 'Plays here',
  'remoteAudio.lane.yourSound': 'Your sound',
  'remoteAudio.lane.playItHere': 'Play it here',
  'remoteAudio.lane.sendMySound': 'Send my sound',
  'remoteAudio.lane.delay': 'delay',
  'remoteAudio.lane.sent': 'sent',
  'remoteAudio.lane.milliseconds': '{milliseconds} ms',
  'remoteAudio.lane.megabits': '{megabits} Mb/s',
  'remoteAudio.lane.receiving': 'Receiving',
  'remoteAudio.lane.paused': 'Paused',
  'remoteAudio.lane.inQuiet': 'Nothing playing on {name}',
  'remoteAudio.lane.inOff':
    'Switched off: {name}’s sound doesn’t play on this computer.',
  'remoteAudio.lane.inNotSent': '{name} has “Send my sound” off.',
  'remoteAudio.lane.inOld':
    '{name} needs the latest FluidEQ to send its sound here.',
  'remoteAudio.lane.inOneWay':
    'Playing both ways needs Windows on this computer.',
  'remoteAudio.lane.outQuiet': 'Nothing playing on this computer',
  'remoteAudio.lane.outOff': 'Not sending. {name} doesn’t hear this computer.',
  'remoteAudio.lane.outNotPlayed': '{name} has “Play it here” off.',
  'remoteAudio.lane.outOld':
    '{name} needs the latest FluidEQ to play this computer’s sound.',
  'remoteAudio.lane.outOneWay':
    'Sending both ways needs Windows on this computer.',
  'remoteAudio.lane.outFailed':
    'This computer’s sound could not be captured. Switch “Send my sound” off and on to try again.',
  'remoteAudio.another.section': 'Link another computer',
  'remoteAudio.another.hub':
    'Paste this computer’s code on another computer. Each computer linked gets its own row above.',
  'remoteAudio.another.spoke':
    'To link a third computer, paste {name}’s code on it: a computer links with the one whose code it uses.',
  'remoteAudio.singlePlayer.title': 'One player at a time',
  'remoteAudio.singlePlayer.body':
    'covers linked computers too: starting something on either one pauses what was playing on the other.',
  'remoteAudio.code.copy': 'Copy code',
  'remoteAudio.code.copied': 'Copied',
  'remoteAudio.code.forAddress': 'Pairing code for {address}',
  'remoteAudio.status.preparing': 'Preparing…',
  'remoteAudio.status.playbackBlocked': 'Press Resume to hear audio',
  'remoteAudio.resume': 'Resume audio',
  'remoteAudio.retry': 'Try again',
  'remoteAudio.monitor.networkHealthy': 'Network clear',
  'remoteAudio.monitor.networkQueued': '{milliseconds} ms queued',
  'remoteAudio.note.title': 'Start quietly.',
  'remoteAudio.note.body':
    'Two computers playing at once add up. Lower your volume before the first link.',
  'remoteAudio.error.lan':
    'FluidEQ could not open that local connection. Make sure both computers are on the same private network and FluidEQ is allowed through the firewall.',
  'remoteAudio.error.capture':
    'FluidEQ could not capture this computer’s system audio. Check the current output device, then try again.',
  'remoteAudio.error.playback':
    'FluidEQ could not start the lossless audio engine. Restart FluidEQ and try again.',
  'remoteAudio.error.connection':
    'The encrypted audio connection stopped. FluidEQ keeps looking for the other computer; it reconnects by itself when that computer is back.',
} as const;

export default remoteAudio;
