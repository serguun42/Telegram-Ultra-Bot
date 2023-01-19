import { Telegram } from 'telegraf';
import { TelegramConfig } from './configs';
import { DefaultContext } from './telegraf';

type TextCommands = 'help' | 'start' | 'aboutpicker' | 'aboutlist' | 'aboutspoiler' | 'aboutdelete' | 'testcommand';
type ActionCommands = 'delete' | 'spoiler' | 'khaleesi' | 'chebotarb';
export type CommandName = TextCommands | ActionCommands;

export type CommandResult<T extends CommandName> = T extends TextCommands
  ? string
  : T extends ActionCommands
  ? (ctx: DefaultContext) => void
  : never;

export type CommandsStorage = {
  [key in CommandName]: CommandResult<key>;
};
