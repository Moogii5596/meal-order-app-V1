import React, { useState } from 'react';
import './App.css';
import { useAuth }
  from './context/AuthContext';
import AppRoutes
  from './routes/AppRoutes';
const ROLE_LABELS = {
  kitchen_staff: 'Хоолны захиалагч',
  category_manager: 'Хоолны захиалга хянагч ТН',
  camp_manager: 'Кемп менежер',
};

function App() {

  const {
    role,
    login,
    logout
  } = useAuth();

  const [loginName, setLoginName] =
    useState('');

  const [loginPass, setLoginPass] =
    useState('');

  // LOGIN
  const handleLogin = async () => {

    try {

      await login(
        loginName,
        loginPass
      );

    } catch (err) {

      alert(err.message);

    }

  };

  // LOGIN SCREEN
  if (!role) {

    return (
      <div className="login-box">

        <h1>Camp Meal Login</h1>

        <input
          type="text"
          placeholder="Нэвтрэх нэр"
          value={loginName}
          onChange={e =>
            setLoginName(e.target.value)
          }
          onKeyDown={e =>
            e.key === 'Enter' &&
            handleLogin()
          }
        />

        <input
          type="password"
          placeholder="Нууц үг"
          value={loginPass}
          onChange={e =>
            setLoginPass(e.target.value)
          }
          onKeyDown={e =>
            e.key === 'Enter' &&
            handleLogin()
          }
        />

        <button
          className="login-btn"
          onClick={handleLogin}
        >
          Нэвтрэх
        </button>

      </div>
    );

  }

  return (
    <div className="App">

      <div className="App-header">

        <div className="header-row">

          <div>

            <h1>
              Хоолны захиалга
            </h1>

            <span className="role-badge">
              {ROLE_LABELS[role]}
            </span>

          </div>

          <button
            className="logout-btn"
            onClick={logout}
          >
            Гарах
          </button>

        </div>

      </div>

      <AppRoutes />

    </div>
  );
}
export default App;