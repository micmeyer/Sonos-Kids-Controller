import { Media } from "./media";

export interface Artist {
  name: string;
  albumCount: number;
  cover: string;
  coverMedia: Media;
}
