import { registerPlugin } from '@capacitor/core';

import type { capuchoappsmanagerPlugin } from './definitions';

const capuchoappsmanager = registerPlugin<capuchoappsmanagerPlugin>('capuchoappsmanager', {
  web: () => import('./web').then((m) => new m.capuchoappsmanagerWeb()),
});

export * from './definitions';
export { capuchoappsmanager };
