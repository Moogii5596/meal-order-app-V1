import React, { useState } from 'react';
import CampOrdersView from './CampOrdersView';
import CampFavView from './CampFavView';

const TABS = [
  { key: 'orders',  label: '📋 Захиалга хянах' },
  { key: 'fav',     label: '⭐ Fav жагсаалт' },
  { key: 'reports', label: '📊 Тайлан' },
];

function CampManagerView() {
  const [activeTab, setActiveTab] = useState('orders');

  return (
    <div>
      {/* Tab bar */}
      <div
        style={{
          display: 'flex',
          gap: 4,
          background: 'white',
          borderRadius: 10,
          padding: 6,
          marginBottom: 16,
          boxShadow: '0 1px 4px rgba(0,0,0,0.07)',
        }}
      >
        {TABS.map((tab) => (
          <button
            key={tab.key}
            onClick={() => setActiveTab(tab.key)}
            style={{
              flex: 1,
              padding: '10px 0',
              border: 'none',
              borderRadius: 7,
              cursor: 'pointer',
              fontSize: 14,
              fontWeight: activeTab === tab.key ? 700 : 400,
              background: activeTab === tab.key ? '#1677ff' : 'transparent',
              color: activeTab === tab.key ? 'white' : '#555',
              transition: 'all 0.15s',
            }}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Tab content */}
      {activeTab === 'orders'  && <CampOrdersView />}
      {activeTab === 'fav'     && <CampFavView />}
      {activeTab === 'reports' && (
        <div style={{ textAlign: 'center', padding: '60px 20px', color: '#aaa' }}>
          <div style={{ fontSize: 48, marginBottom: 12 }}>📊</div>
          <div style={{ fontSize: 18, fontWeight: 600, color: '#666' }}>Тайлан</div>
          <div style={{ fontSize: 13, marginTop: 8 }}>Тохиргоотой хамт удахгүй нэмэгдэнэ</div>
        </div>
      )}
    </div>
  );
}

export default CampManagerView;
