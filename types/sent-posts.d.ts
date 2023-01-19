import { InlineKeyboardMarkup } from 'typegram';

export type SentPostType = 'animation' | 'photo' | 'video' | 'text';

export type SentPost = {
  messageId: number;
  timestamp: number;
  senderId: number;
  /**
   * True if sent by bot. Saved for later versions of Telegraf/API
   * when bots will have same editing privileges as users
   */
  canEdit?: boolean;

  /** ID of parent media group (only if part of media group) */
  mediaGroupId?: string;
  type: SentPostType;
  /** Full ID of media or text for text-only messages */
  source: string;
  /** Contains caption for media messages. Undefined for text-only ones */
  caption?: string;
  keyboard?: InlineKeyboardMarkup;
};

export type SentPostsStorage = SentPost[];
