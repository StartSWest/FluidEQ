import type {
  IForumFailure,
  TForumFailure,
} from '../../common/forum/forumTypes';

/**
 * A forum request that did not happen, carrying the one word the panel turns
 * into a sentence. Thrown inside the main process and flattened to an
 * `IForumFailure` at the bridge, so the reason survives the trip.
 */
export default class ForumError extends Error {
  readonly failure: TForumFailure;

  readonly retryAt?: number;

  readonly detail?: string;

  constructor(
    failure: TForumFailure,
    message: string,
    extra: { retryAt?: number; detail?: string } = {},
  ) {
    super(message);
    this.name = 'ForumError';
    this.failure = failure;
    this.retryAt = extra.retryAt;
    this.detail = extra.detail;
  }

  toFailure(): IForumFailure {
    return {
      failure: this.failure,
      ...(this.retryAt === undefined ? {} : { retryAt: this.retryAt }),
      ...(this.detail === undefined ? {} : { detail: this.detail }),
    };
  }
}
