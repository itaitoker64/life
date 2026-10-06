import { create } from 'zustand';
import { getProfile, updateProfile } from '../db/profile';
import { updateExpenditureIfNeeded } from '../lib/coach';
import { today, type ISODate } from '../lib/dates';
import type { Profile } from '../db/types';

interface AppState {
  profile: Profile | null;
  ready: boolean;
  selectedDate: ISODate;
  version: number;
  init: () => Promise<void>;
  refreshProfile: () => Promise<void>;
  patchProfile: (patch: Partial<Omit<Profile, 'id'>>) => Promise<void>;
  setSelectedDate: (d: ISODate) => void;
  bump: () => void;
}

export const useApp = create<AppState>((set, get) => ({
  profile: null,
  ready: false,
  selectedDate: today(),
  version: 0,
  init: async () => {
    let profile = await getProfile();
    if (profile.onboarded) profile = await updateExpenditureIfNeeded();
    set({ profile, ready: true });
  },
  refreshProfile: async () => set({ profile: await getProfile() }),
  patchProfile: async (patch) => set({ profile: await updateProfile(patch) }),
  setSelectedDate: (selectedDate) => set({ selectedDate }),
  bump: () => set({ version: get().version + 1 }),
}));
