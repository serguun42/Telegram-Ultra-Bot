export type SpoilerTypeEnum = 'animation' | 'photo' | 'video' | 'text';

export type Spoiler = {
  id: string;
  type: SpoilerTypeEnum;
  /** Full ID of media or text for text-only messages */
  source: string;
  /** Contains caption for media messages. `null/undefined` for text-only ones */
  caption: string | null;
};

export type SpoilersStorage = Spoiler[];
