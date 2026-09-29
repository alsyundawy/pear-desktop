export interface WaitForElementOptions {
  maxRetry?: number;
  retryInterval?: number;
}

const DEFAULT_WAIT_OPTIONS: WaitForElementOptions = {
  maxRetry: -1,
  retryInterval: 100,
};

export const waitForElement = <T extends Element>(
  selector: string,
  options: WaitForElementOptions = DEFAULT_WAIT_OPTIONS,
): Promise<T> => {
  return new Promise<T>((resolve) => {
    let retryCount = 0;
    const maxRetry = options.maxRetry ?? -1;
    const retryInterval = options.retryInterval ?? 100;
    const interval = setInterval(() => {
      if (maxRetry > 0 && retryCount >= maxRetry) {
        clearInterval(interval);
        return;
      }
      const elem = document.querySelector<T>(selector);
      if (!elem) {
        retryCount++;
        return;
      }

      clearInterval(interval);
      resolve(elem);
    }, retryInterval /* ms */);
  });
};
