import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import { setAuthToken, clearAuthToken } from '@/lib/api';

interface User {
  id: string;
  name: string;
  email: string;
}

interface BusinessAccount {
  id: string;
  name: string;
  industry?: string;
}

interface AuthState {
  user: User | null;
  token: string | null;
  businessAccounts: BusinessAccount[];
  currentBusinessAccount: BusinessAccount | null;
  isAuthenticated: boolean;
  setAuth: (token: string, user: User, businessAccounts: BusinessAccount[]) => void;
  setCurrentAccount: (account: BusinessAccount) => void;
  logout: () => void;
}

const safeStorage = {
  getItem: (key: string) => {
    if (typeof window === 'undefined') return null;
    return localStorage.getItem(key);
  },
  setItem: (key: string, value: string) => {
    if (typeof window === 'undefined') return;
    localStorage.setItem(key, value);
  },
  removeItem: (key: string) => {
    if (typeof window === 'undefined') return;
    localStorage.removeItem(key);
  },
};

export const useAuthStore = create<AuthState>()(
  persist(
    (set) => ({
      user: null,
      token: null,
      businessAccounts: [],
      currentBusinessAccount: null,
      isAuthenticated: false,

      setAuth: (token, user, businessAccounts) => {
        const currentBusinessAccount = businessAccounts[0] || null;
        setAuthToken(token, currentBusinessAccount?.id);
        set({ token, user, businessAccounts, currentBusinessAccount, isAuthenticated: true });
      },

      setCurrentAccount: (account) => {
        if (typeof window !== 'undefined') {
          localStorage.setItem('wrai_biz_id', account.id);
        }
        set({ currentBusinessAccount: account });
      },

      logout: () => {
        clearAuthToken();
        set({
          user: null,
          token: null,
          businessAccounts: [],
          currentBusinessAccount: null,
          isAuthenticated: false,
        });
      },
    }),
    {
      name: 'wrai-auth',
      storage: createJSONStorage(() => safeStorage),
      partialize: (state) => ({
        user: state.user,
        token: state.token,
        businessAccounts: state.businessAccounts,
        currentBusinessAccount: state.currentBusinessAccount,
        isAuthenticated: state.isAuthenticated,
      }),
    }
  )
);
