export type SpoilerTypeEnum = 'animation' | 'photo' | 'video';

export type Spoiler = {
  id: string;
  type: SpoilerTypeEnum;
  source: string;
  caption: string;
};

export type SpoilersStorage = Spoiler[];
