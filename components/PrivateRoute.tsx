
import React from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import Loading from './ui/Loading';

interface PrivateRouteProps {
  children: React.ReactNode;
  requiredRole?: 'ADMIN' | 'STUDENT';
}

const PrivateRoute: React.FC<PrivateRouteProps> = ({ children, requiredRole }) => {
  const { currentUser, userRole, loading } = useAuth();
  const location = useLocation();

  // CRITICAL: Return ONLY the loading component while auth is initializing.
  // Mixing return types or conditional hooks here causes React errors.
  if (loading) {
    return <Loading />;
  }

  // After loading is done, check for user presence
  if (!currentUser) {
    return <Navigate to="/login" state={{ from: location }} replace />;
  }

  // Check for role authorization if strictly required
  if (requiredRole) {
    if (requiredRole === 'ADMIN') {
        // Admin routes are accessible by ADMIN, COLLABORATOR, SELLER and COPRODUTOR
        if (userRole !== 'ADMIN' && userRole !== 'COLLABORATOR' && userRole !== 'SELLER' && userRole !== 'COPRODUTOR') {
            return <Navigate to="/app/home" replace />;
        }
    } else if (requiredRole === 'STUDENT') {
        // Student routes are accessible by STUDENT
        if (userRole !== 'STUDENT') {
            return <Navigate to="/admin/planos" replace />;
        }
    }
  }

  // If all checks pass, render the protected content
  return <>{children}</>;
};

export default PrivateRoute;
