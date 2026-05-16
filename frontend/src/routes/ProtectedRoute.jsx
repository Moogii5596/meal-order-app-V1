import React from 'react';
import { useAuth } from '../context/AuthContext';

function ProtectedRoute({
  children,
  allowedRoles
}) {

  const { role, isLoadingAuth } = useAuth();

  // Loading
  if (isLoadingAuth) {
    return (
      <div className="login-box">
        Шалгаж байна...
      </div>
    );
  }

  // Not logged in
  if (!role) {
    return (
      <div className="login-box">
        Нэвтрэх шаардлагатай
      </div>
    );
  }

  // Forbidden
  if (
    allowedRoles &&
    !allowedRoles.includes(role)
  ) {
    return null;
  }

  return children;
}

export default ProtectedRoute;