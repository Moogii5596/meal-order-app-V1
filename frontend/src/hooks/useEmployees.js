import {
  useState,
  useEffect,
  useCallback
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

  // ─────────────────────────────
  // LOAD EMPLOYEES
  // ─────────────────────────────
  const loadEmployees = useCallback(
    (autoSelect = true) => {

      if (!selectedDept) return;

      setLoading(true);

      fetchEmployees(
        selectedDept,
        selectedDate,
        selectedMeal,
        token
      )
        .then(data => {

          let employees =
            data.employees || [];

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
        .finally(() => {
          setLoading(false);
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
  }, [loadEmployees]);

  // ─────────────────────────────
  // MY EMPLOYEES
  // ─────────────────────────────
  useEffect(() => {

    if (!token) return;

    fetchMyEmployees(token)
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
      .catch(() => {

        setFavorites([]);
        setExtraEmployees([]);
        setHiddenIds([]);

      });

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