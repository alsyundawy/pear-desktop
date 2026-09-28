import { t } from '@/i18n';
import { createPlugin } from '@/utils';
import { waitForElement } from '@/utils/wait-for-element';

import type { MusicPlayer } from '@/types/music-player';

const CONFIRM_DELAY_MS = 1000;
const REARM_MS = 1500;

export default createPlugin<
  unknown,
  unknown,
  {
    dislikeBtn?: HTMLElement;
    playerApi?: MusicPlayer;
    observer?: MutationObserver;
    confirmTimer?: ReturnType<typeof setTimeout>;
    lastSkipVideoId: string;
    lastSkipTime: number;
    videoDataListener?: () => void;
    proposeSkip(): void;
    onPlayerApiReady(api: MusicPlayer): void;
    start(): void;
    stop(): void;
  }
>({
  name: () => t('plugins.skip-disliked-songs.name'),
  description: () => t('plugins.skip-disliked-songs.description'),
  restartNeeded: false,
  renderer: {
    lastSkipVideoId: '',
    lastSkipTime: 0,

    proposeSkip() {
      const { playerApi, dislikeBtn } = this;
      if (!playerApi || !dislikeBtn) return;

      const videoId = playerApi.getVideoData?.()?.video_id;
      const isRecentlySkipped =
        videoId &&
        videoId === this.lastSkipVideoId &&
        Date.now() - this.lastSkipTime < REARM_MS;

      if (!videoId || isRecentlySkipped) return;
      if (dislikeBtn.getAttribute('like-status') !== 'DISLIKE') return;

      if (this.confirmTimer) {
        clearTimeout(this.confirmTimer);
      }
      this.confirmTimer = setTimeout(() => {
        const stillDisliked =
          playerApi.getVideoData?.()?.video_id === videoId &&
          dislikeBtn.getAttribute('like-status') === 'DISLIKE';

        const stillRecentlySkipped =
          videoId === this.lastSkipVideoId &&
          Date.now() - this.lastSkipTime < REARM_MS;

        if (stillDisliked && !stillRecentlySkipped) {
          this.lastSkipVideoId = videoId;
          this.lastSkipTime = Date.now();
          playerApi.nextVideo();
        }
      }, CONFIRM_DELAY_MS);
    },

    onPlayerApiReady(api: MusicPlayer) {
      this.playerApi = api;
      this.videoDataListener = () => this.proposeSkip();
      api.addEventListener('videodatachange', this.videoDataListener);
      this.proposeSkip();
    },

    start() {
      this.observer?.disconnect();

      waitForElement<HTMLElement>('#like-button-renderer').then(
        (dislikeBtn) => {
          this.dislikeBtn = dislikeBtn;

          this.observer = new MutationObserver((mutations) => {
            if (mutations.some((m) => m.attributeName === 'like-status')) {
              this.proposeSkip();
            }
          });

          this.observer.observe(dislikeBtn, {
            attributes: true,
            childList: false,
            subtree: false,
            attributeFilter: ['like-status'],
          });

          this.proposeSkip();
        },
      );
    },

    stop() {
      this.observer?.disconnect();
      this.observer = undefined;
      if (this.confirmTimer) {
        clearTimeout(this.confirmTimer);
        this.confirmTimer = undefined;
      }
      if (this.playerApi && this.videoDataListener) {
        this.playerApi.removeEventListener(
          'videodatachange',
          this.videoDataListener,
        );
      }
      this.playerApi = undefined;
      this.dislikeBtn = undefined;
      this.lastSkipVideoId = '';
      this.lastSkipTime = 0;
    },
  },
});
