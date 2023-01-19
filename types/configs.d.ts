export type ConfigName = 'social-picker' | 'telegram';

export type SocialPickerConfig = {
  secure: boolean;
  hostname: string;
  port: number;
};

export type TelegramConfig = {
  BOT_TOKEN: string;
  BOT_USERNAME: string;
  ADMIN: {
    id: number;
    username: string;
  };
  CHATS_LIST: {
    id: number;
    name: string;
    enabled: boolean;
    welcome?:
      | {
          type: 'text';
          message: string;
        }
      | {
          type: 'gif';
          message:
            | {
                filename: string;
                caption: string;
              }
            | {
                file_id: string;
                caption: string;
              };
        };
  }[];
  PRIVILEGE_LIST: (string | number)[];
  BLACKLIST: (string | number)[];
  SPECIAL_STICKERS_SET: string;
  SPECIAL_PHRASE: {
    regexp: string;
    sticker: string;
    gif: string;
  };
  LOCAL_BOT_API_SERVER: {
    hostname: string;
    port: number;
  };
};

export type GenericConfig<T extends ConfigName> = T extends 'social-picker'
  ? SocialPickerConfig
  : T extends 'telegram'
  ? TelegramConfig
  : never;
