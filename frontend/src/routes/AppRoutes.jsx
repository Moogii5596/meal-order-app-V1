import React from 'react';
import CampManagerView
  from '../features/reconciliation/CampManagerView';
import KitchenView
  from '../features/meal-operations/KitchenView';
import OrdersView
  from '../features/meal-operations/OrdersView';
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