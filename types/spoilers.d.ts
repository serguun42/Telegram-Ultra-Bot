export type SpoilerTypeEnum = 'animation' | 'photo' | 'video' | 'text' | 'group';

type SingleSpoiler = {
  id: string;
  type: Exclude<SpoilerTypeEnum, 'group'>;
  /** Full ID of media or text for text-only messages */
  source: string;
  /** Contains caption for media messages. `null/undefined` for text-only ones */
  caption?: string;
};

type GroupSpoiler = {
  id: string;
  type: 'group';
  items: SingleSpoiler[];
};

export type Spoiler = SingleSpoiler | GroupSpoiler;

export type SpoilersStorage = Spoiler[];
