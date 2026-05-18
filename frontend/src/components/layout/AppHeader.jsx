import React from 'react';
import { useAuth } from '../../context/AuthContext';
import { ROLE_LABELS } from '../../constants';

function AppHeader() {
  const { role, userName, userLastName, userJobTitle, logout } = useAuth();

  const fullName   = [userLastName, userName].filter(Boolean).join(' ');
  const roleLabel  = ROLE_LABELS[role] || role || '';

  return (
    <div className="App-header">
      <div className="header-row">
        <div>
          {/* User name — shown when available, otherwise fall back to app title */}
          {fullName ? (
            <>
              <h1 style={{ fontSize: '1rem', margin: 0 }}>{fullName}</h1>
              <span className="role-badge">
                {userJobTitle || roleLabel}
              </span>
            </>
          ) : (
            <>
              <h1>Хоолны захиалга</h1>
              {roleLabel && <span className="role-badge">{roleLabel}</span>}
            </>
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
