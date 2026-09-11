/**
 * The GraphQL the forum sends, in one place so the shapes `forumModel.ts`
 * reads can be checked against what is asked for.
 *
 * Page sizes: 25 topics is two screens of the list; 50 comments with up to
 * 50 replies each is every thread this repository has by a wide margin, and a
 * thread past that pages on.
 */

const PERSON = `
fragment Person on Actor { login avatarUrl(size: 80) url }
`;

const TOPIC_SUMMARY = `
fragment TopicSummary on Discussion {
  id number title bodyText createdAt updatedAt url upvoteCount locked
  answer { id }
  category { slug }
  author { ...Person }
  comments { totalCount }
  opening: comments(first: 1) { nodes { author { ...Person } bodyText } }
}
`;

const POST_FIELDS = `
  id body bodyHTML createdAt lastEditedAt url upvoteCount isMinimized
  authorAssociation
  author { ...Person }
  viewerCanUpdate viewerCanDelete viewerCanUpvote viewerHasUpvoted
`;

export const BOARDS_QUERY = `
query ForumBoards($owner: String!, $name: String!) {
  repository(owner: $owner, name: $name) {
    id
    viewerPermission
    discussionCategories(first: 25) {
      nodes { id name slug emojiHTML description isAnswerable }
    }
  }
}
`;

/**
 * One `totalCount` per board, asked for in a single request. Aliases have to
 * be written into the document, so this one is built from the ids the boards
 * query returned.
 */
export const boardCountsQuery = (count: number): string => {
  const indexes = Array.from({ length: count }, (_, index) => index);
  const variables = indexes.map((index) => `$c${index}: ID`).join(', ');
  const fields = indexes
    .map(
      (index) =>
        `c${index}: discussions(categoryId: $c${index}) { totalCount }`,
    )
    .join('\n    ');
  return `
query ForumBoardCounts($owner: String!, $name: String!${variables ? `, ${variables}` : ''}) {
  repository(owner: $owner, name: $name) {
    ${fields}
  }
}
`;
};

export const TOPICS_QUERY = `
query ForumTopics($owner: String!, $name: String!, $cursor: String, $categoryId: ID, $answered: Boolean) {
  repository(owner: $owner, name: $name) {
    discussions(
      first: 25
      after: $cursor
      categoryId: $categoryId
      answered: $answered
      orderBy: { field: UPDATED_AT, direction: DESC }
    ) {
      totalCount
      pageInfo { hasNextPage endCursor }
      nodes { ...TopicSummary }
    }
  }
}
${TOPIC_SUMMARY}${PERSON}`;

export const SEARCH_QUERY = `
query ForumSearch($query: String!, $cursor: String) {
  search(query: $query, type: DISCUSSION, first: 25, after: $cursor) {
    discussionCount
    pageInfo { hasNextPage endCursor }
    nodes { ... on Discussion { ...TopicSummary } }
  }
}
${TOPIC_SUMMARY}${PERSON}`;

export const TOPIC_QUERY = `
query ForumTopic($owner: String!, $name: String!, $number: Int!, $cursor: String) {
  repository(owner: $owner, name: $name) {
    discussion(number: $number) {
      ...TopicSummary
      body bodyHTML lastEditedAt authorAssociation
      viewerCanUpdate viewerCanDelete viewerCanUpvote viewerHasUpvoted
      thread: comments(first: 50, after: $cursor) {
        totalCount
        pageInfo { hasNextPage endCursor }
        nodes {
          ${POST_FIELDS}
          isAnswer viewerCanMarkAsAnswer viewerCanUnmarkAsAnswer
          replies(first: 50) { totalCount nodes { ${POST_FIELDS} } }
        }
      }
    }
  }
}
${TOPIC_SUMMARY}${PERSON}`;

export const VIEWER_QUERY = `
query ForumViewer { viewer { ...Person } }
${PERSON}`;

export const CREATE_TOPIC = `
mutation ForumCreateTopic($repositoryId: ID!, $categoryId: ID!, $title: String!, $body: String!) {
  createDiscussion(input: { repositoryId: $repositoryId, categoryId: $categoryId, title: $title, body: $body }) {
    discussion { number }
  }
}
`;

// Separate documents rather than one with nullable arguments: whether GitHub
// reads an explicit null as "leave it" or as "clear it" is not documented for
// these inputs, and an omitted field has only one meaning.
export const ADD_COMMENT = `
mutation ForumComment($discussionId: ID!, $body: String!) {
  addDiscussionComment(input: { discussionId: $discussionId, body: $body }) {
    comment { id }
  }
}
`;

export const ADD_REPLY = `
mutation ForumReply($discussionId: ID!, $body: String!, $replyToId: ID!) {
  addDiscussionComment(input: { discussionId: $discussionId, body: $body, replyToId: $replyToId }) {
    comment { id }
  }
}
`;

export const UPDATE_COMMENT = `
mutation ForumEditComment($id: ID!, $body: String!) {
  updateDiscussionComment(input: { commentId: $id, body: $body }) { comment { id } }
}
`;

export const UPDATE_TOPIC_BODY = `
mutation ForumEditTopicBody($id: ID!, $body: String!) {
  updateDiscussion(input: { discussionId: $id, body: $body }) { discussion { id } }
}
`;

export const UPDATE_TOPIC_TITLE = `
mutation ForumEditTopicTitle($id: ID!, $title: String!) {
  updateDiscussion(input: { discussionId: $id, title: $title }) { discussion { id } }
}
`;

export const DELETE_COMMENT = `
mutation ForumDeleteComment($id: ID!) {
  deleteDiscussionComment(input: { id: $id }) { comment { id } }
}
`;

export const ADD_UPVOTE = `
mutation ForumUpvote($id: ID!) {
  addUpvote(input: { subjectId: $id }) { subject { upvoteCount viewerHasUpvoted } }
}
`;

export const REMOVE_UPVOTE = `
mutation ForumRemoveUpvote($id: ID!) {
  removeUpvote(input: { subjectId: $id }) { subject { upvoteCount viewerHasUpvoted } }
}
`;

export const MARK_ANSWER = `
mutation ForumMarkAnswer($id: ID!) {
  markDiscussionCommentAsAnswer(input: { id: $id }) { discussion { id } }
}
`;

export const UNMARK_ANSWER = `
mutation ForumUnmarkAnswer($id: ID!) {
  unmarkDiscussionCommentAsAnswer(input: { id: $id }) { discussion { id } }
}
`;
