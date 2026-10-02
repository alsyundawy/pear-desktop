import { isSongMatch } from './matcher';

import type { LyricProvider, LyricResult, SearchSongInfo } from '../types';

const preloadedStateRegex = /__PRELOADED_STATE__ = JSON\.parse\('(.*?)'\);/;
const preloadHtmlRegex = /body":\{"html":"(.*?)","children"/;

function unescapeAndDecode(text: string): string {
  let cleaned = text
    .replaceAll(String.raw`\r\n`, '\n')
    .replaceAll(String.raw`\n`, '\n')
    .replaceAll(String.raw`\r`, '\n')
    .replaceAll(String.raw`\t`, ' ')
    .replaceAll(String.raw`\"`, '"')
    .replaceAll(String.raw`\'`, "'")
    .replaceAll(String.raw`\\`, '\\');

  cleaned = cleaned
    .replaceAll('&amp;', '&')
    .replaceAll('&lt;', '<')
    .replaceAll('&gt;', '>')
    .replaceAll('&quot;', '"')
    .replaceAll('&#x27;', "'")
    .replaceAll('&#39;', "'");

  return cleaned.replaceAll('\r\n', '\n').replaceAll('\r', '\n');
}

function isHeaderLine(line: string): boolean {
  if (line.startsWith('[') && line.endsWith(']')) {
    const inner = line.slice(1, -1).toLowerCase();
    const keywords = [
      'lyrics',
      '가사',
      '歌詞',
      'paroles',
      'letras',
      'tekst',
      'songtext',
    ];
    return keywords.some((kw) => inner.includes(kw));
  }
  return line.toLowerCase().endsWith('lyrics');
}

function stripHeaderLines(lines: string[]): void {
  while (lines.length > 0) {
    const first = lines[0];
    if (!first || isHeaderLine(first)) {
      lines.shift();
    } else {
      break;
    }
  }
}

function isFooterArtifact(line: string): boolean {
  const lower = line.toLowerCase();
  return (
    lower.endsWith('embed') ||
    lower.startsWith('you might also like') ||
    lower.includes('share urlcopyembedcopy')
  );
}

function stripEmbedSuffix(line: string): string {
  if (line.toLowerCase().endsWith('embed')) {
    let i = line.length - 5;
    while (i > 0 && line[i - 1] >= '0' && line[i - 1] <= '9') {
      i--;
    }
    return line.slice(0, i).trim();
  }
  return line;
}

function stripFooterLines(lines: string[]): void {
  while (lines.length > 0) {
    const last = lines.at(-1);
    if (!last || isFooterArtifact(last)) {
      lines.pop();
    } else {
      const lastIndex = lines.length - 1;
      lines[lastIndex] = stripEmbedSuffix(last);
      break;
    }
  }
}

function normalizeEmptyLines(lines: string[]): string[] {
  const result: string[] = [];
  let wasEmpty = false;
  for (const line of lines) {
    if (!line) {
      if (!wasEmpty) {
        result.push('');
        wasEmpty = true;
      }
    } else {
      result.push(line);
      wasEmpty = false;
    }
  }
  return result;
}

function cleanGeniusLyrics(text: string): string {
  if (!text) return '';

  const cleaned = unescapeAndDecode(text);
  const lines = cleaned.split('\n').map((l) => l.trim());

  stripHeaderLines(lines);
  stripFooterLines(lines);

  return normalizeEmptyLines(lines).join('\n').trim();
}

export class LyricsGenius implements LyricProvider {
  public readonly name = 'Genius';
  public readonly baseUrl = 'https://genius.com';
  private readonly domParser = new DOMParser();

  private extractRawLyrics(doc: Document): string | null {
    const containers = doc.querySelectorAll<HTMLElement>(
      '[data-lyrics-container="true"]',
    );
    if (containers.length > 0) {
      const parts: string[] = [];
      containers.forEach((container) => {
        const clone = container.cloneNode(true) as HTMLElement;
        clone.querySelectorAll('br').forEach((br) => br.replaceWith('\n'));
        parts.push(clone.textContent ?? '');
      });
      const domLyrics = parts.join('\n');
      if (domLyrics.trim()) {
        return domLyrics;
      }
    }

    const preloadedStateScript = Array.prototype.find.call(
      doc.querySelectorAll('script'),
      (script: HTMLScriptElement) => {
        return script.textContent?.includes('window.__PRELOADED_STATE__');
      },
    ) as HTMLScriptElement | undefined;

    const rawState = preloadedStateScript?.textContent;
    const stateMatch = rawState ? preloadedStateRegex.exec(rawState) : null;
    const preloadedState = stateMatch?.[1]?.replaceAll(String.raw`\"`, '"');

    const escapeMap: Record<string, string> = {
      '/': '/',
      '\\': '\\',
      'n': '\n',
      "'": "'",
      '"': '"',
    };
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

    const lyricsDoc = this.domParser.parseFromString(lyricsHtml, 'text/html');
    lyricsDoc.querySelectorAll('br').forEach((br) => br.replaceWith('\n'));
    return lyricsDoc.body.textContent ?? lyricsDoc.body.innerText;
  }

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

    const rawLyrics = this.extractRawLyrics(doc);
    if (!rawLyrics) {
      return null;
    }

    const lyrics = cleanGeniusLyrics(rawLyrics);

    if (lyrics.trim().toLowerCase().replace(/[[\]]/g, '') === 'instrumental') {
      return null;
    }

    return {
      title: closestHit.result.title,
      artists: closestHit.result.primary_artists.map(({ name }) => name),
      lyrics,
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
