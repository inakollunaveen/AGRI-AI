import React, { createContext, useContext, useState } from 'react';

interface User {
  name: string;
  email: string;
}

interface UserInputData {
  location: string;
  landSize: string;
  landType: string;
  landHealth: string;
  season: string;
  waterFacility: string;
  duration: string;
  language?: string;
}

interface AuthContextType {
  user: User | null;
  userInputData: UserInputData | null;
  selectedCrop: string | null;
  login: (email: string, password: string) => void;
  signup: (name: string, email: string, password: string) => void;
  logout: () => void;
  saveUserInputData: (data: UserInputData) => void;
  selectCrop: (cropName: string) => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [userInputData, setUserInputData] = useState<UserInputData | null>(null);
  const [selectedCrop, setSelectedCrop] = useState<string | null>(null);

  const login = (email: string, password: string) => {
    // Simulate login - in real app, this would call an API
    setUser({ name: 'John Farmer', email });
  };

  const signup = (name: string, email: string, password: string) => {
    // Simulate signup - in real app, this would call an API
    setUser({ name, email });
  };

  const logout = () => {
    setUser(null);
    setUserInputData(null);
    setSelectedCrop(null);
    // Reset language to English on logout
    localStorage.setItem('selectedLanguage', 'en');
    localStorage.removeItem('translatedResources');
  };

  const saveUserInputData = (data: UserInputData) => {
    setUserInputData(data);
  };

  const selectCrop = (cropName: string) => {
    setSelectedCrop(cropName);
  };

  return (
    <AuthContext.Provider value={{ user, userInputData, selectedCrop, login, signup, logout, saveUserInputData, selectCrop }}>
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
