import { isSongMatch } from './matcher';

import { LRC } from '../parsers/lrc';

import type { LyricProvider, LyricResult, SearchSongInfo } from '../types';

const preloadedStateRegex = /__PRELOADED_STATE__ = JSON\.parse\('(.*?)'\);/;
const preloadHtmlRegex = /body":\{"html":"(.*?)","children"/;

const escapeMap: Record<string, string> = {
  '/': '/',
  '\\': '\\',
  'n': '\n',
  "'": "'",
  '"': '"',
};

export class LyricsGenius implements LyricProvider {
  public readonly name = 'Genius';
  public readonly baseUrl = 'https://genius.com';
  private readonly domParser = new DOMParser();

  private async fetchMatchingHit(
    title: string,
    alternativeTitle: string | undefined,
    artist: string,
  ): Promise<Hit | null> {
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

    return matchingHits.at(0) ?? null;
  }

  private async extractLyricsHtml(path: string): Promise<string | null> {
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

    const rawState = preloadedStateScript?.textContent;
    const stateMatch = rawState ? preloadedStateRegex.exec(rawState) : null;
    const preloadedState = stateMatch?.[1]?.replaceAll(String.raw`\"`, '"');

    const htmlMatch = preloadedState
      ? preloadHtmlRegex.exec(preloadedState)
      : null;
    const lyricsHtml = htmlMatch?.[1]?.replace(
      /\\([/\\'"n])/g,
      (_match, ch: string) => escapeMap[ch] ?? ch,
    );

    const hasUnreleasedPlaceholder =
      preloadedState &&
      /lyricsPlaceholderReason.{1,5}unreleased/.test(preloadedState);

    if (!lyricsHtml) {
      if (hasUnreleasedPlaceholder) return null;
      throw new TypeError('Failed to extract lyrics from preloaded state.');
    }

    return lyricsHtml;
  }

  private stripFooterNoise(rawText: string): string {
    let result = rawText;
    const likeIdx = result.indexOf('You might also like');
    if (likeIdx !== -1) {
      result = result.slice(0, likeIdx);
    }

    let searchStart = 0;
    while (searchStart < result.length) {
      const seeIdx = result.indexOf('See ', searchStart);
      if (seeIdx === -1) break;
      const newlineIdx = result.indexOf('\n', seeIdx);
      const endOfLine = newlineIdx === -1 ? result.length : newlineIdx;
      const lineSnippet = result.slice(seeIdx, endOfLine);
      if (lineSnippet.toLowerCase().includes(' live')) {
        result = result.slice(0, seeIdx);
        break;
      }
      searchStart = seeIdx + 4;
    }

    result = result.trim();
    if (result.toLowerCase().endsWith('embed')) {
      let cutIdx = result.length - 5;
      while (cutIdx > 0) {
        const code = result.codePointAt(cutIdx - 1);
        if (code !== undefined && code >= 48 && code <= 57) {
          cutIdx--;
        } else {
          break;
        }
      }
      result = result.slice(0, cutIdx).trim();
    }

    return result;
  }

  private cleanRawLyrics(lyricsHtml: string): string | null {
    const processedHtml = lyricsHtml
      .replace(/<br\s*\/?>/gi, '\n')
      .replace(/<\/(p|div)>/gi, '\n');
    const lyricsDoc = this.domParser.parseFromString(
      processedHtml,
      'text/html',
    );
    let rawLyrics =
      lyricsDoc.body.textContent ?? lyricsDoc.body.innerText ?? '';

    // Strip header annotations
    const headerMatch = /^\d+\s*Contributors[^\n]*?Lyrics\s*/i.exec(rawLyrics);
    if (headerMatch) {
      rawLyrics = rawLyrics.slice(headerMatch[0].length);
    }

    rawLyrics = this.stripFooterNoise(rawLyrics);

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
        const lowerL = l.toLowerCase();
        if (
          lowerL === 'embed' ||
          (lowerL.endsWith('embed') &&
            !Number.isNaN(Number(lowerL.slice(0, -5))))
        ) {
          return false;
        }
        if (!l && !arr[i - 1]?.trim()) return false;
        return true;
      });

    const cleanedLyrics = cleanedLines.join('\n').trim();

    if (cleanedLyrics.toLowerCase().replace(/[[\]]/g, '') === 'instrumental') {
      return null;
    }

    return cleanedLyrics || null;
  }

  // prettier-ignore
  async search({ title, alternativeTitle, artist }: SearchSongInfo): Promise<LyricResult | null> {
    const closestHit = await this.fetchMatchingHit(title, alternativeTitle, artist);
    if (!closestHit) {
      return null;
    }

    const lyricsHtml = await this.extractLyricsHtml(closestHit.result.path);
    if (!lyricsHtml) {
      return null;
    }

    const cleanedLyrics = this.cleanRawLyrics(lyricsHtml);
    if (!cleanedLyrics) {
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
  hits: Hit[];
}

interface Hit {
  highlights: unknown[];
  index: string;
  type: string;
  result: Result;
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
