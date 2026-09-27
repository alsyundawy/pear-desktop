import { jaroWinkler } from '@skyra/jaro-winkler';

import { LRC } from '../parsers/lrc';
import { config } from '../renderer/renderer';

import type { LyricProvider, LyricResult, SearchSongInfo } from '../types';

export class LRCLib implements LyricProvider {
  readonly name = 'LRCLib';
  readonly baseUrl = 'https://lrclib.net';

  /** Fetch and validate a search URL, throwing on HTTP/type errors. */
  private async fetchSearch(url: string): Promise<LRCLIBSearchResponse> {
    const response = await fetch(url);
    if (!response.ok) {
      throw new Error(`bad HTTPStatus(${response.statusText})`);
    }

    const data = (await response.json()) as LRCLIBSearchResponse;
    if (!Array.isArray(data)) {
      throw new Error(`Expected an array, instead got ${typeof data}`);
    }

    return data;
  }

  async search({
    title,
    alternativeTitle,
    artist,
    album,
    songDuration,
    tags,
  }: SearchSongInfo): Promise<LyricResult | null> {
    const query = new URLSearchParams({
      artist_name: artist,
      track_name: title,
    });

    if (album != null) {
      query.set('album_name', album);
    }

    let data = await this.fetchSearch(
      `${this.baseUrl}/api/search?${query.toString()}`,
    );

    if (data.length === 0) {
      data = await this.searchInexact(title, alternativeTitle);
      if (data.length === 0) return null;
    }

    return this.pickBestResult(data, artist, songDuration, tags);
  }

  /** Inexact fallback: search by alternative title then original title. */
  private async searchInexact(
    title: string,
    alternativeTitle: string | undefined,
  ): Promise<LRCLIBSearchResponse> {
    if (!config()?.showLyricsEvenIfInexact) return [];

    const trackName = alternativeTitle ?? title;
    let data = await this.fetchSearch(
      `${this.baseUrl}/api/search?${new URLSearchParams({ q: trackName }).toString()}`,
    );

    if (data.length === 0 && alternativeTitle) {
      data = await this.fetchSearch(
        `${this.baseUrl}/api/search?${new URLSearchParams({ q: title }).toString()}`,
      );
    }

    return data;
  }

  /** Filter by artist similarity, sort by duration proximity, return best. */
  private pickBestResult(
    data: LRCLIBSearchResponse,
    artist: string,
    songDuration: number,
    tags: string[] | undefined,
  ): LyricResult | null {
    const filteredResults: LRCLIBSearchResponse = [];

    for (const item of data) {
      const ratio = this.bestArtistRatio(artist, item.artistName, tags);
      if (ratio <= 0.9) continue;
      filteredResults.push(item);
    }

    const sortedResults = filteredResults
      .slice()
      .sort(
        (
          { duration: durationA }: { duration: number },
          { duration: durationB }: { duration: number },
        ) => {
          return (
            Math.abs(durationA - songDuration) -
            Math.abs(durationB - songDuration)
          );
        },
      );

    const closestResult = sortedResults[0];
    if (!closestResult) return null;
    if (Math.abs(closestResult.duration - songDuration) > 15) return null;
    if (closestResult.instrumental) return null;

    const raw = closestResult.syncedLyrics;
    const plain = closestResult.plainLyrics;
    if (!raw && !plain) return null;

    return {
      title: closestResult.trackName,
      artists: closestResult.artistName.split(/[&,]/g),
      lines: raw
        ? LRC.parse(raw).lines.map((l) => ({
            ...l,
            status: 'upcoming' as const,
          }))
        : undefined,
      lyrics: plain,
    };
  }

  /** Compute the best Jaro-Winkler ratio between artist strings (+ optional tags). */
  private bestArtistRatio(
    artist: string,
    itemArtistName: string,
    tags: string[] | undefined,
  ): number {
    const artists = artist.split(/[&,]/g).map((i) => i.trim());
    const itemArtists = itemArtistName.split(/[&,]/g).map((i) => i.trim());

    const directRatio = bestPairRatio(artists, itemArtists);
    if (directRatio > 0.9 || !tags || tags.length === 0) {
      return directRatio;
    }

    const filteredTags = tags.filter(
      (tag) => tag.toLowerCase() !== artist.toLowerCase(),
    );
    if (filteredTags.length === 0) return directRatio;

    const tagRatio = bestPairRatio(filteredTags, itemArtists);
    return Math.max(directRatio, tagRatio);
  }
}

/** Cartesian-product max Jaro-Winkler between two string arrays. */
function bestPairRatio(a: string[], b: string[]): number {
  let best = 0;
  for (const x of a) {
    for (const y of b) {
      const r = jaroWinkler(x.toLowerCase(), y.toLowerCase());
      if (r > best) best = r;
    }
  }
  return best;
}

type LRCLIBSearchResponse = {
  id: number;
  name: string;
  trackName: string;
  artistName: string;
  albumName: string;
  duration: number;
  instrumental: boolean;
  plainLyrics: string;
  syncedLyrics: string;
}[];
