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

  return (
    <div className="App">
      <AppHeader />
      <AppRoutes />
    </div>
  );
}

export default App;
