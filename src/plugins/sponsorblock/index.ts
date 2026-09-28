import is from 'electron-is';

import { t } from '@/i18n';
import { type MenuTemplate } from '@/menu';
import { createPlugin } from '@/utils';

import { sortSegments } from './segments';

import type { Segment, SkipSegment } from './types';
import type { GetPlayerResponse } from '@/types/get-player-response';

export type SponsorBlockCategory =
  | 'sponsor'
  | 'intro'
  | 'outro'
  | 'interaction'
  | 'selfpromo'
  | 'music_offtopic'
  | 'preview'
  | 'filler';

export type SponsorBlockPluginConfig = {
  enabled: boolean;
  apiURL: string;
  categories: SponsorBlockCategory[];
};

let currentSegments: Segment[] = [];

export default createPlugin({
  name: () => t('plugins.sponsorblock.name'),
  description: () => t('plugins.sponsorblock.description'),
  restartNeeded: true,
  config: {
    enabled: false,
    apiURL: 'https://sponsor.ajay.app',
    categories: [
      'sponsor',
      'intro',
      'outro',
      'interaction',
      'selfpromo',
      'music_offtopic',
      'preview',
      'filler',
    ],
  } as SponsorBlockPluginConfig,
  menu: async ({ getConfig, setConfig }): Promise<MenuTemplate> => {
    const config = await getConfig();

    const categoryList: SponsorBlockCategory[] = [
      'sponsor',
      'intro',
      'outro',
      'interaction',
      'selfpromo',
      'music_offtopic',
      'preview',
      'filler',
    ];

    return [
      {
        label: t('plugins.sponsorblock.menu.categories.label'),
        submenu: categoryList.map((category) => ({
          label: t(`plugins.sponsorblock.menu.categories.${category}`),
          type: 'checkbox',
          checked: config.categories.includes(category),
          click(item) {
            const current = new Set(config.categories);
            if (item.checked) {
              current.add(category);
            } else {
              current.delete(category);
            }
            setConfig({ categories: Array.from(current) });
          },
        })),
      },
    ];
  },
  backend({ getConfig, ipc }) {
    const fetchSegments = async (
      apiURL: string,
      categories: string[],
      videoId: string,
    ) => {
      if (!videoId || categories.length === 0) {
        return [];
      }

      const sponsorBlockURL = `${apiURL}/api/skipSegments?videoID=${encodeURIComponent(
        videoId,
      )}&categories=${encodeURIComponent(JSON.stringify(categories))}`;
      try {
        const resp = await fetch(sponsorBlockURL, {
          method: 'GET',
          headers: {
            'Content-Type': 'application/json',
          },
          redirect: 'follow',
        });
        if (resp.status !== 200) {
          return [];
        }

        const segments = (await resp.json()) as SkipSegment[];
        return sortSegments(segments.map((submission) => submission.segment));
      } catch (error) {
        if (is.dev()) {
          console.log('error on sponsorblock request:', error);
        }

        return [];
      }
    };

    ipc.on('peard:video-src-changed', async (data: GetPlayerResponse) => {
      const config = await getConfig();
      const videoId = data?.videoDetails?.videoId;
      if (!videoId) {
        ipc.send('sponsorblock-skip', []);
        return;
      }
      const segments = await fetchSegments(
        config.apiURL,
        config.categories,
        videoId,
      );
      ipc.send('sponsorblock-skip', segments);
    });
  },
  renderer: {
    timeUpdateListener: (e: Event) => {
      if (e.target instanceof HTMLVideoElement) {
        const target = e.target;

        for (const segment of currentSegments) {
          if (
            target.currentTime >= segment[0] &&
            target.currentTime < segment[1]
          ) {
            target.currentTime = segment[1];
            if (window.electronIs?.dev?.() ?? false) {
              console.log('SponsorBlock: skipping segment', segment);
            }
          }
        }
      }
    },
    resetSegments: () => (currentSegments = []),
    start({ ipc }) {
      ipc.on('sponsorblock-skip', (segments: Segment[]) => {
        currentSegments = segments;
      });
    },
    onPlayerApiReady() {
      const video = document.querySelector<HTMLVideoElement>('video');
      if (!video) return;

      video.addEventListener('timeupdate', this.timeUpdateListener);
      // Reset segments on song end
      video.addEventListener('emptied', this.resetSegments);
    },
    stop() {
      currentSegments = [];
      const video = document.querySelector<HTMLVideoElement>('video');
      if (!video) return;

      video.removeEventListener('timeupdate', this.timeUpdateListener);
      video.removeEventListener('emptied', this.resetSegments);
    },
  },
});
