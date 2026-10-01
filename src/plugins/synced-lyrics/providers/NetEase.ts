import { isSongMatch } from './matcher';

import { LRC } from '../parsers/lrc';

import type {
  LineLyrics,
  LyricProvider,
  LyricResult,
  SearchSongInfo,
} from '../types';

interface NetEaseArtist {
  name: string;
}

interface NetEaseSong {
  id: number;
  name: string;
  artists: NetEaseArtist[];
  duration: number;
}

interface NetEaseSearchResponse {
  code: number;
  result?: {
    songs?: NetEaseSong[];
  };
}

interface NetEaseLyricResponse {
  code: number;
  lrc?: {
    lyric?: string;
  };
  tlyric?: {
    lyric?: string;
  };
}

const NETEASE_HEADERS = {
  'Accept': 'application/json',
  'User-Agent':
    'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko)',
  'Referer': 'https://music.163.com',
  'X-Real-IP': '118.88.88.88',
  'X-Forwarded-For': '118.88.88.88',
};

const TIMESTAMP_REGEX = /\[\d+:\d+(?:\.\d+)?\]/g;

export class NetEase implements LyricProvider {
  public readonly name = 'NetEase';
  public readonly baseUrl = 'https://music.163.com';

  private async fetchSearch(query: string): Promise<NetEaseSong[]> {
    const params = new URLSearchParams({
      s: query,
      type: '1',
      offset: '0',
      total: 'true',
      limit: '5',
    });

    const response = await fetch(
      `${this.baseUrl}/api/search/get/web?${params.toString()}`,
      {
        headers: NETEASE_HEADERS,
        signal: AbortSignal.timeout(5_000),
      },
    );

    if (!response.ok) {
      throw new TypeError(`bad HTTPStatus(${response.statusText})`);
    }

    const data = (await response.json()) as NetEaseSearchResponse;
    return data.result?.songs ?? [];
  }

  private async fetchLyric(songId: number): Promise<string | null> {
    const response = await fetch(
      `${this.baseUrl}/api/song/lyric?os=pc&id=${songId}&lv=-1&kv=-1&tv=-1`,
      {
        headers: NETEASE_HEADERS,
        signal: AbortSignal.timeout(5_000),
      },
    );

    if (!response.ok) {
      return null;
    }

    const data = (await response.json()) as NetEaseLyricResponse;
    return data.lrc?.lyric ?? null;
  }

  private parseLrcLines(rawLrc: string): LineLyrics[] | undefined {
    const parsedLrc = LRC.parse(rawLrc);
    const hasSync = parsedLrc.lines.some((l) => l.timeInMs > 0);

    if (!hasSync) {
      return undefined;
    }

    return parsedLrc.lines.map((l) => ({
      ...l,
      status: 'upcoming' as const,
    }));
  }

  public async search({
    title,
    alternativeTitle,
    artist,
    songDuration,
  }: SearchSongInfo): Promise<LyricResult | null> {
    const query = `${artist} ${title}`.trim();
    const songs = await this.fetchSearch(query);
    if (!songs.length) {
      return null;
    }

    const matchedSongs = songs.filter((s) => {
      const artistNames = s.artists.map((a) => a.name).join(', ');
      return isSongMatch(title, alternativeTitle, artist, s.name, artistNames);
    });

    matchedSongs.sort((a, b) => {
      const aSec = Math.round(a.duration / 1000);
      const bSec = Math.round(b.duration / 1000);
      return Math.abs(aSec - songDuration) - Math.abs(bSec - songDuration);
    });

    const best = matchedSongs[0];
    if (!best) {
      return null;
    }

    if (
      songDuration > 0 &&
      Math.abs(Math.round(best.duration / 1000) - songDuration) > 15
    ) {
      return null;
    }

    const rawLrc = await this.fetchLyric(best.id);
    if (!rawLrc) {
      return null;
    }

    const plain = rawLrc.replace(TIMESTAMP_REGEX, '').trim();
    const lines = this.parseLrcLines(rawLrc);

    return {
      title: best.name,
      artists: best.artists.map((a) => a.name),
      lines,
      lyrics: plain || undefined,
    };
  }
}
