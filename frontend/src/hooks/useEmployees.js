import {
  useState,
  useEffect,
  useCallback,
  useRef
} from 'react';

import {
  fetchEmployees,
  fetchMyEmployees
} from '../services/employees';

export function useEmployees({
  selectedDept,
  selectedDate,
  selectedMeal,
  token,
  userLocation
}) {

  const [employees, setEmployees] = useState([]);
  const [favorites, setFavorites] = useState([]);
  const [hiddenIds, setHiddenIds] = useState([]);
  const [extraEmployees, setExtraEmployees] = useState([]);
  const [loading, setLoading] = useState(false);
  const loadAbortController = useRef(null);

  // ─────────────────────────────
  // LOAD EMPLOYEES
  // ─────────────────────────────
  const loadEmployees = useCallback(
    (autoSelect = true) => {

      if (!selectedDept) return;

      setLoading(true);

      if (loadAbortController.current) {
        loadAbortController.current.abort();
      }

      const controller = new AbortController();
      loadAbortController.current = controller;

      fetchEmployees(
        selectedDept,
        selectedDate,
        selectedMeal,
        token,
        controller.signal
      )
        .then(data => {
          let employees =
            data.employees || [];
            console.log('RAW DATA:', data);
            console.log('EMPLOYEES:', employees);
            console.log('USER LOCATION:', userLocation);

          if (userLocation) {
            employees = employees.filter(
              e =>
                e.location
                  ?.trim()
                  .toLowerCase() ===
                userLocation
                  .trim()
                  .toLowerCase()
            );
          }

          setEmployees(employees);
        })
        .catch(error => {
          if (error.name === 'AbortError') return;
        })
        .finally(() => {
          if (loadAbortController.current === controller) {
            setLoading(false);
          }
        });
    },
    [
      selectedDept,
      selectedDate,
      selectedMeal,
      token,
      userLocation
    ]
  );

  // ─────────────────────────────
  // AUTO LOAD
  // ─────────────────────────────
  useEffect(() => {
    loadEmployees();

    return () => {
      loadAbortController.current?.abort();
    };
  }, [loadEmployees]);

  // ─────────────────────────────
  // MY EMPLOYEES
  // ─────────────────────────────
  useEffect(() => {
    if (!token) return;

    const controller = new AbortController();

    fetchMyEmployees(token, controller.signal)
      .then(data => {

        setFavorites(
          data.favorites || []
        );

        setHiddenIds(
          data.hidden || []
        );

        const extras =
          data.extra_employees || [];

        setExtraEmployees(
          extras.map(e => ({
            id: e.id,
            extra_type: e.extra_type,
            name: e.name || '',
            last_name: e.last_name || '',
            dept_name: e.dept_name || '',
            job_title: e.job_title || '',
            location: e.location || '',
            is_extra: true,
            is_swiped: false
          }))
        );

      })
      .catch(error => {
        if (error.name === 'AbortError') return;

        setFavorites([]);
        setExtraEmployees([]);
        setHiddenIds([]);

      });

    return () => {
      controller.abort();
    };
  }, [token]);

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

    loadEmployees

  };
}