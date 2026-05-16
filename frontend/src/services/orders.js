import { apiFetch } from './api';

// ─────────────────────────────
// GET ORDERS
// ─────────────────────────────
export function fetchOrders({
  date,
  mealType,
  token
}) {

  return apiFetch(
    `/orders?date=${date}&meal_type=${mealType}`,
    {
      headers: {
        Authorization: `Bearer ${token}`
      }
    }
  );

}

// ─────────────────────────────
// APPROVE ORDER
// ─────────────────────────────
export function approveOrder(
  orderId,
  token
) {

  return apiFetch(
    `/orders/${orderId}/approve`,
    {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`
      }
    }
  );

}

// ─────────────────────────────
// REJECT ORDER
// ─────────────────────────────
export function rejectOrder(
  orderId,
  token
) {

  return apiFetch(
    `/orders/${orderId}/reject`,
    {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`
      }
    }
  );

}

// ─────────────────────────────
// DELETE ORDER
// ─────────────────────────────
export function deleteOrder(
  orderId,
  token
) {

  return apiFetch(
    `/orders/${orderId}`,
    {
      method: 'DELETE',
      headers: {
        Authorization: `Bearer ${token}`
      }
    }
  );

}
export function confirmOrder(
  orderId,
  token
) {

  return apiFetch(
    `/orders/${orderId}/confirm`,
    {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`
      }
    }
  );

}