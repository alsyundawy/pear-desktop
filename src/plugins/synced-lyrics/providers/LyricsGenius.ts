import { isSongMatch } from './matcher';

import { LRC } from '../parsers/lrc';

import type { LyricProvider, LyricResult, SearchSongInfo } from '../types';

const preloadedStateRegex = /__PRELOADED_STATE__ = JSON\.parse\('(.*?)'\);/;
const preloadHtmlRegex = /body":\{"html":"(.*?)","children"/;

export class LyricsGenius implements LyricProvider {
  public readonly name = 'Genius';
  public readonly baseUrl = 'https://genius.com';
  private readonly domParser = new DOMParser();

  // prettier-ignore
  async search({ title, alternativeTitle, artist }: SearchSongInfo): Promise<LyricResult | null> {
    const query = new URLSearchParams({
      q: `${artist} ${title}`,
      page: '1',
      per_page: '10',
    });

    const response = await fetch(`${this.baseUrl}/api/search/song?${query}`);
    if (!response.ok) {
      return null;
    }

    const data = (await response.json()) as LyricsGeniusSearch;
    const hits = data?.response?.sections?.[0]?.hits;
    if (!Array.isArray(hits) || hits.length === 0) {
      return null;
    }

    const matchingHits = hits.filter((hit) => {
      const res = hit?.result;
      if (
        !res?.title ||
        !res.primary_artist?.name ||
        res.primary_artist.url === 'https://genius.com/artists/Deleted-artist'
      ) {
        return false;
      }

      return isSongMatch(
        title,
        alternativeTitle,
        artist,
        res.title,
        res.primary_artist.name,
      );
    });

    const closestHit = matchingHits.at(0);
    if (!closestHit) {
      return null;
    }

    const { result: { path } } = closestHit;

    const html = await fetch(`${this.baseUrl}${path}`).then((res) =>
      res.text(),
    );
    const doc = this.domParser.parseFromString(html, 'text/html');

    const preloadedStateScript = Array.prototype.find.call(
      doc.querySelectorAll('script'),
      (script: HTMLScriptElement) => {
        return script.textContent?.includes('window.__PRELOADED_STATE__');
      },
    ) as HTMLScriptElement;

    const rawState = preloadedStateScript.textContent;
    const stateMatch = rawState ? preloadedStateRegex.exec(rawState) : null;
    const preloadedState = stateMatch?.[1]?.replaceAll(String.raw`\"`, '"');

    const escapeMap: Record<string, string> = {
      '/': '/',
      '\\': '\\',
      'n': '\n',
      "'": "'",
      '"': '"',
    };
    const htmlMatch = preloadedState ? preloadHtmlRegex.exec(preloadedState) : null;
    const lyricsHtml = htmlMatch?.[1]?.replace(
      /\\([/\\'"n])/g,
      (_match, ch: string) => escapeMap[ch] ?? ch,
    );

    const hasUnreleasedPlaceholder = preloadedState &&
      /lyricsPlaceholderReason.{1,5}unreleased/.test(preloadedState);
    if (!lyricsHtml) {
      if (hasUnreleasedPlaceholder) return null;
      throw new TypeError('Failed to extract lyrics from preloaded state.');
    }

    const processedHtml = lyricsHtml
      .replace(/<br\s*\/?>/gi, '\n')
      .replace(/<\/(p|div)>/gi, '\n');
    const lyricsDoc = this.domParser.parseFromString(processedHtml, 'text/html');
    let rawLyrics =
      lyricsDoc.body.textContent ?? lyricsDoc.body.innerText ?? '';

    // Strip header annotations
    const headerMatch = /^\d+\s*Contributors[^\n]*?Lyrics\s*/i.exec(rawLyrics);
    if (headerMatch) {
      rawLyrics = rawLyrics.slice(headerMatch[0].length);
    }

    // Strip footer noise without backtracking
    const likeIdx = rawLyrics.indexOf('You might also like');
    if (likeIdx !== -1) {
      rawLyrics = rawLyrics.slice(0, likeIdx);
    }
    const seeLiveIdx = rawLyrics.search(/See\s+[^\n\r]+\s+Live/i);
    if (seeLiveIdx !== -1) {
      rawLyrics = rawLyrics.slice(0, seeLiveIdx);
    }
    rawLyrics = rawLyrics.replace(/\d*Embed$/i, '').trim();

    const cleanedLines = rawLyrics
      .split('\n')
      .map((l) => l.trim())
      .filter((l, i, arr) => {
        if (i === 0 && /^\d+\s*Contributors/i.test(l)) return false;
        if (
          /^(Translations|Romanization|English Translation).*Lyrics$/i.test(l)
        ) {
          return false;
        }
        if (/^\d*Embed$/i.test(l)) return false;
        if (!l && !arr[i - 1]?.trim()) return false;
        return true;
      });

    const cleanedLyrics = cleanedLines.join('\n').trim();

    if (
      cleanedLyrics.toLowerCase().replace(/[[\]]/g, '') === 'instrumental'
    ) {
      return null;
    }

    const parsedLrc = LRC.parse(cleanedLyrics);
    const hasSync = parsedLrc.lines.some((l) => l.timeInMs > 0);
    const syncedLines = hasSync
      ? parsedLrc.lines.map((l) => ({
          ...l,
          status: 'upcoming' as const,
        }))
      : undefined;

    return {
      title: closestHit.result.title,
      artists: closestHit.result.primary_artists.map(({ name }) => name),
      lines: syncedLines,
      lyrics: cleanedLyrics,
    };
  }
}

interface LyricsGeniusSearch {
  response: Response;
}

interface Response {
  sections: Section[];
}

interface Section {
  hits: {
    highlights: unknown[];
    index: string;
    type: string;
    result: Result;
  }[];
}

interface Result {
  api_path: string;
  artist_names: string;
  full_title: string;
  id: number;
  instrumental: boolean;
  path: string;
  release_date_components: ReleaseDateComponents;
  title: string;
  title_with_featured: string;
  updated_by_human_at: number;
  url: string;
  featured_artists: Artist[];
  primary_artist: Artist;
  primary_artists: Artist[];
}

interface Artist {
  api_path: string;
  id: number;
  image_url: string;
  name: string;
  slug: string;
  url: string;
}

interface ReleaseDateComponents {
  year: number;
  month: number;
  day: number;
}
