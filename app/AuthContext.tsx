'use client';

import {
  createContext,
  ReactNode,
  useContext,
  useEffect,
  useState,
} from 'react';
import { TelegramUserData } from './login/page';

declare global {
  interface Window {
    Telegram?: {
      WebApp?: {
        ready: () => void;
        initData?: string;
        initDataUnsafe?: {
          user?: User;
        };
        showAlert?: (message: string) => void;
      };
    };
    onTelegramAuth?: (user: TelegramUserData) => Promise<void>;
  }
}

interface User {
  id: number;
  first_name?: string;
  username?: string;
}

interface AuthContextType {
  user: User | null;
  isTwa: boolean;
  isLoading: boolean;
}

const AuthContext = createContext<AuthContextType>({
  user: null,
  isTwa: false,
  isLoading: true,
});

export const useAuth = () => useContext(AuthContext);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [isTwa, setIsTwa] = useState<boolean>(false);
  const [isLoading, setIsLoading] = useState<boolean>(true);

  useEffect(() => {
    const authenticate = async () => {
      if (typeof window !== 'undefined' && window.Telegram?.WebApp?.initData) {
        setIsTwa(true);
        const initData = window.Telegram.WebApp.initData;

        window.Telegram.WebApp.ready();

        const res = await fetch('/api/auth/telegram', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ initData }),
        });

        if (res.ok) {
          const userData = await res.json();
          setUser(userData);
        } else {
          const errorData = await res
            .json()
            .catch(() => ({ error: 'Неизвестная ошибка' }));
          const errorMessage =
            errorData.error || 'Ошибка авторизации через Telegram Mini App';
          console.error('TWA authentication failed:', errorData);
          if (
            typeof window !== 'undefined' &&
            window.Telegram?.WebApp?.showAlert
          )
            window.Telegram.WebApp.showAlert(errorMessage);
        }
      } else {
        setIsTwa(false);
        const res = await fetch('/api/auth/me');
        if (res.ok) {
          const userData = await res.json();
          setUser(userData);
        }
      }
      setIsLoading(false);
    };

    authenticate();
  }, []);

  return (
    <AuthContext.Provider value={{ user, isTwa, isLoading }}>
      {children}
    </AuthContext.Provider>
  );
}
