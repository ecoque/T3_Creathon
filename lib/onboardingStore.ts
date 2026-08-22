import { create } from 'zustand';

import type { ParticipantRole } from '../types';

type OnboardingState = {
  role: ParticipantRole | null;
  setRole: (role: ParticipantRole) => void;
};

export const useOnboardingStore = create<OnboardingState>((set) => ({
  role: null,
  setRole: (role) => set({ role }),
}));
