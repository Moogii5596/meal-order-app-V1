/**
 * useEmployees — manages the employee list for the kitchen shift view.
 *
 * Fetches employees when dept/date/meal changes (with abort on re-fetch),
 * and loads the current user's favorites, extras, and hidden list on mount.
 */
import { useCallback, useEffect, useRef, useState } from 'react';
import { fetchEmployees, fetchMyEmployees } from '../services/employees';

export function useEmployees({ selectedDept, selectedDate, selectedMeal, userLocation }) {
  const [employees, setEmployees]         = useState([]);
  const [favorites, setFavorites]         = useState([]);
  const [hiddenIds, setHiddenIds]         = useState([]);
  const [extraEmployees, setExtraEmployees] = useState([]);
  const [loading, setLoading]             = useState(false);

  const abortControllerRef = useRef(null);

  // ── Load department employees ─────────────────────────────────────────────

  const loadEmployees = useCallback(
    () => {
      if (!selectedDept) return;

      // Cancel any in-flight request
      abortControllerRef.current?.abort();
      const controller = new AbortController();
      abortControllerRef.current = controller;

      setLoading(true);

      fetchEmployees(selectedDept, selectedDate, selectedMeal, controller.signal)
        .then((data) => {
          let list = data.employees || [];

          // Filter by user's assigned location if set
          if (userLocation) {
            list = list.filter(
              (emp) =>
                emp.location?.trim().toLowerCase() === userLocation.trim().toLowerCase(),
            );
          }

          setEmployees(list);
        })
        .catch((error) => {
          if (error.name === 'AbortError') return;
          setEmployees([]);
        })
        .finally(() => {
          // Only clear loading if this is still the current controller
          if (abortControllerRef.current === controller) {
            setLoading(false);
          }
        });
    },
    [selectedDept, selectedDate, selectedMeal, userLocation],
  );

  // Auto-reload when dependencies change
  useEffect(() => {
    loadEmployees();
    return () => abortControllerRef.current?.abort();
  }, [loadEmployees]);

  // ── Load user's saved lists ───────────────────────────────────────────────

  useEffect(() => {
    const controller = new AbortController();

    fetchMyEmployees(controller.signal)
      .then((data) => {
        setFavorites(data.favorites || []);
        setHiddenIds(data.hidden || []);
        setExtraEmployees(
          (data.extra_employees || []).map((emp) => ({
            id: emp.id,
            extra_type: emp.extra_type,
            name: emp.name || '',
            last_name: emp.last_name || '',
            dept_name: emp.dept_name || '',
            job_title: emp.job_title || '',
            location: emp.location || '',
            is_extra: true,
            is_swiped: false,
          })),
        );
      })
      .catch((error) => {
        if (error.name === 'AbortError') return;
        setFavorites([]);
        setExtraEmployees([]);
        setHiddenIds([]);
      });

    return () => controller.abort();
  }, []);

  return {
    employees,
    setEmployees,
    favorites,
    setFavorites,
    hiddenIds,
    setHiddenIds,
    extraEmployees,
    setExtraEmployees,
    loading,
    loadEmployees,
  };
}
