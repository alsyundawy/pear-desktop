import { isSongMatch } from './matcher';

import { LRC } from '../parsers/lrc';
import { config } from '../renderer/renderer';

import type { LyricProvider, LyricResult, SearchSongInfo } from '../types';

export class LRCLib implements LyricProvider {
  readonly name = 'LRCLib';
  readonly baseUrl = 'https://lrclib.net';

  private async querySearch(
    query: URLSearchParams,
  ): Promise<LRCLIBSearchResponse> {
    const url = `${this.baseUrl}/api/search?${query.toString()}`;
    const response = await fetch(url);

    if (!response.ok) {
      throw new Error(`bad HTTPStatus(${response.statusText})`);
    }

    const data: unknown = await response.json();
    if (!Array.isArray(data)) {
      throw new TypeError(`Expected an array, instead got ${typeof data}`);
    }

    return data as LRCLIBSearchResponse;
  }

  async search({
    title,
    alternativeTitle,
    artist,
    album,
    songDuration,
  }: SearchSongInfo): Promise<LyricResult | null> {
    const query = new URLSearchParams({
      artist_name: artist,
      track_name: title,
    });

    if (album && album !== 'undefined') {
      query.set('album_name', album);
    }

    let data = await this.querySearch(query);

    if (data.length === 0) {
      if (!config()?.showLyricsEvenIfInexact) {
        return null;
      }

      // Try to search with the alternative title (original language) + artist
      const trackName = alternativeTitle || title;
      data = await this.querySearch(
        new URLSearchParams({ q: `${trackName} ${artist}`.trim() }),
      );

      // If still no results, try with the original title + artist as fallback
      if (data.length === 0 && alternativeTitle) {
        data = await this.querySearch(
          new URLSearchParams({ q: `${title} ${artist}`.trim() }),
        );
      }
    }

    const filteredResults = [];
    for (const item of data) {
      if (!item.trackName || !item.artistName) continue;

      // Strictly enforce track and artist matching
      if (
        !isSongMatch(
          title,
          alternativeTitle,
          artist,
          item.trackName,
          item.artistName,
        )
      ) {
        continue;
      }

      filteredResults.push(item);
    }

    filteredResults.sort(({ duration: durationA }, { duration: durationB }) => {
      const left = Math.abs(durationA - songDuration);
      const right = Math.abs(durationB - songDuration);

      return left - right;
    });

    const closestResult = filteredResults[0];
    if (
      !closestResult ||
      !isSongMatch(
        title,
        alternativeTitle,
        artist,
        closestResult.trackName,
        closestResult.artistName,
      )
    ) {
      return null;
    }

    if (Math.abs(closestResult.duration - songDuration) > 15) {
      return null;
    }

    if (closestResult.instrumental) {
      return null;
    }

    const raw = closestResult.syncedLyrics;
    const plain = closestResult.plainLyrics;
    if (!raw && !plain) {
      return null;
    }

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
