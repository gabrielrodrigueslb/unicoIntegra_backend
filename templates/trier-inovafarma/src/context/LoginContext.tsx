import { createContext, useEffect, useState, type ReactNode } from "react";

interface LoginContextData {
  token: string | null;
  userId: number | null;
  login: (token: string, userId: number) => void;
  logout: () => void;
  isLoading: boolean;
}

interface LoginProviderProps {
  children: ReactNode;
}

export const LoginContext = createContext({} as LoginContextData);

export function LoginProvider({ children }: LoginProviderProps) {
  const [token, setToken] = useState<string | null>(null);
  const [userId, setUserId] = useState<number | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    loadStoredCredential();
  }, []);

  const loadStoredCredential = () => {
    if (chrome?.storage?.sync) {
      chrome.storage.sync.get(["token", "userId"], (result) => {
        if (result.token && result.userId) {
          setToken(result.token);
          setUserId(result.userId);
        }
        setIsLoading(false);
      });
    } else {
      const storedToken = localStorage.getItem("token");
      const storedUserId = localStorage.getItem("userId");

      if (storedToken && storedToken) {
        setToken(storedToken);
        setUserId(Number(storedUserId));
      }
      setIsLoading(false);
    }
  };

  const login = (newToken: string, newUserId: number) => {
    setToken(newToken);
    setUserId(newUserId);

    if (chrome?.storage?.sync) {
      chrome.storage.sync.set({
        token: newToken,
        userId: newUserId,
      });
    } else {
      localStorage.setItem("token", newToken);
      localStorage.setItem("userId", newUserId.toString());
    }
  };

  const logout = () => {
    setToken(null);
    setUserId(null);

    if (chrome?.storage?.sync) {
      chrome.storage.sync.remove(["token", "userId"]);
    } else {
      localStorage.removeItem("token");
      localStorage.removeItem("userId");
    }
  };

  return (
    <LoginContext.Provider value={{ token, userId, login, logout, isLoading }}>
      {children}
    </LoginContext.Provider>
  );
}
