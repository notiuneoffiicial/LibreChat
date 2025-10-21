import { atom } from 'recoil';

const voiceModeActive = atom<boolean>({
  key: 'voiceModeActive',
  default: false,
});

export default {
  voiceModeActive,
};
