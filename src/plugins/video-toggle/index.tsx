import { createSignal, Show } from 'solid-js';
import { render } from 'solid-js/web';

import { t } from '@/i18n';
import { type MenuTemplate } from '@/menu';
import { moveVolumeHud as preciseVolumeMoveVolumeHud } from '@/plugins/precise-volume/renderer';
import { type ThumbnailElement } from '@/types/get-player-response';
import { createPlugin } from '@/utils';
import { waitForElement } from '@/utils/wait-for-element';

import buttonSwitcherStyle from './button-switcher.css?inline';
import forceHideStyle from './force-hide.css?inline';
import { VideoSwitchButton } from './templates/video-switch-button';

export type VideoTogglePluginConfig = {
  enabled: boolean;
  hideVideo: boolean;
  mode: 'custom' | 'native' | 'disabled';
  forceHide: boolean;
  align: 'left' | 'middle' | 'right';
};

export default createPlugin<
  unknown,
  unknown,
  {
    config: VideoTogglePluginConfig | null;
    switchButtonContainer: HTMLElement | null;
    playbackModeObserver: MutationObserver | null;
    thumbnailObserver: MutationObserver | null;
    videoStartedHandler: (() => void) | null;
    setVideoStateFn: ((showVideo: boolean) => void) | null;
    applyStyleClass: (config: VideoTogglePluginConfig) => void;
    updateMode: (config: VideoTogglePluginConfig) => void;
  },
  VideoTogglePluginConfig
>({
  name: () => t('plugins.video-toggle.name'),
  description: () => t('plugins.video-toggle.description'),
  restartNeeded: true,
  config: {
    enabled: true,
    hideVideo: false,
    mode: 'custom',
    forceHide: false,
    align: 'left',
  } as VideoTogglePluginConfig,
  stylesheets: [buttonSwitcherStyle, forceHideStyle],
  menu: async ({ getConfig, setConfig, restart }): Promise<MenuTemplate> => {
    const config = await getConfig();

    return [
      {
        label: t('plugins.video-toggle.menu.mode.label'),
        submenu: [
          {
            label: t('plugins.video-toggle.menu.mode.submenu.custom'),
            type: 'radio',
            checked: config.mode === 'custom',
            click() {
              setConfig({ mode: 'custom' });
            },
          },
          {
            label: t('plugins.video-toggle.menu.mode.submenu.native'),
            type: 'radio',
            checked: config.mode === 'native',
            click() {
              setConfig({ mode: 'native' });
            },
          },
          {
            label: t('plugins.video-toggle.menu.mode.submenu.disabled'),
            type: 'radio',
            checked: config.mode === 'disabled',
            click() {
              setConfig({ mode: 'disabled' });
            },
          },
        ],
      },
      {
        label: t('plugins.video-toggle.menu.align.label'),
        submenu: [
          {
            label: t('plugins.video-toggle.menu.align.submenu.left'),
            type: 'radio',
            checked: config.align === 'left',
            click() {
              setConfig({ align: 'left' });
            },
          },
          {
            label: t('plugins.video-toggle.menu.align.submenu.middle'),
            type: 'radio',
            checked: config.align === 'middle',
            click() {
              setConfig({ align: 'middle' });
            },
          },
          {
            label: t('plugins.video-toggle.menu.align.submenu.right'),
            type: 'radio',
            checked: config.align === 'right',
            click() {
              setConfig({ align: 'right' });
            },
          },
        ],
      },
      {
        label: t('plugins.video-toggle.menu.force-hide'),
        type: 'checkbox',
        checked: config.forceHide,
        click(item) {
          setConfig({ forceHide: item.checked });
        },
      },
      { type: 'separator' },
      {
        label: t('main.menu.navigation.submenu.restart'),
        click: restart,
      },
    ];
  },

  renderer: {
    config: null,
    switchButtonContainer: null,
    playbackModeObserver: null,
    thumbnailObserver: null,
    videoStartedHandler: null,
    setVideoStateFn: null,

    applyStyleClass(config: VideoTogglePluginConfig) {
      if (config.forceHide) {
        document.body.classList.add('video-toggle-force-hide');
        document.body.classList.remove('video-toggle-custom-mode');
      } else if (!config.mode || config.mode === 'custom') {
        document.body.classList.add('video-toggle-custom-mode');
        document.body.classList.remove('video-toggle-force-hide');
      } else {
        document.body.classList.remove(
          'video-toggle-force-hide',
          'video-toggle-custom-mode',
        );
      }
    },

    updateMode(config: VideoTogglePluginConfig) {
      const switchBtn =
        this.switchButtonContainer ??
        document.getElementById('ytmd-video-toggle-switch-button-container');

      if (switchBtn) {
        switchBtn.style.display =
          !config.forceHide && (!config.mode || config.mode === 'custom')
            ? 'flex'
            : 'none';

        if (
          !switchBtn.isConnected &&
          !config.forceHide &&
          (!config.mode || config.mode === 'custom')
        ) {
          const playerEl = document.querySelector('#player, ytmusic-player');
          playerEl?.prepend(switchBtn);
        }
      }

      if (config.forceHide) {
        document
          .querySelector('ytmusic-player-page')
          ?.removeAttribute('has-av-switcher');
        document
          .querySelector('ytmusic-player')
          ?.removeAttribute('has-av-switcher');
        document
          .querySelector('ytmusic-av-toggle')
          ?.setAttribute('toggle-disabled', '');
        return;
      }

      switch (config.mode) {
        case 'native': {
          document
            .querySelector('ytmusic-player-page')
            ?.setAttribute('has-av-switcher', '');
          document
            .querySelector('ytmusic-player')
            ?.setAttribute('has-av-switcher', '');
          document
            .querySelector('ytmusic-av-toggle')
            ?.removeAttribute('toggle-disabled');
          break;
        }

        case 'disabled': {
          document
            .querySelector('ytmusic-player-page')
            ?.removeAttribute('has-av-switcher');
          document
            .querySelector('ytmusic-player')
            ?.removeAttribute('has-av-switcher');
          document
            .querySelector('ytmusic-av-toggle')
            ?.setAttribute('toggle-disabled', '');
          break;
        }

        case 'custom':
        default: {
          document
            .querySelector('ytmusic-player-page')
            ?.removeAttribute('has-av-switcher');
          document
            .querySelector('ytmusic-player')
            ?.removeAttribute('has-av-switcher');
          document
            .querySelector('ytmusic-av-toggle')
            ?.setAttribute('toggle-disabled', '');
          if (this.setVideoStateFn) {
            this.setVideoStateFn(!config.hideVideo);
          }
          break;
        }
      }
    },

    async start({ getConfig }) {
      const config = await getConfig();
      this.config = config;
      this.applyStyleClass(config);
      this.updateMode(config);
    },

    async onPlayerApiReady(api, { getConfig }) {
      const [showButton, setShowButton] = createSignal(true);
      const [isVideoActive, setIsVideoActive] = createSignal(true);

      const config = await getConfig();
      this.config = config;
      this.applyStyleClass(config);

      const moveVolumeHud = (await window.mainConfig.plugins.isEnabled(
        'precise-volume',
      ))
        ? (preciseVolumeMoveVolumeHud as (_: boolean) => void)
        : () => {};

      let player = document.querySelector<
        HTMLElement & { videoMode_: boolean }
      >('ytmusic-player');
      let video = document.querySelector<HTMLVideoElement>('video');

      const switchButtonContainer = document.createElement('div');
      switchButtonContainer.id = 'ytmd-video-toggle-switch-button-container';
      switchButtonContainer.style.display =
        !config.forceHide && (!config.mode || config.mode === 'custom')
          ? 'flex'
          : 'none';
      this.switchButtonContainer = switchButtonContainer;

      const applyAlign = (align: 'left' | 'middle' | 'right') => {
        switch (align) {
          case 'right':
            switchButtonContainer.style.justifyContent = 'flex-end';
            break;
          case 'middle':
            switchButtonContainer.style.justifyContent = 'center';
            break;
          case 'left':
          default:
            switchButtonContainer.style.justifyContent = 'flex-start';
            break;
        }
      };
      applyAlign(config.align);

      render(
        () => (
          <Show when={showButton()}>
            <VideoSwitchButton
              checked={isVideoActive()}
              onChange={(e) => {
                const target = e.target as HTMLInputElement;
                setVideoState(target.checked);
              }}
              onClick={(e) => e.stopPropagation()}
              songButtonText={t('plugins.video-toggle.templates.button-song')}
              videoButtonText={t('plugins.video-toggle.templates.button-video')}
            />
          </Show>
        ),
        switchButtonContainer,
      );

      const forceThumbnail = (img?: HTMLImageElement | null) => {
        const targetImg =
          img ??
          document.querySelector<HTMLImageElement>(
            '#song-image img, #song-image #img',
          );
        if (!targetImg) return;
        const thumbnails: ThumbnailElement[] =
          api?.getPlayerResponse()?.videoDetails?.thumbnail?.thumbnails ?? [];
        if (thumbnails && thumbnails.length > 0) {
          const thumbnail = thumbnails.at(-1)?.url.split('?')[0];
          if (thumbnail) targetImg.src = thumbnail;
        }
      };

      const updatePlayerDisplay = (
        targetPlayer: HTMLElement,
        targetVideo: HTMLVideoElement | null,
        showVideo: boolean,
      ) => {
        targetPlayer.style.margin = showVideo ? '' : 'auto 0px';
        targetPlayer.setAttribute(
          'playback-mode',
          showVideo ? 'OMV_PREFERRED' : 'ATV_PREFERRED',
        );

        const songVideoElement = document.querySelector<HTMLElement>(
          '#song-video.ytmusic-player',
        );
        if (songVideoElement) {
          songVideoElement.style.display = showVideo ? 'block' : 'none';
        }

        const songImageElement =
          document.querySelector<HTMLElement>('#song-image');
        if (songImageElement) {
          songImageElement.style.display = showVideo ? 'none' : 'block';
        }

        if (showVideo && targetVideo && !targetVideo.style.top) {
          targetVideo.style.top = `${
            (targetPlayer.clientHeight - targetVideo.clientHeight) / 2
          }px`;
        }
      };

      const setVideoState = (showVideo: boolean) => {
        if (this.config) {
          this.config.hideVideo = !showVideo;
        }
        window.mainConfig.plugins.setOptions('video-toggle', this.config);
        setIsVideoActive(showVideo);

        const checkbox = document.querySelector<HTMLInputElement>(
          '#video-toggle-video-switch-button-checkbox',
        );
        if (checkbox) checkbox.checked = showVideo;

        player =
          player ??
          document.querySelector<HTMLElement & { videoMode_: boolean }>(
            'ytmusic-player',
          );
        video = video ?? document.querySelector<HTMLVideoElement>('video');

        if (player) {
          updatePlayerDisplay(player, video, showVideo);
          moveVolumeHud(showVideo);
        }
      };
      this.setVideoStateFn = setVideoState;

      const videoStarted = () => {
        const playerResponse = api?.getPlayerResponse?.();
        const musicVideoType = playerResponse?.videoDetails?.musicVideoType;

        if (musicVideoType === 'MUSIC_VIDEO_TYPE_ATV') {
          // Video doesn't exist -> switch to song mode
          setVideoState(false);
          // Hide toggle button
          setShowButton(false);
        } else {
          const songImage = document.querySelector<HTMLImageElement>(
            '#song-image img, #song-image #img',
          );
          if (songImage) {
            forceThumbnail(songImage);
          }
          // Always show toggle button when video is available
          setShowButton(true);

          // Change display to video mode if video exists & video is hidden & option.hideVideo = false
          if (
            !this.config?.hideVideo &&
            document.querySelector<HTMLElement>('#song-video.ytmusic-player')
              ?.style.display === 'none'
          ) {
            setVideoState(true);
          } else {
            moveVolumeHud(!this.config?.hideVideo);
          }
        }
      };
      this.videoStartedHandler = videoStarted;

      /**
       * On load, after a delay, the page overrides the playback-mode to 'OMV_PREFERRED' which causes weird aspect ratio in the image container
       * this function fix the problem by overriding that override :)
       */
      const forcePlaybackMode = () => {
        if (player) {
          const playbackModeObserver = new MutationObserver((mutations) => {
            for (const mutation of mutations) {
              if (mutation.target instanceof HTMLElement) {
                const target = mutation.target;
                if (target.getAttribute('playback-mode') !== 'ATV_PREFERRED') {
                  playbackModeObserver.disconnect();
                  target.setAttribute('playback-mode', 'ATV_PREFERRED');
                }
              }
            }
          });
          playbackModeObserver.observe(player, {
            attributeFilter: ['playback-mode'],
          });
          this.playbackModeObserver = playbackModeObserver;
        }
      };

      const observeThumbnail = () => {
        const thumbnailObserver = new MutationObserver((mutations) => {
          if (!player?.videoMode_) {
            return;
          }

          for (const mutation of mutations) {
            if (mutation.target instanceof HTMLImageElement) {
              const target = mutation.target;
              if (!target.src.startsWith('data:')) {
                continue;
              }

              forceThumbnail(target);
            }
          }
        });
        const thumbnailElement = document.querySelector(
          '#song-image img, #song-image #img',
        );
        if (thumbnailElement) {
          thumbnailObserver.observe(thumbnailElement, {
            attributeFilter: ['src'],
          });
          this.thumbnailObserver = thumbnailObserver;
        }
      };

      const mountSwitcher = async () => {
        const playerElement = await waitForElement<HTMLElement>(
          '#player, ytmusic-player',
        );
        if (!playerElement) return;

        if (!switchButtonContainer.isConnected) {
          playerElement.prepend(switchButtonContainer);
        }

        setVideoState(!config.hideVideo);
        forcePlaybackMode();

        video = video ?? document.querySelector<HTMLVideoElement>('video');
        if (video) {
          video.style.height = 'auto';
          video.removeEventListener('peard:src-changed', videoStarted);
          video.addEventListener('peard:src-changed', videoStarted);
        }
        observeThumbnail();
        videoStarted();
        applyAlign(this.config?.align ?? config.align);
      };

      if (config.mode !== 'native' && config.mode !== 'disabled') {
        mountSwitcher().catch(console.error);
      }
    },

    onConfigChange(newConfig) {
      const oldConfig = this.config;
      this.config = newConfig;
      this.applyStyleClass(newConfig);

      if (
        oldConfig?.mode !== newConfig.mode ||
        oldConfig?.forceHide !== newConfig.forceHide
      ) {
        this.updateMode(newConfig);
      }

      const switchButtonContainer =
        this.switchButtonContainer ??
        document.getElementById('ytmd-video-toggle-switch-button-container');

      if (switchButtonContainer) {
        switch (newConfig.align) {
          case 'right': {
            switchButtonContainer.style.justifyContent = 'flex-end';
            break;
          }
          case 'middle': {
            switchButtonContainer.style.justifyContent = 'center';
            break;
          }
          case 'left':
          default: {
            switchButtonContainer.style.justifyContent = 'flex-start';
            break;
          }
        }
      }
    },

    stop() {
      // Remove button container from DOM
      if (this.switchButtonContainer) {
        this.switchButtonContainer.remove();
        this.switchButtonContainer = null;
      } else {
        const container = document.getElementById(
          'ytmd-video-toggle-switch-button-container',
        );
        container?.remove();
      }

      // Remove body classes
      document.body.classList.remove(
        'video-toggle-force-hide',
        'video-toggle-custom-mode',
      );

      // Disconnect MutationObservers
      this.playbackModeObserver?.disconnect();
      this.playbackModeObserver = null;
      this.thumbnailObserver?.disconnect();
      this.thumbnailObserver = null;

      // Remove video event listener
      const video = document.querySelector<HTMLVideoElement>('video');
      if (video && this.videoStartedHandler) {
        video.removeEventListener(
          'peard:src-changed',
          this.videoStartedHandler,
        );
        this.videoStartedHandler = null;
      }

      // Reset DOM attributes and styles
      document
        .querySelector('ytmusic-player-page')
        ?.removeAttribute('has-av-switcher');
      document
        .querySelector('ytmusic-player')
        ?.removeAttribute('has-av-switcher');
      document
        .querySelector('ytmusic-av-toggle')
        ?.removeAttribute('toggle-disabled');

      const songVideoElement = document.querySelector<HTMLElement>(
        '#song-video.ytmusic-player',
      );
      if (songVideoElement) songVideoElement.style.display = '';

      const songImageElement =
        document.querySelector<HTMLElement>('#song-image');
      if (songImageElement) songImageElement.style.display = '';

      const player = document.querySelector<HTMLElement>('ytmusic-player');
      if (player) {
        player.style.margin = '';
        player.removeAttribute('playback-mode');
      }

      if (video) {
        video.style.height = '';
        video.style.top = '';
      }

      this.config = null;
      this.setVideoStateFn = null;
    },
  },
});
