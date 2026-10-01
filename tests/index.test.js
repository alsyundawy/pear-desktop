import path from 'node:path';
import process from 'node:process';

import { test, expect, _electron as electron } from '@playwright/test';

process.env.NODE_ENV = 'test';

const appPath = path.resolve(import.meta.dirname, '..');

test('Pear Desktop App - With default settings, app is launched and visible', async () => {
  test.setTimeout(60000);
  const app = await electron.launch({
    cwd: appPath,
    env: {
      ...process.env,
      NODE_ENV: 'test',
    },
    args: [
      appPath,
      ...(process.platform === 'linux'
        ? [
            '--no-sandbox',
            '--disable-gpu',
            '--whitelisted-ips=',
            '--disable-dev-shm-usage',
          ]
        : []),
    ],
  });

  const window = await app.firstWindow({ timeout: 60000 });

  const consentForm = await window.$(
    "form[action='https://consent.\u0079\u006f\u0075\u0074\u0075\u0062\u0065.com/save']",
  );
  if (consentForm) {
    await consentForm.click('button');
  }

  // const title = await window.title();
  // expect(title.replaceAll(/\s/g, ' ')).toEqual('Pear Desktop');

  const parsedUrl = new URL(window.url());
  expect(parsedUrl.origin).toBe(
    'https://music.\u0079\u006f\u0075\u0074\u0075\u0062\u0065.com',
  );

  await app.close();
});
