import { isSongMatch } from './matcher';

import { LRC } from '../parsers/lrc';

import type { LyricProvider, LyricResult, SearchSongInfo } from '../types';

const removeNoiseBrackets = /\[[^\]\r\n]{0,200}\]/g; // NOSONAR(typescript:S5852)
const removeNoiseParens = /\([^)\r\n]{0,200}\)/g; // NOSONAR(typescript:S5852)

const removeNoise = (text: string): string => {
  let cleaned = text
    .replace(removeNoiseBrackets, '')
    .replace(removeNoiseParens, '')
    .trim();

  if (cleaned.startsWith('-') || cleaned.startsWith('•')) {
    cleaned = cleaned.slice(1).trim();
  }
  if (cleaned.endsWith('-') || cleaned.endsWith('•')) {
    cleaned = cleaned.slice(0, -1).trim();
  }
  if (cleaned.endsWith(' by')) {
    cleaned = cleaned.slice(0, -3).trim();
  }
  return cleaned;
};

// Non-backtracking separator patterns (unnamed groups: positional-only)
const featPattern = /\(?[Ff]eat\. ([^)]+)\)?/;
const separatorPattern =
  /([^\u2022\r\n-]{1,200}) [\u2022-] ([^\u2022\r\n-]{1,200})/; // NOSONAR(typescript:S5852)
const byPattern = /([^\r\n]{1,200}) by ([^\r\n]{1,200})/; // NOSONAR(typescript:S5852)
const titleRegex = /\[(?<minutes>\d+):(?<seconds>\d+)\.(?<millis>\d+)\]/;
const artistSplitRegex = /[&,]/;

export class Megalobiz implements LyricProvider {
  public readonly name = 'Megalobiz';
  public readonly baseUrl = 'https://www.megalobiz.com';
  private readonly domParser = new DOMParser();

  // prettier-ignore
  async search({ title, alternativeTitle, artist, songDuration }: SearchSongInfo): Promise<LyricResult | null> {
    const query = new URLSearchParams({
      qry: `${artist} ${title}`,
    });

    const response = await fetch(`${this.baseUrl}/search/all?${query}`, {
      signal: AbortSignal.timeout(5_000),
    });
    if (!response.ok) {
      return null;
    }

    const data = await response.text();
    const searchDoc = this.domParser.parseFromString(data, 'text/html');

    // prettier-ignore
    const searchResults: MegalobizSearchResult[] = Array.prototype.map
      .call(searchDoc.querySelectorAll('a.entity_name[href^="/lrc/maker/"][name][title]'),
        (anchor: HTMLAnchorElement) => {
          const titleAttr = anchor.getAttribute('title')!;
          const durationMatch = titleRegex.exec(titleAttr);
          if (!durationMatch?.groups) return null;

          const { minutes, seconds, millis } = durationMatch.groups;

          let name = anchor.getAttribute('name')!;

          const featMatch = featPattern.exec(removeNoise(name));
          const separatorMatch = separatorPattern.exec(removeNoise(name));
          const byMatch = byPattern.exec(removeNoise(name));

          const artists = [
            removeNoise(featMatch?.[1] ?? ''),
            ...(separatorMatch?.[1]?.split(artistSplitRegex)?.map(removeNoise) ?? []),
            ...(byMatch?.[2]?.split(artistSplitRegex)?.map(removeNoise) ?? []),
          ].filter(Boolean);

          for (const a of artists) {
            name = name.replace(a, '');
            name = removeNoise(name);
          }

          const joinedArtists = artists.join(', ');
          if (!isSongMatch(title, alternativeTitle, artist, name, joinedArtists)) return null;

          return {
            title: name,
            artists,
            href: anchor.getAttribute('href')!,
            duration:
              ((Number.parseInt(minutes, 10) * 60) +
              Number.parseInt(seconds, 10)) +
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

    if (
      !isSongMatch(
        title,
        alternativeTitle,
        artist,
        closestResult.title,
        closestResult.artists.join(', '),
      )
    ) {
      return null;
    }

    const pageResponse = await fetch(`${this.baseUrl}${closestResult.href}`, {
      signal: AbortSignal.timeout(5_000),
    });
    if (!pageResponse.ok) return null;
    const html = await pageResponse.text();
    const lyricsDoc = this.domParser.parseFromString(html, 'text/html');
    const raw = lyricsDoc.querySelector('span[id^="lrc_"][id$="_lyrics"]')?.textContent;
    if (!raw) return null;

    const lyrics = LRC.parse(raw);

    return {
      title: closestResult.title,
      artists: closestResult.artists,
      lines: lyrics.lines.map((l) => ({ ...l, status: 'upcoming' as const })),
    };
  }
}

interface MegalobizSearchResult {
  title: string;
  artists: string[];
  href: string;
  duration: number;
}
