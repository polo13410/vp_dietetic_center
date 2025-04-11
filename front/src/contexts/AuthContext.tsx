import React, { createContext, useContext, useEffect, useState } from "react";
// Define types for our context
interface AuthContextType {
  isAuthenticated: boolean;
  user: User | null;
  login: (email: string, password: string) => Promise<boolean>;
  logout: () => void;
  checkStoredAuth: () => void;
  loading: boolean;
}
interface User {
  id: string;
  name: string;
  email: string;
  role: string;
}
// Create the context with a default value
const AuthContext = createContext<AuthContextType>({
  isAuthenticated: false,
  user: null,
  login: async () => false,
  logout: () => {},
  checkStoredAuth: () => {},
  loading: false,
});
// Create a provider component
export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({
  children,
}) => {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  // Check if user is authenticated from localStorage/cookies on startup
  useEffect(() => {
    checkStoredAuth();
  }, []);

  const checkStoredAuth = async () => {
    setLoading(true);
    try {
      // Check if auth token exists in localStorage or cookies
      const token = localStorage.getItem("authToken");
      if (token) {
        // Optionally validate the token with your API
        setIsAuthenticated(true);
      } else {
        setIsAuthenticated(false);
      }
    } catch (error) {
      console.error("Auth check failed:", error);
      setIsAuthenticated(false);
    } finally {
      setLoading(false);
    }
  };

  // Check if user is already logged in (from localStorage)
  useEffect(() => {
    const storedUser = localStorage.getItem("user");
    const token = localStorage.getItem("auth_token");
    if (storedUser && token) {
      setUser(JSON.parse(storedUser));
      setIsAuthenticated(true);
    }
  }, []);
  // Mock login functionality (would connect to your API in a real app)
  const login = async (email: string, password: string): Promise<boolean> => {
    // This is a simplified mock - in a real app, you'd validate against your API
    if (email === "admin" && password === "admin") {
      // Mock successful login
      const mockUser = {
        id: "1",
        name: "Admin User",
        email,
        role: "admin",
      };
      // Store auth data in localStorage
      localStorage.setItem("user", JSON.stringify(mockUser));
      localStorage.setItem("auth_token", "mock-jwt-token");
      setUser(mockUser);
      setIsAuthenticated(true);
      return true;
    }
    return false;
  };
  const logout = () => {
    // Clear auth data from localStorage
    localStorage.removeItem("user");
    localStorage.removeItem("auth_token");
    setUser(null);
    setIsAuthenticated(false);
  };
  return (
    <AuthContext.Provider
      value={{
        isAuthenticated,
        user,
        login,
        logout,
        checkStoredAuth,
        loading,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};
// Custom hook to use the auth context
export const useAuth = () => useContext(AuthContext);
