import React from 'react';
import './App.css';
import { useAuth } from './context/AuthContext';
import LoginForm from './components/auth/LoginForm';
import AppHeader from './components/layout/AppHeader';
import AppRoutes from './routes/AppRoutes';

function App() {
  const { role, isLoadingAuth } = useAuth();

  if (isLoadingAuth) {
    return <div className="login-box">Шалгаж байна...</div>;
  }

  if (!role) {
    return <LoginForm />;
  }

  // KitchenView has its own compact header with logout — skip AppHeader for kitchen roles
  const showAppHeader = role === 'camp_manager';

  return (
    <div className="App">
      {showAppHeader && <AppHeader />}
      <AppRoutes />
    </div>
  );
}

export default App;
