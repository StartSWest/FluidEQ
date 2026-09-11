/**
 * The Forum tab: the project's GitHub Discussions, read and written from the
 * app.
 *
 * Board names and descriptions are here rather than taken from GitHub so they
 * translate; a board added on GitHub later that the app has no key for shows
 * GitHub's own name. Error sentences are keyed by the one word the main
 * process sends back, so a refusal reaches the person as what they can do
 * about it.
 */
const forum = {
  'tabs.forum': 'Forum',
  'forum.title': 'Forum',
  'forum.source': 'GitHub Discussions',
  'forum.allTopics': 'All topics',
  'forum.allTopics.blurb': 'Every board, latest activity first',

  'forum.board.announcements': 'Announcements',
  'forum.board.general': 'General',
  'forum.board.ideas': 'Ideas',
  'forum.board.polls': 'Polls',
  'forum.board.qa': 'Q&A',
  'forum.board.showAndTell': 'Show and tell',
  'forum.boardDescription.announcements': 'News from the maker',
  'forum.boardDescription.general': 'Anything FluidEQ',
  'forum.boardDescription.ideas': 'What it should do next',
  'forum.boardDescription.polls': 'Vote on what comes next',
  'forum.boardDescription.qa': 'Ask, and mark the answer that worked',
  'forum.boardDescription.showAndTell': 'A tuning you are proud of',
  'forum.board.countLabel': 'Topics: {count}',

  'forum.me.signedOutTitle': 'Join the conversation',
  'forum.me.signedOutBody':
    'Reading is open to everyone. Sign in with GitHub to post and reply under your own name — no FluidEQ account needed.',
  'forum.me.waitingTitle': 'Finish in your browser',
  'forum.me.waitingBody':
    'GitHub is asking you to approve FluidEQ. Come back here once it says you are signed in.',
  'forum.me.openAgain': 'Open the page again',
  'forum.me.signedInAs': 'Signed in with GitHub',
  'forum.me.readOnlyTitle': 'Read-only in this build',
  'forum.me.readOnlyBody':
    'This copy of FluidEQ was built without a GitHub sign-in. You can still post on GitHub.',
  'forum.signIn': 'Sign in with GitHub',
  'forum.signOut': 'Sign out',
  'forum.cancel': 'Cancel',
  'forum.save': 'Save',
  'forum.retry': 'Try again',
  'forum.refresh': 'Refresh',
  'forum.loading': 'Loading…',
  'forum.openOnGithub': 'Open on GitHub',

  'forum.search.placeholder': 'Search the forum',
  'forum.search.clear': 'Clear search',
  'forum.search.heading': 'Results for “{query}”',
  'forum.newTopic': 'New topic',
  'forum.signInToPost': 'Sign in to post',
  'forum.filter.label': 'Show',
  'forum.filter.all': 'All',
  'forum.filter.answered': 'Answered',
  'forum.filter.unanswered': 'Unanswered',
  'forum.loadMore': 'Show more topics',
  'forum.feedNotice':
    'You are reading the public copy, which can trail GitHub by a few minutes.',
  'forum.empty.board': 'No topics here yet',
  'forum.empty.boardHint':
    'Start the first one — it goes straight to GitHub Discussions.',
  'forum.empty.search': 'Nothing matches that search',
  'forum.empty.searchHint': 'Try fewer words, or different ones.',

  'forum.topic.replies': 'Replies: {count}',
  'forum.topic.upvotes': 'Upvotes: {count}',
  'forum.topic.answered': 'Answered',
  'forum.topic.locked': 'Locked',

  'forum.backTo': 'Back to {board}',
  'forum.thread.replies': 'Replies',
  'forum.thread.noReplies': 'No replies yet',
  'forum.thread.noRepliesHint': 'Be the first to answer.',
  'forum.thread.loadMore': 'Show more replies',
  'forum.thread.moreOnGithub': 'The rest of this conversation is on GitHub',
  'forum.thread.moreRepliesOnGithub': 'More replies on GitHub',
  'forum.thread.locked':
    'This topic is locked. It can be read, but nobody can reply.',
  'forum.thread.editTitle': 'Edit title',
  'forum.thread.signInToReply': 'Sign in with GitHub to reply.',

  'forum.post.maker': 'Maker',
  'forum.post.maintainer': 'Maintainer',
  'forum.post.author': 'Author',
  'forum.post.answer': 'Accepted answer',
  'forum.post.edited': 'edited',
  'forum.post.hidden': 'Hidden by a moderator',
  'forum.post.show': 'Show',
  'forum.post.image': 'Open image',

  'forum.action.upvote': 'Upvote',
  'forum.action.removeUpvote': 'Remove upvote',
  'forum.action.reply': 'Reply',
  'forum.action.edit': 'Edit',
  'forum.action.delete': 'Delete',
  'forum.action.deleteConfirm': 'Delete for good',
  'forum.action.deleteQuestion': 'Delete this reply?',
  'forum.action.markAnswer': 'Mark as answer',
  'forum.action.unmarkAnswer': 'Unmark answer',

  'forum.composer.write': 'Write',
  'forum.composer.preview': 'Preview',
  'forum.composer.previewEmpty': 'Nothing to preview yet.',
  'forum.composer.replyPlaceholder': 'Write a reply…',
  'forum.composer.replyingTo': 'Replying to @{login}',
  'forum.composer.hint': 'Markdown works · {keys} posts',
  'forum.composer.imagesHint': 'Pictures and files are added on GitHub.',
  'forum.composer.postReply': 'Post reply',
  'forum.composer.posting': 'Posting…',
  'forum.composer.saveEdit': 'Save changes',
  'forum.format.bold': 'Bold',
  'forum.format.italic': 'Italic',
  'forum.format.code': 'Code',
  'forum.format.link': 'Link',
  'forum.format.quote': 'Quote',
  'forum.format.list': 'List',

  'forum.compose.title': 'Start a topic',
  'forum.compose.board': 'Board',
  'forum.compose.titleLabel': 'Title',
  'forum.compose.titlePlaceholder': 'Your question or idea, in a line',
  'forum.compose.body': 'Details',
  'forum.compose.bodyPlaceholder':
    'What were you trying to do, what did you expect, and what happened?',
  'forum.compose.submit': 'Post topic',
  'forum.compose.pollsOnGithub': 'Polls are started on GitHub.',
  'forum.compose.public':
    'Everything posted here is public on GitHub, under your GitHub name.',
  'forum.compose.guidance.qa':
    'Say which output you use, what you tried and what happened — answers come faster.',
  'forum.compose.guidance.ideas':
    'Say what you were trying to do. That, more than the idea itself, decides whether it gets built.',
  'forum.compose.guidance.showAndTell':
    'Add your .fluideq export on GitHub so others can hear exactly what you hear.',

  'forum.error.network':
    'The forum could not be reached. Check the connection and try again.',
  'forum.error.signed_out':
    'Your GitHub sign-in has ended. Sign in again to keep posting.',
  'forum.error.rate_limited':
    'GitHub is limiting requests for now. Try again after {time}.',
  'forum.error.rateLimitedSoon':
    'GitHub is limiting requests for now. Try again in a little while.',
  'forum.error.forbidden': 'GitHub did not allow that for your account.',
  'forum.error.locked': 'This topic is locked, so nobody can reply.',
  'forum.error.not_found':
    'That topic is not there any more — it may have been deleted or moved.',
  'forum.error.rejected': 'GitHub turned that down.',
  'forum.error.unconfigured': 'This build cannot sign in to GitHub.',
  'forum.error.dismiss': 'Dismiss',

  'forum.signInPage.successTitle': 'You are signed in',
  'forum.signInPage.successBody':
    'FluidEQ can now post in the forum as you. Close this tab and go back to the app.',
  'forum.signInPage.failureTitle': 'Sign-in did not finish',
  'forum.signInPage.failureBody':
    'Something went wrong between GitHub and FluidEQ. Go back to the app and try again.',
  'forum.signInPage.cancelledTitle': 'Sign-in cancelled',
  'forum.signInPage.cancelledBody':
    'Nothing was changed. You can close this tab.',
};

export default forum;
