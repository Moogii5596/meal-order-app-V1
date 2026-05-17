import React from 'react';
import { useAuth } from '../../context/AuthContext';
import { ROLE_LABELS } from '../../constants';

function AppHeader() {
  const { role, logout } = useAuth();

  return (
    <div className="App-header">
      <div className="header-row">
        <div>
          <h1>Хоолны захиалга</h1>
          {role && (
            <span className="role-badge">
              {ROLE_LABELS[role] || role}
            </span>
          )}
        </div>
        <button className="logout-btn" onClick={logout}>
          Гарах
        </button>
      </div>
    </div>
  );
}

export default AppHeader;
