import CampOrdersView from './CampOrdersView';
import CampFavView from './CampFavView';
import { useState } from 'react';

export default function CampManagerView({ token }) {
  const [activeTab, setActiveTab] = useState('orders');

  const tabs = [
    { key: 'orders', label: '📋 Захиалга хянах' },
    { key: 'fav', label: '⭐ Fav жагсаалт' },
    { key: 'reports', label: '📊 Тайлан' },
  ];

  return (
    <div>
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
        {tabs.map(t => (
          <button
            key={t.key}
            onClick={() => setActiveTab(t.key)}
            style={{
              flex: 1,
              padding: '10px 0',
              border: 'none',
              borderRadius: 7,
              cursor: 'pointer',
              fontSize: 14,
              fontWeight: activeTab === t.key ? 700 : 400,
              background: activeTab === t.key ? '#1677ff' : 'transparent',
              color: activeTab === t.key ? 'white' : '#555',
              transition: 'all 0.15s',
            }}
          >
            {t.label}
          </button>
        ))}
      </div>

      {activeTab === 'orders' && <CampOrdersView token={token} />}

      {activeTab === 'fav' && <CampFavView token={token} />}

      {activeTab === 'reports' && (
        <div
          style={{
            textAlign: 'center',
            padding: '60px 20px',
            color: '#aaa',
          }}
        >
          <div style={{ fontSize: 48, marginBottom: 12 }}>📊</div>

          <div
            style={{
              fontSize: 18,
              fontWeight: 600,
              color: '#666',
            }}
          >
            Тайлан
          </div>

          <div style={{ fontSize: 13, marginTop: 8 }}>
            Тохиргоотой хамт удахгүй нэмэгдэнэ
          </div>
        </div>
      )}
    </div>
  );
}