import { useAuth } from "@/contexts/AuthContext";
import { useEffect, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";

interface AuthRedirectProps {
  children: React.ReactNode;
}

const AuthRedirect = ({ children }: AuthRedirectProps) => {
  const { isAuthenticated, loading: authLoading, checkStoredAuth } = useAuth();
  const [isChecking, setIsChecking] = useState(true);
  const navigate = useNavigate();
  const location = useLocation();

  useEffect(() => {
    const checkAuth = async () => {
      // Try to load auth state from storage if not already authenticated
      if (!isAuthenticated) {
        await checkStoredAuth();
      }
      setIsChecking(false);
    };

    checkAuth();
  }, [isAuthenticated, checkStoredAuth]);

  useEffect(() => {
    // Only redirect after we've checked auth status and not on login page
    if (
      !isChecking &&
      !authLoading &&
      !isAuthenticated &&
      location.pathname !== "/login"
    ) {
      navigate("/login", { replace: true });
    }
  }, [isAuthenticated, navigate, location.pathname, isChecking, authLoading]);

  // Show loading state while checking auth
  if (isChecking || authLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
      </div>
    );
  }

  return <>{children}</>;
};

export default AuthRedirect;
