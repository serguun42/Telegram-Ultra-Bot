export type DefaultMessage =
  | import('typegram').Message.PhotoMessage
  | import('typegram').Message.VideoMessage
  | import('typegram').Message.AnimationMessage
  | import('typegram').Message.TextMessage;

export type TelegramContext = import('telegraf').NarrowedContext<
  import('telegraf').Context,
  { message: DefaultMessage; reply_to_message?: DefaultMessage }
>;

export type TelegramFromObject = import('typegram').User;

export type DefaultExtra =
  | import('telegraf/typings/telegram-types').ExtraPhoto
  | import('telegraf/typings/telegram-types').ExtraAnimation
  | import('telegraf/typings/telegram-types').ExtraVideo;

export type MediaGroupItems =
  | (import('typegram').InputMediaPhoto | import('typegram').InputMediaVideo)[]
  | import('typegram').InputMediaAudio[]
  | import('typegram').InputMediaDocument[];
