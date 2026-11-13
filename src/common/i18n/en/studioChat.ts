// The Studio's chat with the member's own Claude Code (`studio/chat/`).
// "Claude", "Claude Code", "Anthropic" and the plan names are names, the
// same in every language.
const studioChat = {
  'studioChat.label': 'Make with AI',
  'studioChat.title': 'Make with AI',
  'studioChat.where': 'Claude Code on this computer',
  'studioChat.wherePlan': 'Claude Code · {plan} plan',
  'studioChat.new': 'New chat',
  'studioChat.otherAi': 'Use another AI',
  'studioChat.menu': 'Chat options',
  'studioChat.backToChat': 'Back to the chat',
  'studioChat.fold': 'Fold the chat away',
  'studioChat.unfold': 'Make with AI',
  'studioChat.inspect':
    "This is one of FluidEQ's scenes, open to look inside. Start a project of your own to make one with Claude.",
  'studioChat.noProject':
    'Start a project, and Claude can make its scene with you here.',
  'studioChat.checking': 'Looking for Claude Code on this computer…',
  'studioChat.missingTitle': 'Make scenes by chatting with your AI',
  'studioChat.missingBody':
    "The Studio chats through the Claude Code on this computer, with your own Claude plan. It isn't installed yet.",
  'studioChat.signInTitle': 'Sign in to Claude',
  'studioChat.signInBody':
    "Claude Code is installed but not signed in. You sign in on Anthropic's own page in your browser; FluidEQ never sees it.",
  'studioChat.install': 'Install Claude Code',
  'studioChat.signIn': 'Sign in',
  'studioChat.signingIn': 'Waiting for the sign-in…',
  'studioChat.checkAgain': 'Check again',
  'studioChat.plans':
    'Claude Code needs a Claude Pro, Max, Team or Enterprise plan.',
  'studioChat.otherAiNote':
    'Use another AI copies a prompt for ChatGPT, Codex or any other assistant instead.',
  'studioChat.welcomeTitle': 'What should this scene be?',
  'studioChat.welcomeBody':
    'Describe it in a sentence. Claude writes it, looks at it, listens to your music with it and plays each version on the stage.',
  'studioChat.you': 'You',
  'studioChat.claude': 'Claude',
  'studioChat.attachedNote': 'With a picture of the stage',
  'studioChat.seenLarger': 'Show this picture larger',
  'studioChat.thinking': 'Thinking…',
  'studioChat.step.theScene': 'the scene',
  'studioChat.step.look': 'Looked at the scene',
  'studioChat.step.lookNow': 'Looking at the scene…',
  'studioChat.step.animation': 'Looked at the animation {file}',
  'studioChat.step.animationNow': 'Looking at the animation {file}…',
  'studioChat.step.sheet': 'Made the frames of {file}',
  'studioChat.step.sheetNow': 'Making the frames of {file}…',
  'studioChat.step.hear': 'Listened to the music',
  'studioChat.step.hearNow': 'Listening to the music…',
  'studioChat.step.read': 'Read {file}',
  'studioChat.step.readNow': 'Reading {file}…',
  'studioChat.step.write': 'Changed {file}',
  'studioChat.step.writeNow': 'Changing {file}…',
  'studioChat.step.search': 'Looked through the project',
  'studioChat.step.searchNow': 'Looking through the project…',
  'studioChat.step.other': 'Worked on the scene',
  'studioChat.step.otherNow': 'Working on the scene…',
  'studioChat.version': 'Version {version}',
  'studioChat.playing': 'Playing on the stage',
  'studioChat.bringBack': 'Bring back',
  'studioChat.broughtBack': 'Back on the stage',
  'studioChat.bringBackFailed': 'This version could not be brought back.',
  'studioChat.stopped': 'Stopped.',
  'studioChat.failed.missing': "Claude Code isn't on this computer any more.",
  'studioChat.failed.signedOut':
    'Claude Code is signed out. Sign in, then send your message again.',
  'studioChat.failed.limit':
    "Your Claude plan's usage limit was reached. It resets after a while; send your message again then.",
  'studioChat.failed.crashed':
    'Claude Code stopped before it finished. Send your message again to carry on.',
  'studioChat.placeholderFirst': 'Describe your scene…',
  'studioChat.placeholder':
    'Ask for a change, like “make the lights flash on the snare”',
  'studioChat.attach': 'Attach the stage',
  'studioChat.attached': 'Picture attached',
  'studioChat.attachHint':
    'Send a picture of the scene as it looks now with your message',
  'studioChat.attachPicture': 'Attach a picture',
  'studioChat.attachPictureHint':
    'Attach a picture from your computer. You can also paste one with Ctrl+V or drop it here.',
  'studioChat.send': 'Send',
  'studioChat.stop': 'Stop',
  'studioChat.fine':
    "Runs your own Claude Code on your Claude plan. It can change this project's files and see and hear the scene. FluidEQ never sees your sign-in.",
  'studioChat.status.working': 'Claude is working on the scene',
  'studioChat.model': 'Model',
  'studioChat.effort': 'Effort',
  'studioChat.modelDefault': 'Default',
  'studioChat.effortDefault': 'Default',
  'studioChat.effortLow': 'Low',
  'studioChat.effortMedium': 'Medium',
  'studioChat.effortHigh': 'High',
  'studioChat.effortXhigh': 'Extra high',
  'studioChat.effortMax': 'Max',
  'studioChat.carryOn': 'Carry on',
  'studioChat.carryOnMessage': 'Please carry on where you stopped.',
  'studioChat.resize': 'Drag to resize the chat',
  'studioChat.effortHint': 'How hard Claude thinks. Medium suits most changes.',
  'studioChat.modelHintDefault': 'What Claude Code is set to',
  'studioChat.modelHintDefaultNamed': 'What Claude Code is set to: {model}',
  'studioChat.modelUnavailable': 'Not on your Claude plan',
  'studioChat.modelUnavailableChosen':
    'Not on your Claude plan, so the chat uses Default',
  'studioChat.modelHintFable': 'The most capable, for the hardest scenes',
  'studioChat.modelHintOpus': 'Deep and careful, for big changes',
  'studioChat.modelHintSonnet': 'Fast and capable, for most changes',
  'studioChat.modelHintHaiku': 'The quickest, for small tweaks',
  'studioChat.effortWarning':
    'Higher effort makes Claude think longer: replies take more time and use your Claude plan’s limits faster.',
  'studioChat.step.picture': 'Made the picture {file}',
  'studioChat.step.pack': 'Put the pictures into the scene',
  'studioChat.step.packNow': 'Putting the pictures into the scene…',
  'studioChat.step.pictureNow': 'Making the picture {file}…',
  'studioChat.step.make': 'Made it with Higgsfield',
  'studioChat.step.makeNow': 'Making it with Higgsfield…',
  'studioChat.ask.toolTitle': 'Allow Claude to use {tool}?',
  'studioChat.ask.toolBody':
    'One of your own Claude Code tools or plugins. It runs on this computer, with your accounts, only if you allow it.',
  'studioChat.ask.allow': 'Allow',
  'studioChat.ask.allowAlways': 'Always allow',
  'studioChat.ask.allowAlwaysHint':
    'Don’t ask about {tool} again: kept in your own Claude Code settings',
  'studioChat.ask.deny': 'Don’t allow',
  'studioChat.ask.foreign':
    'This scene came from outside FluidEQ, so its AI asks before every command.',
  'studioChat.outside.title': 'This scene came from outside FluidEQ',
  'studioChat.outside.body':
    'FluidEQ did not make this folder, and text in its files could tell the AI to run commands, so it asks you before every one. If the scene is yours, or you know who made it, trust it: it is then one of your own.',
  'studioChat.outside.trust': 'I trust this scene',
  'studioChat.memberCopy.title':
    'A member’s scene: the AI asks before every command',
  'studioChat.memberCopy.body':
    'Text in its files could tell the AI to run something, so it asks you before every command. A member’s scene can’t be marked as trusted.',
  'studioChat.past.title': 'Past chats',
  'studioChat.past.empty':
    'No earlier chats yet. Starting a new chat keeps this one here.',
  'studioChat.past.loading': 'Looking for earlier chats…',
  'studioChat.past.fromClaude': 'Kept by Claude Code',
  'studioChat.past.fromClaudeHint':
    'Found in Claude Code’s own copy: the messages come back, the versions to bring back do not.',
  'studioChat.past.delete': 'Delete this chat',
  'studioChat.past.busy':
    'Wait for Claude to finish before opening another chat.',
  'studioChat.zoom.label': 'Chat text size',
  'studioChat.zoom.in': 'Larger text',
  'studioChat.zoom.out': 'Smaller text',
  'studioChat.zoom.reset': 'Back to the normal size',
  'studioChat.copy': 'Copy',
  'studioChat.latest': 'Jump to the latest',
  'studioChat.latestWriting': 'Claude is still writing: jump to the latest',
  'studioChat.copied': 'Copied',
  'studioChat.sketch.title': 'Draw on the picture',
  'studioChat.sketch.lead':
    'Circle things, point arrows at them, write beside them or crop to the part that matters. Claude sees your marks with the picture. Hold Space and drag to move round a zoomed picture.',
  'studioChat.sketch.done': 'Use this picture',
  'studioChat.sketch.attach': 'Attach to chat',
  'studioChat.viewer.draw': 'Draw',
  'studioChat.viewer.drawHint':
    'Draw on this picture where you are zoomed in, then attach it to your next message.',
  'studioChat.sketch.cancel': 'Cancel',
  'studioChat.sketch.undo': 'Undo',
  'studioChat.sketch.clear': 'Clear',
  'studioChat.sketch.ink': 'Colour',
  'studioChat.sketch.red': 'Red',
  'studioChat.sketch.yellow': 'Yellow',
  'studioChat.sketch.cyan': 'Cyan',
  'studioChat.sketch.white': 'White',
  'studioChat.sketch.width': 'Pen',
  'studioChat.sketch.thin': 'Thin pen',
  'studioChat.sketch.thick': 'Thick pen',
  'studioChat.sketch.canvas': 'The stage’s picture, to draw on',
  'studioChat.sketch.open': 'Draw on the picture',
  'studioChat.sketch.remove': 'Remove the picture',
  'studioChat.sketch.tool': 'Tool',
  'studioChat.sketch.pen': 'Pen',
  'studioChat.sketch.arrow': 'Arrow',
  'studioChat.sketch.text': 'Text',
  'studioChat.sketch.textHint': 'Type, then Enter',
  'studioChat.sketch.crop': 'Crop',
  'studioChat.sketch.cropApply': 'Crop',
  'studioChat.sketch.cropHint': 'Keep only what is inside the box (Enter)',
  'studioChat.accounts.title': 'Accounts',
  'studioChat.accounts.open': 'See which accounts the chat uses',
  'studioChat.accounts.claude': 'Claude',
  'studioChat.accounts.unknown': 'Signed in',
  'studioChat.accounts.switch': 'Use another account',
  'studioChat.accounts.claudeMissing':
    'Claude Code is not installed on this computer.',
  'studioChat.accounts.claudeOut': 'Claude Code is not signed in.',
  'studioChat.accounts.fine':
    'FluidEQ shows which accounts these are and never sees their sign-ins.',
  'studioChat.welcomeSceneTitle': 'What should change in {name}?',
  'studioChat.welcomeSceneBody':
    'Tell Claude what to change: how it looks, how it moves with the music, its colours or its light. Claude edits this scene and plays each version on the stage.',
  'studioChat.queue.title':
    'Queued · Claude reads these together at its next step',
  'studioChat.queue.send': 'Queue: Claude reads it at its next step',
  'studioChat.queue.remove': 'Take back',
  'studioChat.queue.sent':
    'Handed to Claude: it reads this when its current step is done',
  'studioChat.queue.picture': 'With a picture of the stage',
  'studioChat.step.compact': 'Compacted the conversation',
  'studioChat.step.compactNow': 'Compacting the conversation…',
  'studioChat.step.compactTokens': '{before} → {after} tokens',
  'studioChat.compact.label': 'Compact',
  'studioChat.context.share': '{percent}% of context',
  'studioChat.context.detail':
    '{used} of {window} tokens in Claude’s context window. Compact makes room.',
  'studioChat.context.tokens': '{used} tokens of context',
  'studioChat.failed.fableLimit': 'Fable’s weekly limit is reached.',
  'studioChat.fable.back': 'Fable is back {time}.',
  'studioChat.fable.checking': 'Checking whether Opus has room…',
  'studioChat.fable.opusRoom':
    'Opus still has room in your plan. Switch this chat to Opus and send your message again?',
  'studioChat.fable.switch': 'Switch to Opus',
  'studioChat.fable.notNow': 'Not now',
  'studioChat.fable.opusFull': 'Opus is at its limit too:',
  'studioChat.limits.fable': 'Fable · this week',
  'studioChat.limits.opus': 'Opus · this week',
  'studioChat.limits.fiveHour': 'Current session (5 hours)',
  'studioChat.limits.week': 'This week',
  'studioChat.limits.used': '{percent}% used',
  'studioChat.limits.resets': 'Resets {time}',
  'studioChat.limits.asOf': 'As of {time} · updated each time Claude answers',
  'studioChat.limits.none':
    'Your 5-hour and weekly limits show here once Claude has answered a message.',
  'studioChat.context.tokensOf': '{used} of {window} tokens',
  'studioChat.context.explain':
    'Every message carries the whole conversation. Compact sums it up so far, so the messages after it carry less.',
  'studioChat.queue.sendNow': 'Send now',
  'studioChat.queue.sendNowHint':
    'Stops the step Claude is on and reads these now, as one message',
  'studioChat.step.times': '×{count}',
  'studioChat.picked.lead':
    'Picked in the scene (change only these unless I say otherwise):',
  'studioChat.picked.label': 'Picked in the scene',
  'studioChat.picked.remove': 'Remove {name}',
  'studioChat.accounts.higgsfield': 'Higgsfield',
  'studioChat.accounts.higgsfieldReady': 'Connected through your Claude Code',
  'studioChat.accounts.higgsfieldNote':
    'Makes pictures, videos that become animations, and 3D models, on your own Higgsfield credits.',
  'studioChat.accounts.higgsfieldMissing':
    'Not set up yet. FluidEQ can add Higgsfield’s own tools to your Claude Code and open its sign-in in your browser. Higgsfield needs a paid plan, and everything it makes uses its credits.',
  'studioChat.accounts.higgsfieldOut':
    'Higgsfield is in your Claude Code but not signed in.',
  'studioChat.accounts.higgsfieldConnector':
    'Higgsfield is connected to your Claude Code through claude.ai, and this chat can’t use a claude.ai connection. Set it up here once and sign in, and the chat can use it.',
  'studioChat.accounts.higgsfieldUnreachable':
    'Claude Code could not reach Higgsfield just now.',
  'studioChat.accounts.higgsfieldConnecting':
    'Finish signing in on Higgsfield’s page in your browser. This card updates when it is done.',
  'studioChat.accounts.higgsfieldSetUp': 'Set up Higgsfield',
  'studioChat.accounts.higgsfieldSignIn': 'Sign in with Higgsfield',
  'studioChat.accounts.higgsfieldAbout': 'What is Higgsfield?',
  'studioChat.accounts.checkAgain': 'Check again',
} as const;

export default studioChat;
