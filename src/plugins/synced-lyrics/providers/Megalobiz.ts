import { jaroWinkler } from '@skyra/jaro-winkler';

import { LRC } from '../parsers/lrc';

import type { LyricProvider, LyricResult, SearchSongInfo } from '../types';

// Simplified non-backtracking regexes (linear performance)
const FEAT_REGEX = /\((?:[Ff]eat)\. (.+)\)/;
const TITLE_ARTIST_REGEX = /(?<artists>.*?) [-•] (?<title>.*)/;
const ARTIST_TITLE_REGEX = /(?<title>.*) by (?<artists>.*)/;
const TIMESTAMP_REGEX = /\[(?<minutes>\d+):(?<seconds>\d+)\.(?<millis>\d+)\]/;

const removeNoise = (text: string) => {
  return text
    .replace(/\[.*?\]/g, '')
    .replace(/\(.*?\)/g, '')
    .trim()
    .replace(/(^[-•])|([-•]$)/g, '')
    .trim()
    .replace(/\s+by$/, '');
};

export class Megalobiz implements LyricProvider {
  public readonly name = 'Megalobiz';
  public readonly baseUrl = 'https://www.megalobiz.com';
  private readonly domParser = new DOMParser();

  // prettier-ignore
  async search({ title, artist, songDuration }: SearchSongInfo): Promise<LyricResult | null> {
    const query = new URLSearchParams({
      qry: `${artist} ${title}`,
    });

    const response = await fetch(`${this.baseUrl}/search/all?${query}`, {
      signal: AbortSignal.timeout(5_000),
    });
    if (!response.ok) {
      throw new Error(`bad HTTPStatus(${response.statusText})`);
    }

    const data = await response.text();
    const searchDoc = this.domParser.parseFromString(data, 'text/html');

    // prettier-ignore
    const searchResults: MegalobizSearchResult[] = Array.prototype.map
      .call(searchDoc.querySelectorAll('a.entity_name[href^="/lrc/maker/"][name][title]'),
        (anchor: HTMLAnchorElement) => {
          const tsMatch = TIMESTAMP_REGEX.exec(anchor.getAttribute('title')!);
          if (!tsMatch?.groups) return null;
          const { minutes, seconds, millis } = tsMatch.groups;

          let name = anchor.getAttribute('name')!;

          const artists = [
            removeNoise(FEAT_REGEX.exec(name)?.[1] ?? ''),
            ...(TITLE_ARTIST_REGEX.exec(removeNoise(name))?.groups?.artists?.split(/[&,]/)?.map(removeNoise) ?? []),
            ...(ARTIST_TITLE_REGEX.exec(removeNoise(name))?.groups?.artists?.split(/[&,]/)?.map(removeNoise) ?? []),
          ].filter(Boolean);

          for (const art of artists) {
            name = name.replace(art, '');
            name = removeNoise(name);
          }

          if (jaroWinkler(title, name) < 0.8) return null;

          return {
            title: name,
            artists,
            href: anchor.getAttribute('href')!,
            duration:
              (Number.parseInt(minutes, 10) * 60) +
              Number.parseInt(seconds, 10) +
              (Number.parseInt(millis, 10) / 1000),
          };
        },
      )
      .filter(Boolean);

    const sortedResults = searchResults.slice().sort(
      ({ duration: durationA }: MegalobizSearchResult, { duration: durationB }: MegalobizSearchResult) => {
        const left = Math.abs(durationA - songDuration);
        const right = Math.abs(durationB - songDuration);

        return left - right;
      },
    );

    const closestResult = sortedResults[0];
    if (!closestResult) return null;
    if (Math.abs(closestResult.duration - songDuration) > 15) {
      return null;
    }

    const html = await fetch(`${this.baseUrl}${closestResult.href}`).then((r) => r.text());
    const lyricsDoc = this.domParser.parseFromString(html, 'text/html');
    const raw = lyricsDoc.querySelector('span[id^="lrc_"][id$="_lyrics"]')?.textContent;
    if (!raw) throw new Error('Failed to extract lyrics from page.');

    const lyrics = LRC.parse(raw);

    return {
      title: closestResult.title,
      artists: closestResult.artists,
      lines: lyrics.lines.map((l) => ({ ...l, status: 'upcoming' })),
    };
  }
}

interface MegalobizSearchResult {
  title: string;
  artists: string[];
  href: string;
  duration: number;
}
