export type SentPost = {
  messageId: number;
  senderId: number;
  mediaGroupId?: string;
  timestamp?: number;
};

export type SendersStorage = SentPost[];
