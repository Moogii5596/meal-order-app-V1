import React, { useEffect, useState } from 'react';
import { useAuth } from '../../context/AuthContext';
import { useEmployees } from '../../hooks/useEmployees';
import { useToast } from '../../hooks/useToast';
import {
  DEFAULT_MEAL,
  LOCATION_LABELS,
  MEAL_LABELS,
} from '../../constants';
import {
  clearAllMyEmployees,
  fetchDepartments,
  hideEmployee as hideEmployeeApi,
  removeExtraEmployee as removeExtraApi,
  removeFavorite as removeFavoriteApi,
  saveFavorite as saveFavoriteApi,
  saveExtraEmployee,
} from '../../services/employees';
import { createOrder } from '../../services/orders';
import AddEmployeeModal from './AddEmployeeModal';
import EmployeeTable from './EmployeeTable';
import Toast from '../../components/ui/Toast';

function KitchenView() {
  const { userDept, userLocation } = useAuth();

  // ── Filters ───────────────────────────────────────────────────────────────
  const [departments, setDepartments]       = useState([]);
  const [selectedDept, setSelectedDept]     = useState('');
  const [selectedDeptName, setSelectedDeptName] = useState('');
  const [selectedDate, setSelectedDate]     = useState(new Date().toISOString().split('T')[0]);
  const [selectedMeal, setSelectedMeal]     = useState(DEFAULT_MEAL);
  const [selectedLocation, setSelectedLocation] = useState('');

  // ── UI state ──────────────────────────────────────────────────────────────
  const [selectedEmployeeIds, setSelectedEmployeeIds] = useState([]);
  const [showAddModal, setShowAddModal]     = useState(false);
  const [didAutoInit, setDidAutoInit]       = useState(false);
  const { toast, showToast, hideToast }     = useToast();

  // ── Employee data ─────────────────────────────────────────────────────────
  const {
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
  } = useEmployees({ selectedDept, selectedDate, selectedMeal, userLocation });

  // ── Init department from user context ─────────────────────────────────────
  useEffect(() => {
    if (userDept) {
      setDepartments([{ id: userDept.id, name: userDept.name }]);
      setSelectedDept(userDept.id);
      setSelectedDeptName(userDept.name);
    } else {
      fetchDepartments()
        .then(setDepartments)
        .catch(() => {/* silently fail — empty dropdown */});
    }

    if (userLocation) {
      setSelectedLocation(userLocation);
    }
  }, [userDept, userLocation]);

  // ── Auto-select all dept employees the first time (no saved favorites) ────
  useEffect(() => {
    if (didAutoInit || favorites.length > 0 || employees.length === 0) return;

    const ids = employees.map((e) => e.id);
    setFavorites(ids);
    ids.forEach((id) => saveFavoriteApi(id).catch(() => {}));
    setDidAutoInit(true);
  }, [employees, favorites, didAutoInit, setFavorites]);

  // ── Auto-select new extra employees ──────────────────────────────────────
  useEffect(() => {
    if (extraEmployees.length === 0) return;
    setSelectedEmployeeIds((prev) => {
      const toAdd = extraEmployees
        .filter((e) => !e.is_swiped && !prev.includes(e.id))
        .map((e) => e.id);
      return toAdd.length > 0 ? [...prev, ...toAdd] : prev;
    });
  }, [extraEmployees]);

  // ── Handlers ──────────────────────────────────────────────────────────────

  const handleDeptChange = (e) => {
    const deptId = e.target.value;
    setSelectedDept(deptId);
    const dept = departments.find((d) => String(d.id) === deptId);
    setSelectedDeptName(dept ? dept.name : '');
    setEmployees([]);
  };

  /**
   * An employee is "favorite-eligible" if they are an extra that should be
   * tracked across shifts: rental employees or extended employees from a
   * different department.
   */
  const isFavoriteEligible = (emp) => {
    if (!emp?.is_extra) return false;
    if (emp.extra_type === 'rental') return true;
    if (emp.extra_type === 'sunasan' && emp.dept_name && emp.dept_name !== selectedDeptName) {
      return true;
    }
    return false;
  };

  const saveFavorite = (empId) => {
    const emp = [...employees, ...extraEmployees].find((e) => e.id === empId);
    if (!isFavoriteEligible(emp)) return;
    saveFavoriteApi(empId)
      .then(() => setFavorites((prev) => (prev.includes(empId) ? prev : [...prev, empId])))
      .catch(() => showToast('Хадгалахад алдаа гарлаа', 'error'));
  };

  const removeFavorite = (empId) => {
    removeFavoriteApi(empId)
      .then(() => {
        setFavorites((prev) => prev.filter((id) => id !== empId));
        setSelectedEmployeeIds((prev) => prev.filter((id) => id !== empId));
      })
      .catch(() => showToast('Хасахад алдаа гарлаа', 'error'));
  };

  const removeExtra = (empId) => {
    removeExtraApi(empId)
      .then(() => setExtraEmployees((prev) => prev.filter((e) => e.id !== empId)))
      .catch(() => showToast('Хасахад алдаа гарлаа', 'error'));
  };

  const hideEmployee = (empId) => {
    hideEmployeeApi(empId)
      .then(() => {
        setHiddenIds((prev) => (prev.includes(empId) ? prev : [...prev, empId]));
        setSelectedEmployeeIds((prev) => prev.filter((id) => id !== empId));
      })
      .catch(() => showToast('Алдаа гарлаа', 'error'));
  };

  const handleAddEmployee = (emp, tab) => {
    setExtraEmployees((prev) =>
      prev.find((e) => e.id === emp.id)
        ? prev
        : [...prev, { ...emp, is_extra: true, extra_type: tab, is_swiped: false }],
    );
    setSelectedEmployeeIds((prev) => (prev.includes(emp.id) ? prev : [...prev, emp.id]));
    saveExtraEmployee(emp, tab).catch(() => {});
  };

  const refreshShift = () => {
    if (!window.confirm('Та ээлжээ шинэчлэх үү? Fav жагсаалтын бүх ажилтан устах болно.')) return;
    clearAllMyEmployees()
      .then(() => {
        setFavorites([]);
        setExtraEmployees([]);
        setHiddenIds([]);
        setSelectedEmployeeIds([]);
        loadEmployees();
        showToast('Ээлж шинэчлэгдлээ — зөвхөн өөрийн хэлтсийн ажилчид харагдана');
      })
      .catch(() => showToast('Ээлж шинэчлэхэд алдаа гарлаа', 'error'));
  };

  const saveShift = () => {
    const eligibleIds = selectedEmployeeIds
      .map((id) => [...employees, ...extraEmployees].find((e) => e.id === id))
      .filter((emp) => emp && isFavoriteEligible(emp))
      .map((emp) => emp.id);

    if (eligibleIds.length === 0) {
      showToast('Ээлж хадгалахын тулд зөв ажилтнуудыг сонгоно уу', 'error');
      return;
    }

    Promise.all(eligibleIds.map(saveFavoriteApi))
      .then(() => {
        setFavorites((prev) => [...new Set([...prev, ...eligibleIds])]);
        showToast('Ээлж амжилттай хадгалагдлаа');
      })
      .catch(() => showToast('Ээлж хадгалахад алдаа гарлаа', 'error'));
  };

  const submitOrder = () => {
    // Only include IDs that are visible in the current filtered list
    const idsToSubmit = selectedEmployeeIds.filter((id) =>
      sortedFilteredEmployees.some((e) => e.id === id),
    );
    if (idsToSubmit.length === 0) return;

    // FIX: was sending a plain array — backend expects { employee_ids: [...] }
    createOrder(selectedDate, selectedMeal, idsToSubmit)
      .then(() => {
        showToast(`${MEAL_LABELS[selectedMeal]} захиалга амжилттай илгээгдлээ ✓`);
        loadEmployees();
      })
      .catch(() => showToast('Захиалга илгээхэд алдаа гарлаа', 'error'));
  };

  // ── Derived state ─────────────────────────────────────────────────────────

  const locations = [...new Set(employees.map((e) => e.location).filter(Boolean))];

  const baseFiltered = selectedLocation
    ? employees.filter((e) => e.location === selectedLocation)
    : employees;

  const filteredEmployees = [
    ...baseFiltered,
    ...extraEmployees.filter((e) => !baseFiltered.find((b) => b.id === e.id)),
  ].filter((e) => !hiddenIds.includes(e.id));

  const sortedFilteredEmployees = [...filteredEmployees].sort((a, b) => {
    const aFav = favorites.includes(a.id);
    const bFav = favorites.includes(b.id);
    if (aFav && !bFav) return -1;
    if (!aFav && bFav) return 1;
    return 0;
  });

  const visibleSelectedCount = selectedEmployeeIds.filter((id) =>
    sortedFilteredEmployees.some((e) => e.id === id),
  ).length;

  // ── Render ────────────────────────────────────────────────────────────────

  return (
    <div>
      {toast && <Toast message={toast.message} type={toast.type} onClose={hideToast} />}

      {/* Controls */}
      <div className="controls">
        <div className="control-row">
          <label>Огноо:</label>
          <input
            type="date"
            value={selectedDate}
            onChange={(e) => setSelectedDate(e.target.value)}
          />
        </div>

        <div className="control-row">
          <label>Хэлтэс:</label>
          <select onChange={handleDeptChange} value={selectedDept}>
            <option value="">-- Хэлтэс сонгоно уу --</option>
            {departments.map((d) => (
              <option key={d.id} value={d.id}>{d.name}</option>
            ))}
          </select>
        </div>

        <div className="meal-types">
          {Object.entries(MEAL_LABELS).map(([key, label]) => (
            <button
              key={key}
              className={selectedMeal === key ? 'active' : ''}
              onClick={() => setSelectedMeal(key)}
            >
              {label}
            </button>
          ))}
        </div>
      </div>

      {/* Content */}
      {!selectedDept ? (
        <div className="empty-state">Эхлээд хэлтэс сонгоно уу</div>
      ) : loading ? (
        <div className="empty-state">Уншиж байна...</div>
      ) : (
        <div>
          {/* Location filter (only shown when multiple locations exist) */}
          {locations.length > 1 && (
            <div className="meal-types" style={{ marginBottom: 10 }}>
              <button
                className={selectedLocation === '' ? 'active' : ''}
                onClick={() => setSelectedLocation('')}
              >
                Бүгд
              </button>
              {locations.map((loc) => (
                <button
                  key={loc}
                  className={selectedLocation === loc ? 'active' : ''}
                  onClick={() => setSelectedLocation(loc)}
                >
                  {LOCATION_LABELS[loc] || loc}
                </button>
              ))}
            </div>
          )}

          {/* Employee table + action buttons */}
          {sortedFilteredEmployees.length === 0 ? (
            <div className="empty-state">Хэлтсийн ажилчид байхгүй</div>
          ) : (
            <>
              <EmployeeTable
                employees={sortedFilteredEmployees}
                favorites={favorites}
                selectedEmployees={selectedEmployeeIds}
                setSelectedEmployees={setSelectedEmployeeIds}
                removeFavorite={removeFavorite}
                removeExtraEmployee={removeExtra}
                saveFavorite={saveFavorite}
                hideEmployee={hideEmployee}
                isFavoriteEligible={isFavoriteEligible}
              />

              <div style={{ display: 'flex', gap: 8, marginTop: 10, flexWrap: 'wrap' }}>
                <button className="confirm-btn" onClick={submitOrder}>
                  Захиалга илгээх ({visibleSelectedCount} сонгогдсон)
                </button>
                <button className="action-btn" onClick={() => setShowAddModal(true)}>
                  + Ажилтан нэмэх
                </button>
                <button className="action-btn" onClick={saveShift}>
                  💾 Ээлж хадгалах
                </button>
                <button className="action-btn" onClick={refreshShift}>
                  🔄 Ээлж шинэчлэх
                </button>
              </div>
            </>
          )}

          {showAddModal && (
            <AddEmployeeModal
              onAdd={handleAddEmployee}
              onClose={() => setShowAddModal(false)}
              favorites={favorites}
            />
          )}
        </div>
      )}
    </div>
  );
}

export default KitchenView;
