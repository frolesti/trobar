import React, { createContext, useState, useContext, ReactNode } from 'react';

// Tipus d'usuari bàsic
interface User {
  id: string;
  name: string;
  email: string;
  avatar?: string;
}

interface AuthContextType {
  user: User | null;
  isLoading: boolean;
  login: () => Promise<void>; // Simularem el login
  logout: () => Promise<void>;
  isAuthenticated: boolean;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider = ({ children }: { children: ReactNode }) => {
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  // Funció simulada de Login (en el futur connectaria amb Firebase/Google)
  const login = async () => {
    setIsLoading(true);
    // Simulem retard de xarxa
    setTimeout(() => {
      setUser({
        id: '123',
        name: 'Joan D.',
        email: 'joan@example.com',
        avatar: 'https://i.pravatar.cc/150?u=a042581f4e29026704d',
      });
      setIsLoading(false);
    }, 1500);
  };

  const logout = async () => {
    setIsLoading(true);
    setTimeout(() => {
      setUser(null);
      setIsLoading(false);
    }, 500);
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        isLoading,
        login,
        logout,
        isAuthenticated: !!user,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};
