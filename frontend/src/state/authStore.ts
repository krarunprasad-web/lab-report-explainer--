import { create } from "zustand";

interface AuthState {
  authed: boolean;
  email: string | null;
  pendingUploadIntent: boolean;
  hasSeenWalkthrough: boolean;
  setPendingUploadIntent: (v: boolean) => void;
  signIn: (email: string) => void;
  signOut: () => void;
  markWalkthroughSeen: () => void;
}

export const useAuthStore = create<AuthState>((set) => ({
  authed: false,
  email: null,
  pendingUploadIntent: false,
  hasSeenWalkthrough: false,
  setPendingUploadIntent: (v) => set({ pendingUploadIntent: v }),
  signIn: (email) => set({ authed: true, email }),
  signOut: () => set({ authed: false, email: null }),
  markWalkthroughSeen: () => set({ hasSeenWalkthrough: true }),
}));
