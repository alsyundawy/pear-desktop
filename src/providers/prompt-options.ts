import trayIcon from '@assets/tray.png?asset&asarUnpack';

const promptOptions = {
  customStylesheet: 'dark',
  icon: trayIcon,
};

const getPromptOptions = () => promptOptions;
export default getPromptOptions;
