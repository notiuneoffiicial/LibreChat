import { atom } from 'recoil';
import { atomWithLocalStorage } from './utils';

const voiceModeActive = atom<boolean>({
  key: 'voiceModeActive',
  default: false,
});

const voiceSilenceDelay = atomWithLocalStorage<number>('voiceSilenceDelay', 3);

export default {
  voiceModeActive,
  voiceSilenceDelay,
};
