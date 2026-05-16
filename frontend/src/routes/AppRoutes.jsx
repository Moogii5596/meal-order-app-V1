import React from 'react';
import CampManagerView
  from '../components/camp/CampManagerView';
import KitchenView
  from '../components/kitchen/KitchenView';
import OrdersView
  from '../components/orders/OrdersView';
import ProtectedRoute
  from './ProtectedRoute';
function AppRoutes() {
  return (
    <>
      {/* Camp Manager */}
      <ProtectedRoute
        allowedRoles={['camp_manager']}
      >
        <CampManagerView />
      </ProtectedRoute>

      {/* Kitchen + Orders */}
      <ProtectedRoute
        allowedRoles={[
          'kitchen_staff',
          'category_manager'
        ]}
      >

        <>
          <KitchenView />

          <OrdersView />
        </>

      </ProtectedRoute>

    </>
  );
}

export default AppRoutes;