import { apiFetch } from './api';

// ─────────────────────────────
// GET ORDERS
// ─────────────────────────────
export function fetchOrders({
  date,
  mealType,
  signal
}) {

  return apiFetch(
    `/orders?date=${date}&meal_type=${mealType}`,
    { signal }
  );

}

// ─────────────────────────────
// ORDER DETAIL
// ─────────────────────────────
export function fetchOrderDetail(
  orderId,
  signal
) {

  return apiFetch(
    `/orders/${orderId}`,
    { signal }
  );

}

// ─────────────────────────────
// APPROVE ORDER
// ─────────────────────────────
export function approveOrder(orderId) {

  return apiFetch(
    `/orders/${orderId}/approve`,
    {
      method: 'POST'
    }
  );

}

// ─────────────────────────────
// REJECT ORDER
// ─────────────────────────────
export function rejectOrder(orderId) {

  return apiFetch(
    `/orders/${orderId}/reject`,
    {
      method: 'POST'
    }
  );

}

// ─────────────────────────────
// DELETE ORDER
// ─────────────────────────────
export function deleteOrder(orderId) {

  return apiFetch(
    `/orders/${orderId}`,
    {
      method: 'DELETE'
    }
  );

}

// ─────────────────────────────
// CONFIRM ORDER
// ─────────────────────────────
export function confirmOrder(orderId) {

  return apiFetch(
    `/orders/${orderId}/confirm`,
    {
      method: 'POST'
    }
  );

}