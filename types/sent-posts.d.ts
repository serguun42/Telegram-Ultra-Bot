export type SentPost = {
  messageId: number;
  senderId: number;
  /** ID of parent media group (only if part of media group) */
  mediaGroupId?: string;
  timestamp: number;
  readySpoiler: import('./spoilers').Spoiler;
};

export type SentPostsStorage = SentPost[];
