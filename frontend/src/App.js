import React, { useState } from 'react';
import './App.css';
import CampManagerView from './components/camp/CampManagerView';
import KitchenView from './components/kitchen/KitchenView';
import OrdersView from './components/orders/OrdersView';
import { useAuth } from './context/AuthContext';


const ROLE_LABELS = { kitchen_staff: 'Хоолны захиалагч', category_manager: 'Хоолны захиалга хянагч ТН', camp_manager: 'Кемп менежер',}; 
function App() { 
  const { token, role, userDept, userLocation, isLoadingAuth, login, logout } = useAuth(); 
  const [loginName, setLoginName] = useState(''); 
  const [loginPass, setLoginPass] = useState('');
  // ─────────────────────────────
  // LOGIN
  // ─────────────────────────────
  const handleLogin = async () => { 
    try { 
      await login(loginName, loginPass); 
    } catch (err) { alert(err.message); 
    } };
  // ─────────────────────────────
  // LOGOUT
  // ─────────────────────────────
const handleLogout = () => { logout(); };

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
            <OrdersView
  role={role}
  token={token}
/>
          )}
        </>
      )}

    </div>
  );
}

export default App;