import React from 'react';
import CampManagerView from '../features/reconciliation/CampManagerView';
import KitchenView     from '../features/meal-operations/KitchenView';
import ProtectedRoute  from './ProtectedRoute';

function AppRoutes() {
  return (
    <>
      {/* Camp Manager */}
      <ProtectedRoute allowedRoles={['camp_manager']}>
        <CampManagerView />
      </ProtectedRoute>

      {/* Kitchen staff & category manager — only KitchenView, no orders history */}
      <ProtectedRoute allowedRoles={['kitchen_staff', 'category_manager']}>
        <KitchenView />
      </ProtectedRoute>
    </>
  );
}

export default AppRoutes;
