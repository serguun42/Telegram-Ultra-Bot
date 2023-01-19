import { Context, NarrowedContext, Telegraf } from 'telegraf';
import { Message, Update, InputMediaPhoto, InputMediaVideo, InputMediaAudio, InputMediaDocument, User } from 'typegram';
import { ExtraAnimation, ExtraMediaGroup, ExtraPhoto, ExtraVideo } from 'telegraf/typings/telegram-types';

export type DefaultMessage =
  | Message.TextMessage
  | Message.PhotoMessage
  | Message.VideoMessage
  | Message.AnimationMessage;

export type TelegrafInstance = Telegraf<Context<Update>>;

export type DefaultContext = NarrowedContext<Context<Update>, Update.MessageUpdate<Message>>;

export type NewMemberContext = NarrowedContext<Context<Update>, Update.MessageUpdate<Message.NewChatMembersMessage>>;

export type DefaultFrom = User;

export type DefaultExtra = ExtraPhoto & ExtraAnimation & ExtraVideo;

export type MediaGroupExtra = ExtraMediaGroup;

export type MediaGroupItems = (InputMediaPhoto | InputMediaVideo)[] | InputMediaAudio[] | InputMediaDocument[];
