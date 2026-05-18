/**
 * Order service.
 *
 * All order-related API calls live here.
 * Only endpoints that actually exist in the backend are listed.
 */
import { apiFetch } from './api';

export function fetchOrders({ date, mealType, dateFrom, dateTo, page = 1, pageSize = 10, signal } = {}) {
  const params = new URLSearchParams();
  if (date)     params.set('date', date);
  if (mealType) params.set('meal_type', mealType);
  if (dateFrom) params.set('date_from', dateFrom);
  if (dateTo)   params.set('date_to', dateTo);
  params.set('page', page);
  params.set('page_size', pageSize);
  return apiFetch(`/orders?${params}`, { signal });
}

export function fetchOrderDetail(orderId, signal) {
  return apiFetch(`/orders/${orderId}`, { signal });
}

export function createOrder(date, mealType, employeeIds) {
  return apiFetch(`/create-order?date=${date}&meal_type=${mealType}`, {
    method: 'POST',
    body: JSON.stringify({ employee_ids: employeeIds }),
  });
}

export function approveOrder(orderId) {
  return apiFetch(`/orders/${orderId}/approve`, { method: 'POST' });
}

export function confirmOrder(orderId) {
  return apiFetch(`/orders/${orderId}/confirm`, { method: 'POST' });
}

export function updateOrderLines(orderId, employeeIds) {
  return apiFetch(`/orders/${orderId}/lines`, {
    method: 'PATCH',
    body: JSON.stringify({ employee_ids: employeeIds }),
  });
}

export function bulkApproveOrders(orderIds) {
  return apiFetch('/orders/bulk-approve', {
    method: 'POST',
    body: JSON.stringify({ order_ids: orderIds }),
  });
}

export function bulkCancelOrders(orderIds) {
  return apiFetch('/orders/bulk-cancel', {
    method: 'POST',
    body: JSON.stringify({ order_ids: orderIds }),
  });
}

export function bulkDeleteOrders(orderIds) {
  return apiFetch('/orders/bulk-delete', {
    method: 'POST',
    body: JSON.stringify({ order_ids: orderIds }),
  });
}
