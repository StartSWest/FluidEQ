/**
 * Visualizers, in the Plus tab: the gallery of scenes Plus members publish,
 * a scene's page, a maker's page, the member's own published scenes and the
 * report dialog. The Studio's side of publishing is in `studio.ts`.
 */
const plus = {
  'plus.visualizers.title': 'Visualizers',
  'plus.visualizers.description':
    'Scenes Plus members made, to add to your looks and like',
  'plus.visualizers.blurb': 'Scenes members made',

  'plus.gate.cta': 'See Plus',
  'plus.browse.text':
    'Plus plays these scenes on your music, adds them to your looks and lets you like them.',

  'plus.gallery.search': 'Search scenes or makers',
  'plus.gallery.sort': 'Sort',
  'plus.gallery.sort.liked': 'Most liked',
  'plus.gallery.sort.week': 'This week',
  'plus.gallery.sort.new': 'Newest',
  'plus.gallery.categories': 'Categories',
  'plus.gallery.all': 'All',
  'plus.gallery.mine': 'Your scenes',
  'plus.gallery.more': 'Show more',
  'plus.gallery.loading': 'Loading scenes…',
  'plus.gallery.empty.title': 'No scenes here yet',
  'plus.gallery.empty.body':
    'Make one in the Studio and publish it. It will be the first.',
  'plus.gallery.empty.search': 'Nothing matches "{query}".',
  'plus.gallery.empty.category': 'No scenes in this category yet.',
  'plus.gallery.empty.openStudio': 'Open the Studio',
  'plus.gallery.error.offline':
    'The gallery needs a connection. Try again online.',
  'plus.gallery.error.signedOut': 'Sign in again to see the gallery.',
  'plus.gallery.error.server': 'The gallery could not be loaded. Try again.',
  'plus.gallery.retry': 'Try again',

  'plus.category.nature': 'Nature',
  'plus.category.cities': 'Cities',
  'plus.category.space': 'Space',
  'plus.category.water': 'Water',
  'plus.category.fire-light': 'Fire and light',
  'plus.category.retro-games': 'Retro games',
  'plus.category.animals': 'Animals',
  'plus.category.abstract': 'Abstract',
  'plus.category.worlds-3d': '3D worlds',

  'plus.card.by': 'by {name}',
  'plus.card.byYou': 'by you',
  'plus.card.anonymous': 'a Plus member',
  'plus.card.adds': '{count} added',
  'plus.card.add': 'Add',
  'plus.card.added': 'Added',
  'plus.card.update': 'Update',
  'plus.card.open': 'Open {name}',

  'plus.like.label': 'Like {name} ({count} likes)',
  'plus.like.own': 'Your scene has {count} likes',
  'plus.like.plusOnly': '{count} likes. Liking scenes is part of Plus.',
  'plus.like.offline': 'Liking needs a connection. Try again online.',

  'plus.add.done': '{name} is in your looks.',
  'plus.add.unavailable':
    '{name} could not be downloaded right now. Try again.',
  'plus.add.blocked': '{name} has been taken down.',
  'plus.add.changed':
    '{name} did not pass FluidEQ’s check, so it was not added.',
  'plus.add.failed': '{name} could not be added. Try again.',

  'plus.scene.back': 'Back',
  'plus.scene.previous': 'Previous scene: {name}',
  'plus.scene.next': 'Next scene: {name}',
  'plus.scene.loading': 'Downloading the scene…',
  'plus.scene.playing': 'Playing on your music',
  'plus.scene.plusPlays': 'With Plus, this scene plays here on your music',
  'plus.scene.unavailable': 'This scene cannot be downloaded right now.',
  'plus.scene.blocked': 'This scene has been taken down.',
  'plus.scene.changed':
    'This scene did not pass FluidEQ’s check, so it will not play.',
  'plus.scene.heavy': 'This scene is too heavy for this computer.',
  'plus.scene.broken': 'This scene does not play on this computer.',
  'plus.scene.cannotDraw': 'This computer can’t draw scenes right now.',
  'plus.scene.likes': 'Likes',
  'plus.scene.week': 'This week',
  'plus.scene.adds': 'Added',
  'plus.scene.add': 'Add to my looks',
  'plus.scene.update': 'Update my copy',
  'plus.scene.getPlus': 'Get Plus to add it',
  'plus.scene.play': 'Play on the graph',
  'plus.scene.inLooks': 'In your looks, under Made by members',
  'plus.scene.inLooksOwn': 'In your looks, under Made by you',
  'plus.scene.fine':
    'Added scenes play from your looks while you have Plus. Nobody can sell them.',
  'plus.scene.report': 'Report this scene',
  'plus.scene.reported': 'Reported. Thank you.',
  'plus.scene.moreBy': 'More by {name}',
  'plus.scene.moreByYou': 'More by you',

  'plus.maker.you': 'You',
  'plus.maker.rank': 'Rank',
  'plus.maker.scenes': 'Scenes',
  'plus.maker.empty': 'Nothing published right now.',

  'plus.mine.title': 'Your scenes',
  'plus.mine.hint':
    'To publish a scene or update one, open its project in the Studio and press Publish.',
  'plus.mine.openStudio': 'Open the Studio',
  'plus.mine.empty': 'You have not published anything yet.',
  'plus.mine.published': 'Published {date}',
  'plus.mine.updated': 'Updated {date}',
  'plus.mine.version': 'Version {version}',
  'plus.mine.blocked': 'Taken down by FluidEQ',
  'plus.mine.unpublish': 'Unpublish',
  'plus.mine.confirm':
    'Take it out of the gallery? Members who added it keep their copy.',
  'plus.mine.confirmYes': 'Unpublish',
  'plus.mine.confirmNo': 'Keep it',
  'plus.mine.unpublished': '{name} is no longer in the gallery.',
  'plus.mine.failed': 'It could not be unpublished. Try again.',

  'plus.report.title': 'Report {name}',
  'plus.report.lead':
    'What is wrong with it? Only the maker of FluidEQ reads reports.',
  'plus.report.reason.rights':
    'It uses my work, or someone else’s, without permission',
  'plus.report.reason.flashing': 'It flashes or is hard to watch',
  'plus.report.reason.offensive': 'It is offensive',
  'plus.report.reason.broken': 'It does not play',
  'plus.report.send': 'Send report',
  'plus.report.sending': 'Sending…',
  'plus.report.cancel': 'Cancel',
  'plus.report.failed': 'The report could not be sent. Try again.',
} as const;

export default plus;
