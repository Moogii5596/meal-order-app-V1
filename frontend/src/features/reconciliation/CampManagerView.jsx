import React, { useState } from 'react';
import CampOrdersView       from '../dashboard/CampOrdersView';
import CampFavView          from '../favorites/CampFavView';
import GroupsManager        from '../groups/GroupsManager';
import ReportingView        from '../reporting/ReportingView';
import CampManagedOrdersView from '../camp-manager/orders/CampManagedOrdersView';

const TABS = [
  { key: 'orders',          label: '📋 Захиалга' },
  { key: 'managed-orders',  label: '📋 Ахлахуудын захиалга' },
  { key: 'fav',             label: '⭐ Fav жагсаалт' },
  { key: 'groups',          label: '👥 Бүлэг' },
  { key: 'reports',         label: '📊 Тайлан' },
];

function CampManagerView() {
  const [activeTab, setActiveTab] = useState('orders');

  return (
    <div>
      {/* ── Tab bar ── */}
      <div
        style={{
          display:      'flex',
          gap:          4,
          background:   'white',
          borderRadius: 10,
          padding:      6,
          marginBottom: 16,
          boxShadow:    '0 1px 4px rgba(0,0,0,0.07)',
          overflowX:    'auto',
        }}
      >
        {TABS.map((tab) => (
          <button
            key={tab.key}
            onClick={() => setActiveTab(tab.key)}
            style={{
              flex:         1,
              minWidth:     80,
              padding:      '10px 4px',
              border:       'none',
              borderRadius: 7,
              cursor:       'pointer',
              fontSize:     13,
              fontWeight:   activeTab === tab.key ? 700 : 400,
              background:   activeTab === tab.key ? '#1677ff' : 'transparent',
              color:        activeTab === tab.key ? 'white' : '#555',
              transition:   'all 0.15s',
              whiteSpace:   'nowrap',
            }}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* ── Tab content ── */}
      {activeTab === 'orders'         && <CampOrdersView />}
      {activeTab === 'managed-orders' && <CampManagedOrdersView />}
      {activeTab === 'fav'            && <CampFavView />}
      {activeTab === 'groups'         && <GroupsManager />}
      {activeTab === 'reports'        && <ReportingView />}
    </div>
  );
}

export default CampManagerView;
