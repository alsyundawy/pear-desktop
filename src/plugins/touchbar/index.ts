import musicPlayerIcon from '@assets/icon.png?asset&asarUnpack';
import { nativeImage, TouchBar } from 'electron';

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
      const { TouchBarButton, TouchBarLabel, TouchBarSpacer } = TouchBar;

      const defaultIcon = nativeImage
        .createFromPath(musicPlayerIcon)
        .resize({ height: 20 });

      // Album art item
      const albumArtButton = new TouchBarButton({
        icon: defaultIcon,
        backgroundColor: '#00000000',
      });

      // Song title label
      const songTitle = new TouchBarLabel({
        label: 'YouTube Music',
      });

      const controls = getSongControls(window);

      // Dedicated native TouchBar buttons with direct click handlers
      const previousButton = new TouchBarButton({
        label: '⏮',
        click: () => controls.previous(),
      });

      const playPauseButton = new TouchBarButton({
        label: '▶️',
        click: () => controls.playPause(),
      });

      const nextButton = new TouchBarButton({
        label: '⏭',
        click: () => controls.next(),
      });

      const dislikeButton = new TouchBarButton({
        label: '👎',
        click: () => controls.dislike(),
      });

      const likeButton = new TouchBarButton({
        label: '👍',
        click: () => controls.like(),
      });

      const touchBar = new TouchBar({
        items: [
          albumArtButton,
          songTitle,
          new TouchBarSpacer({ size: 'flexible' }),
          previousButton,
          playPauseButton,
          nextButton,
          dislikeButton,
          likeButton,
        ],
      });

      const updateTouchBar = (songInfo: SongInfo) => {
        const title = songInfo.title || '';
        const artist = songInfo.artist ? ` - ${songInfo.artist}` : '';
        songTitle.label = title ? `${title}${artist}` : 'YouTube Music';
        playPauseButton.label = songInfo.isPaused ? '▶️' : '⏸';

        if (songInfo.image) {
          albumArtButton.icon = songInfo.image.resize({ height: 20 });
        } else {
          albumArtButton.icon = defaultIcon;
        }

        window.setTouchBar(touchBar);
      };

      const setupTouchBar = () => {
        const currentSong = getCurrentSongInfo();
        if (currentSong) {
          updateTouchBar(currentSong);
        } else {
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
