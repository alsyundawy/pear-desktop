import musicPlayerIcon from '@assets/icon.png?asset&asarUnpack';
import { nativeImage, type NativeImage, TouchBar } from 'electron';

import { t } from '@/i18n';
import { restart } from '@/providers/app-controls';
import { getSongControls } from '@/providers/song-controls';
import {
  getCurrentSongInfo,
  registerCallback,
  type SongInfo,
  type SongInfoCallback,
  SongInfoEvent,
  unregisterCallback,
} from '@/providers/song-info';
import { Platform } from '@/types/plugins';
import { createPlugin } from '@/utils';

export default createPlugin<
  {
    callback?: SongInfoCallback;
  },
  unknown,
  unknown
>({
  name: () => t('plugins.touchbar.name'),
  description: () => t('plugins.touchbar.description'),
  restartNeeded: true,
  platform: Platform.macOS,
  config: {
    enabled: false,
  },
  menu: () => [
    {
      label: t('main.menu.navigation.submenu.restart'),
      click: restart,
    },
  ],
  backend: {
    callback: undefined,
    start({ window }) {
      const {
        TouchBarButton,
        TouchBarLabel,
        TouchBarSpacer,
        TouchBarSegmentedControl,
        TouchBarScrubber,
      } = TouchBar;

      // Songtitle label
      const songTitle = new TouchBarLabel({
        label: '',
      });
      // This will store the song controls once available
      let controls: (() => void)[] = [];

      // This will store the song image once available
      const songImage: {
        icon?: NativeImage;
      } = {};

      // Pause/play button
      const pausePlayButton = new TouchBarButton({
        label: '▶️',
      });

      // The song control buttons (control functions are in the same order)
      const buttons = new TouchBarSegmentedControl({
        mode: 'buttons',
        segments: [
          new TouchBarButton({
            label: '⏮',
          }),
          pausePlayButton,
          new TouchBarButton({
            label: '⏭',
          }),
          new TouchBarButton({
            label: '👎',
          }),
          new TouchBarButton({
            label: '👍',
          }),
        ],
        change: (i) => {
          controls[i]?.();
        },
      });

      // This is the touchbar object, this combines everything with proper layout
      const touchBar = new TouchBar({
        items: [
          new TouchBarScrubber({
            items: [songImage, songTitle],
            continuous: false,
          }),
          new TouchBarSpacer({
            size: 'flexible',
          }),
          buttons,
        ],
      });

      const { playPause, next, previous, dislike, like } =
        getSongControls(window);
      controls = [previous, playPause, next, dislike, like];

      const updateTouchBar = (songInfo: SongInfo) => {
        songTitle.label = songInfo.title || '';
        pausePlayButton.label = songInfo.isPaused ? '▶️' : '⏸';

        songImage.icon = (
          songInfo.image
            ? songInfo.image
            : nativeImage.createFromPath(musicPlayerIcon)
        ).resize({ height: 23 });

        window.setTouchBar(touchBar);
      };

      const setupTouchBar = () => {
        const currentSong = getCurrentSongInfo();
        if (currentSong) {
          updateTouchBar(currentSong);
        } else {
          songImage.icon = nativeImage
            .createFromPath(musicPlayerIcon)
            .resize({ height: 23 });
          window.setTouchBar(touchBar);
        }
      };

      if (window.isVisible() || !window.webContents.isLoading()) {
        setupTouchBar();
      } else {
        window.once('ready-to-show', setupTouchBar);
      }

      this.callback = (songInfo, event) => {
        if (event === SongInfoEvent.TimeChanged) return;
        updateTouchBar(songInfo);
      };
      registerCallback(this.callback);
    },
    stop({ window }) {
      if (this.callback) {
        unregisterCallback(this.callback);
        this.callback = undefined;
      }
      window.setTouchBar(null);
    },
  },
});
