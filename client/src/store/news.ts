
import { atom } from 'recoil';

export const newsViewActive = atom<boolean>({
    key: 'newsViewActive',
    default: false,
});
