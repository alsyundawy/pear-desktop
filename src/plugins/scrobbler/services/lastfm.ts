import crypto from 'node:crypto';

import { BrowserWindow, dialog, net } from 'electron';

import { ScrobblerBase } from './base';

import { t } from '@/i18n';

import type { ScrobblerPluginConfig } from '../index';
import type { SetConfType } from '../main';
import type { SongInfo } from '@/providers/song-info';

interface LastFmData {
  method: string;
  timestamp?: number;
}

interface LastFmSongData {
  track?: string;
  duration?: number;
  artist?: string;
  album?: string;
  api_key: string;
  sk?: string;
  format: string;
  method: string;
  timestamp?: number;
  api_sig?: string;
}

export class LastFmScrobbler extends ScrobblerBase {
  mainWindow: BrowserWindow;

  constructor(mainWindow: BrowserWindow) {
    super();

    this.mainWindow = mainWindow;
  }

  override isSessionCreated(config: ScrobblerPluginConfig): boolean {
    return !!config.scrobblers.lastfm.sessionKey;
  }

  override async createSession(
    config: ScrobblerPluginConfig,
    setConfig: SetConfType,
  ): Promise<ScrobblerPluginConfig> {
    // Get and store the session key
    const data = {
      api_key: config.scrobblers.lastfm.apiKey,
      format: 'json',
      method: 'auth.getsession',
      token: config.scrobblers.lastfm.token,
    };
    const apiSignature = createApiSig(data, config.scrobblers.lastfm.secret);
    const response = await net.fetch(
      `${config.scrobblers.lastfm.apiRoot}${createQueryString(data, apiSignature)}`,
    );
    const json = (await response.json()) as {
      error?: string;
      session?: {
        key: string;
      };
    };
    if (json.error) {
      config.scrobblers.lastfm.token = await createToken(config);
      // If is successful, we need retry the request
      try {
        const authenticated = await authenticate(config, this.mainWindow);
        if (authenticated) {
          await this.createSession(config, setConfig);
        } else {
          await setConfig(config);
        }
      } catch (err: unknown) {
        console.error('Failed to authenticate with Last.fm:', err);
      }
    }
    if (json.session) {
      config.scrobblers.lastfm.sessionKey = json.session.key;
    }
    await setConfig(config);
    return config;
  }

  override setNowPlaying(
    songInfo: SongInfo,
    config: ScrobblerPluginConfig,
    setConfig: SetConfType,
  ): void {
    if (!config.scrobblers.lastfm.sessionKey) {
      return;
    }

    // This sets the now playing status in last.fm
    const data = {
      method: 'track.updateNowPlaying',
    };
    this.postSongDataToAPI(songInfo, config, data, setConfig).catch(
      (err: unknown) => {
        console.error('Failed to update now playing in Last.fm:', err);
      },
    );
  }

  override addScrobble(
    songInfo: SongInfo,
    config: ScrobblerPluginConfig,
    setConfig: SetConfType,
  ): void {
    if (!config.scrobblers.lastfm.sessionKey) {
      return;
    }

    // This adds one scrobbled song to last.fm
    const data = {
      method: 'track.scrobble',
      timestamp: Math.trunc(
        (Date.now() - (songInfo.elapsedSeconds ?? 0)) / 1000,
      ),
    };
    this.postSongDataToAPI(songInfo, config, data, setConfig).catch(
      (err: unknown) => {
        console.error('Failed to post scrobble to Last.fm:', err);
      },
    );
  }

  private async postSongDataToAPI(
    songInfo: SongInfo,
    config: ScrobblerPluginConfig,
    data: LastFmData,
    setConfig: SetConfType,
  ): Promise<void> {
    // This sends a post request to the api, and adds the common data
    if (!config.scrobblers.lastfm.sessionKey) {
      await this.createSession(config, setConfig);
    }

    const title =
      config.alternativeTitles && songInfo.alternativeTitle !== undefined
        ? songInfo.alternativeTitle
        : songInfo.title;

    const artist =
      config.alternativeArtist && songInfo.tags?.at(0) !== undefined
        ? songInfo.tags?.at(0)
        : songInfo.artist;

    const postData: LastFmSongData = {
      track: title,
      duration: songInfo.songDuration,
      artist: artist,
      ...(songInfo.album ? { album: songInfo.album } : undefined), // Will be undefined if current song is a video
      api_key: config.scrobblers.lastfm.apiKey,
      sk: config.scrobblers.lastfm.sessionKey,
      format: 'json',
      ...data,
    };

    postData.api_sig = createApiSig(postData, config.scrobblers.lastfm.secret);
    const formData = createFormData(postData);
    try {
      await net.fetch('https://ws.audioscrobbler.com/2.0/', {
        method: 'POST',
        body: formData,
      });
    } catch (error: unknown) {
      const err = error as {
        response?: {
          data?: {
            error: number;
          };
        };
      };
      if (err?.response?.data?.error === 9) {
        // Session key is invalid, so remove it from the config and reauthenticate
        config.scrobblers.lastfm.sessionKey = undefined;
        config.scrobblers.lastfm.token = await createToken(config);
        try {
          const authenticated = await authenticate(config, this.mainWindow);
          if (authenticated) {
            await this.createSession(config, setConfig);
          } else {
            await setConfig(config);
          }
        } catch (authErr: unknown) {
          console.error('Failed to reauthenticate with Last.fm:', authErr);
        }
      } else {
        console.error('Failed to post song data to Last.fm:', error);
      }
    }
  }
}

const createFormData = (parameters: LastFmSongData) => {
  // Creates the body for in the post request
  const formData = new URLSearchParams();
  for (const key in parameters) {
    formData.append(key, String(parameters[key as keyof LastFmSongData]));
  }

  return formData;
};

const createQueryString = (
  parameters: Record<string, unknown>,
  apiSignature: string,
) => {
  // Creates a querystring
  const queryData = [];
  parameters.api_sig = apiSignature;
  for (const key in parameters) {
    queryData.push(
      `${encodeURIComponent(key)}=${encodeURIComponent(
        String(parameters[key]),
      )}`,
    );
  }

  return '?' + queryData.join('&');
};

const createApiSig = (parameters: LastFmSongData, secret: string) => {
  // This function creates the api signature, see: https://www.last.fm/api/authspec
  let sig = '';

  Object.entries(parameters)
    .sort(([a], [b]) => a.localeCompare(b))
    .forEach(([key, value]) => {
      if (key === 'format') {
        return;
      }
      sig += key + value;
    });

  sig += secret;
  // NOSONAR: Last.fm API specification requires MD5 hash for api_sig (not for sensitive data)
  sig = crypto.createHash('md5').update(sig, 'utf-8').digest('hex');
  return sig;
};

const createToken = async ({
  scrobblers: {
    lastfm: { apiKey, apiRoot, secret },
  },
}: ScrobblerPluginConfig) => {
  // Creates and stores the auth token
  const data: {
    method: string;
    api_key: string;
    format: string;
  } = {
    method: 'auth.gettoken',
    api_key: apiKey,
    format: 'json',
  };
  const apiSigature = createApiSig(data, secret);
  const response = await net.fetch(
    `${apiRoot}${createQueryString(data, apiSigature)}`,
  );
  const json = (await response.json()) as Record<string, string>;
  return json?.token;
};

let authPromise: Promise<boolean> | null = null;

const authenticate = async (
  config: ScrobblerPluginConfig,
  mainWindow: BrowserWindow,
): Promise<boolean> => {
  if (authPromise) {
    return authPromise;
  }

  authPromise = new Promise<boolean>((resolve) => {
    let authResult = false;
    const url = `https://www.last.fm/api/auth/?api_key=${encodeURIComponent(config.scrobblers.lastfm.apiKey ?? '')}&token=${encodeURIComponent(config.scrobblers.lastfm.token ?? '')}`;
    const browserWindow = new BrowserWindow({
      width: 500,
      height: 600,
      show: false,
      webPreferences: {
        nodeIntegration: false,
      },
      autoHideMenuBar: true,
      parent: mainWindow,
      minimizable: false,
      maximizable: false,
      paintWhenInitiallyHidden: true,
      modal: true,
      center: true,
    });
    browserWindow
      .loadURL(url)
      .then(() => {
        browserWindow.show();
      })
      .catch((err: unknown) => {
        console.error('Failed to load Last.fm auth URL:', err);
      });

    browserWindow.webContents.on('did-navigate', async (_, newUrl) => {
      try {
        const parsed = new URL(newUrl);
        if (parsed.hostname.endsWith('last.fm')) {
          if (parsed.pathname === '/api/auth') {
            const isApproveScreen =
              (await browserWindow.webContents.executeJavaScript(
                "!!document.getElementsByName('confirm').length",
              )) as boolean;
            // successful authentication
            if (!isApproveScreen) {
              authResult = true;
              resolve(true);
              browserWindow.close();
            }
          } else if (parsed.pathname === '/api/None') {
            authResult = false;
            resolve(false);
            browserWindow.close();
          }
        }
      } catch (err: unknown) {
        console.error('Failed to parse URL in Last.fm did-navigate:', err);
      }
    });

    browserWindow.on('closed', () => {
      if (!authResult) {
        dialog
          .showMessageBox({
            title: t('plugins.scrobbler.dialog.lastfm.auth-failed.title'),
            message: t('plugins.scrobbler.dialog.lastfm.auth-failed.message'),
            type: 'error',
          })
          .catch(() => {});
      }
      resolve(authResult);
    });
  }).finally(() => {
    authPromise = null;
  });

  return authPromise;
};
