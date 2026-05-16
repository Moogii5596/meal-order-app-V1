import React, { useState, useEffect } from 'react';
import './App.css';

import CampManagerView from './components/camp/CampManagerView';
import KitchenView from './components/kitchen/KitchenView';
import OrdersView from './components/orders/OrdersView';

import {
  login,
  getMe,
  saveAuth,
  clearAuth
} from './services/auth';

const ROLE_LABELS = {
  kitchen_staff: 'Хоолны захиалагч',
  category_manager: 'Хоолны захиалга хянагч ТН',
  camp_manager: 'Кемп менежер',
};

function App() {
  const [role, setRole] = useState(null);
  const [token, setToken] = useState(null);
  const [userDept, setUserDept] = useState(null);
  const [userLocation, setUserLocation] = useState(null);

  const [loginName, setLoginName] = useState('');
  const [loginPass, setLoginPass] = useState('');

  const [isLoadingAuth, setIsLoadingAuth] = useState(true);

  // ─────────────────────────────
  // AUTH CHECK
  // ─────────────────────────────
  useEffect(() => {
    const storedToken = localStorage.getItem('authToken');

    if (!storedToken) {
      setIsLoadingAuth(false);
      return;
    }

    getMe(storedToken)
      .then(data => {
        if (data.role) {
          setToken(storedToken);
          setRole(data.role);

          if (data.dept_id) {
            setUserDept({
              id: String(data.dept_id),
              name: data.dept_name
            });
          }

          if (data.location) {
            setUserLocation(data.location);
          }
        } else {
          clearAuth();
        }
      })
      .catch(() => {
        clearAuth();
      })
      .finally(() => {
        setIsLoadingAuth(false);
      });

  }, []);

  // ─────────────────────────────
  // LOGIN
  // ─────────────────────────────
  const handleLogin = () => {
    login(loginName, loginPass)
      .then(data => {
        if (data.success) {

          setRole(data.role);
          setToken(data.token);

          if (data.dept_id) {
            setUserDept({
              id: String(data.dept_id),
              name: data.dept_name
            });
          }

          if (data.location) {
            setUserLocation(data.location);
          }

          saveAuth(data);

        } else {
          alert('Нэвтрэх нэр эсвэл нууц үг буруу байна');
        }
      })
      .catch(() => {
        alert('Сервертэй холбогдож чадсангүй');
      });
  };

  // ─────────────────────────────
  // LOGOUT
  // ─────────────────────────────
  const handleLogout = () => {
    setRole(null);
    setToken(null);
    setUserDept(null);
    setUserLocation(null);

    clearAuth();
  };

  // ─────────────────────────────
  // LOADING
  // ─────────────────────────────
  if (isLoadingAuth) {
    return (
      <div className="login-box">
        <h1>Camp Meal Login</h1>
        <div className="empty-state">
          Шалгаж байна...
        </div>
      </div>
    );
  }

  // ─────────────────────────────
  // LOGIN SCREEN
  // ─────────────────────────────
  if (!role) {
    return (
      <div className="login-box">

        <h1>Camp Meal Login</h1>

        <input
          type="text"
          placeholder="Нэвтрэх нэр"
          value={loginName}
          onChange={e => setLoginName(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && handleLogin()}
        />

        <input
          type="password"
          placeholder="Нууц үг"
          value={loginPass}
          onChange={e => setLoginPass(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && handleLogin()}
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

  // ─────────────────────────────
  // MAIN APP
  // ─────────────────────────────
  return (
    <div className="App">

      <div className="App-header">

        <div className="header-row">

          <div>
            <h1>Хоолны захиалга</h1>

            <span className="role-badge">
              {ROLE_LABELS[role]}
            </span>
          </div>

          <button
            className="logout-btn"
            onClick={handleLogout}
          >
            Гарах
          </button>

        </div>
      </div>

      {role === 'camp_manager' ? (
        <CampManagerView token={token} />
      ) : (
        <>
          <KitchenView
            token={token}
            userDept={userDept}
            userLocation={userLocation}
          />

          {role !== 'kitchen_staff' && (
            <OrdersView role={role} />
          )}
        </>
      )}

    </div>
  );
}

export default App;