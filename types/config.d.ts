export interface Config {
	BOT_TOKEN: string;
	BOT_USERNAME: string
	ADMIN: {
		id: number;
		username: string;
	};
	CHATS_LIST: {
		id: number;
		name: string;
		enabled: boolean;
		welcome?: {
			type: "text";
			message: string;
		} | {
			type: "gif";
			message: {
				filename: string;
				caption: string;
			} | {
				file_id: string;
				caption: string;
			}
		}
	}[];
	WHITELIST: (string | number)[];
	BLACKLIST: (string | number)[];
	SPECIAL_PHRASE: {
		regexp: string;
		sticker: string;
		gif: string;
	};
	SPECIAL_STICKERS_SET: string;
	LOCAL_BOT_API_SERVER: {
		hostname: string;
		port: number;
	};
}