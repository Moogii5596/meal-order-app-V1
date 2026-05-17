  import React, { useState, useEffect, } from 'react';
  import Toast from '../ui/Toast';
  import { useToast } from '../../hooks/useToast';
  import {  MEAL_LABELS, LOCATION_LABELS, } from '../../shared/constants';
  import { apiFetch } from '../../services/api';
  import AddEmployeeModal from './AddEmployeeModal';
  import EmployeeTable from './EmployeeTable';
  import { useEmployees } from '../../hooks/useEmployees';
  import { useAuth } from '../../context/AuthContext';
  import { fetchDepartments, saveFavoriteEmployee } from '../../services/employees';
  // ── Захиалга үүсгэх ──
  function KitchenView() { const { token, userDept, userLocation } = useAuth();
    const [departments, setDepartments] = useState([]);
    const [selectedDept, setSelectedDept] = useState('');
    const [selectedDeptName, setSelectedDeptName] = useState('');
    const [selectedEmployees, setSelectedEmployees] = useState([]);
    const [selectedMeal, setSelectedMeal] = useState('lunch');
    const [selectedDate, setSelectedDate] = useState(new Date().toISOString().split('T')[0]);
    const [selectedLocation, setSelectedLocation] = useState('');
    const [showAddModal, setShowAddModal] = useState(false); 
    const [didAutoInit, setDidAutoInit] = useState(false);
    const { toast, showToast, hideToast } = useToast();
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

    loadEmployees

  } = useEmployees({
    selectedDept,
    selectedDate,
    selectedMeal,
    userLocation
  });

    useEffect(() => {
      if (userDept) {
        setDepartments([{ id: userDept.id, name: userDept.name }]);
        setSelectedDept(userDept.id);
        setSelectedDeptName(userDept.name);
      } else {
  fetchDepartments()
    .then(data => setDepartments(data))
      }
      if (userLocation) {
        setSelectedLocation(userLocation);
      }
    }, [userDept, userLocation]);

    const handleDeptChange = (e) => {
      setSelectedDept(e.target.value);
      const dept = departments.find(d => String(d.id) === e.target.value);
      setSelectedDeptName(dept ? dept.name : '');
      setEmployees([]);
    };

    useEffect(() => { 
      if (
          !didAutoInit &&
            favorites.length === 0 &&
            employees.length > 0
          ) 
        { 
          const employeeIds = employees.map(e => e.id); 
          setFavorites(employeeIds); 
          employeeIds.forEach(id => { 
            saveFavoriteEmployee(id) 
            .catch(console.error); });
            setDidAutoInit(true);
           } }, [ 
              employees, favorites, didAutoInit, setFavorites]);

    useEffect(() => {
      if (extraEmployees.length === 0) return;
      setSelectedEmployees(prev => {
        const newIds = extraEmployees.filter(e => !e.is_swiped).map(e => e.id);
        const toAdd = newIds.filter(id => !prev.includes(id));
        if (toAdd.length === 0) return prev;
        return [...prev, ...toAdd];
      });
    }, [extraEmployees, employees]);

    const isFavoriteEligible = (emp) => {
      if (!emp?.is_extra) return false;
      if (emp.extra_type === 'rental') return true;
      if (emp.extra_type === 'sunasan' && emp.dept_name && selectedDeptName && emp.dept_name !== selectedDeptName) return true;
      return false;
    };

    const saveFavorite = (empId) => {
      if (!token) return;
      const emp = [...employees, ...extraEmployees].find(e => e.id === empId);
      if (!isFavoriteEligible(emp)) return;
      apiFetch('/my-employees/save', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
        body: JSON.stringify({ employee_id: empId })
      }).then(() => setFavorites(prev => prev.includes(empId) ? prev : [...prev, empId]));
    };

    const removeFavorite = (empId) => {

  if (!token) return;

  apiFetch('/my-employees/remove', {
    method: 'DELETE',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`
    },
    body: JSON.stringify({
      employee_id: empId
    })
  }).then(() => {

    setFavorites(prev =>
      prev.filter(id => id !== empId)
    );
    setSelectedEmployees(prev =>
    prev.filter(e => e.id !== empId)
     );

  });

};

    const removeExtraEmployee = (empId) => {
      if (!token) return;
      apiFetch('/my-extra-employees/remove', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
        body: JSON.stringify({ employee_id: empId })
      }).then(() => setExtraEmployees(prev => prev.filter(e => e.id !== empId)));
    };

    const hideEmployee = (empId) => {
      if (!token) return;
      apiFetch('/my-hidden/save', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
        body: JSON.stringify({ employee_id: empId })
      }).then(() => {
        setHiddenIds(prev => prev.includes(empId) ? prev : [...prev, empId]);
        setSelectedEmployees(prev => prev.filter(id => id !== empId));
      });
    };

    const refreshShift = () => {
      if (!token) return;
      if (!window.confirm('Та ээлжээ шинэчлэх үү? Fav жагсаалтын бүх ажилтан устах болно.')) return;
      apiFetch('/my-employees/clear-all', {
        method: 'DELETE',
        headers: { 'Authorization': `Bearer ${token}` }
      })
      
        .then(() => {
          setFavorites([]);
          setExtraEmployees([]);
          setHiddenIds([]);
          setSelectedEmployees([]);
          loadEmployees(false);
          showToast('Ээлж шинэчлэгдлээ — зөвхөн өөрийн хэлтсийн ажилчид харагдана');
        })
        .catch(() => showToast('Ээлж шинэчлэхэд алдаа гарлаа', 'error'));
    };

    const saveShift = () => {
      const eligibleIds = selectedEmployees
        .map(id => [...employees, ...extraEmployees].find(e => e.id === id))
        .filter(emp => emp && isFavoriteEligible(emp))
        .map(emp => emp.id);

      if (eligibleIds.length === 0) {
        showToast('Ээлж хадгалахын тулд зөв ажилтнуудыг сонгоно уу', 'error');
        return;
      }

      Promise.all(eligibleIds.map(empId =>
        apiFetch('/my-employees/save', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
          body: JSON.stringify({ employee_id: empId })
        })
      ))
        .then(() => {
          setFavorites(prev => [...new Set([...prev, ...eligibleIds])]);
          showToast('Ээлж амжилттай хадгалагдлаа');
        })
        .catch(() => showToast('Ээлж хадгалахад алдаа гарлаа', 'error'));
    };

    const submitOrder = () => {
      const idsToSubmit = selectedEmployees.filter(id => sortedFilteredEmployees.find(e => e.id === id));
      apiFetch(
  `/create-order?date=${selectedDate}&meal_type=${selectedMeal}`,
  {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { 'Authorization': `Bearer ${token}` } : {})
        },
        body: JSON.stringify(idsToSubmit)
      })
        .then(() => {
          showToast(`${MEAL_LABELS[selectedMeal]} захиалга амжилттай илгээгдлээ ✓`);
          loadEmployees(false);
        })
        .catch(() => showToast('Алдаа гарлаа', 'error'));
    };

    const locations = [...new Set(employees.map(e => e.location).filter(Boolean))];

    const baseFiltered = selectedLocation
      ? employees.filter(e => e.location === selectedLocation)
      : employees;
    const filteredEmployees = [...baseFiltered, ...extraEmployees.filter(e => !baseFiltered.find(b => b.id === e.id))]
      .filter(e => !hiddenIds.includes(e.id));
    const sortedFilteredEmployees = [...filteredEmployees].sort((a, b) => {
      const aFav = favorites.includes(a.id);
      const bFav = favorites.includes(b.id);
      if (aFav && !bFav) return -1;
      if (!aFav && bFav) return 1;
      return 0;
    });

    const swipedCount = sortedFilteredEmployees.filter(e => e.is_swiped).length;
    const notSwipedCount = sortedFilteredEmployees.filter(e => !e.is_swiped).length;

    return (
      <div>
        {toast && <Toast message={toast.message} type={toast.type} onClose={hideToast} />}
        <div className="controls">
          <div className="control-row">
            <label>Огноо:</label>
            <input type="date" value={selectedDate} onChange={e => setSelectedDate(e.target.value)} />
          </div>
          <div className="control-row">
            <label>Хэлтэс:</label>
            <select onChange={handleDeptChange} value={selectedDept}>
              <option value="">-- Хэлтэс сонгоно уу --</option>
              {departments.map(d => <option key={d.id} value={d.id}>{d.name}</option>)}
            </select>
          </div>
          <div className="meal-types">
            {Object.entries(MEAL_LABELS).map(([key, label]) => (
              <button key={key} className={selectedMeal === key ? 'active' : ''} onClick={() => setSelectedMeal(key)}>
                {label}
              </button>
            ))}
          </div>
        </div>

        {!selectedDept ? (
          <div className="empty-state">Эхлээд хэлтэс сонгоно уу</div>
        ) : loading ? (
          <div className="empty-state">Уншиж байна...</div>
        ) : (
          <div>
            {locations.length > 1 && (
              <div className="meal-types" style={{marginBottom: 10}}>
                <button className={selectedLocation === '' ? 'active' : ''} onClick={() => setSelectedLocation('')}>Бүгд</button>
                {locations.map(loc => (
                  <button key={loc} className={selectedLocation === loc ? 'active' : ''} onClick={() => setSelectedLocation(loc)}>
                    {LOCATION_LABELS[loc] || loc}
                  </button>
                ))}
              </div>
            )}
            <div className="table-header">
              <div className="table-info">
                <strong>⭐ Миний ээлж (Fav жагсаалт)</strong>
                <span> — {selectedDeptName}</span>
                {selectedLocation && <span> — {LOCATION_LABELS[selectedLocation] || selectedLocation}</span>}
                <span className="stat"> | Нийт: {sortedFilteredEmployees.length} </span>
                <span className="stat-success">Карттай: {swipedCount}</span>
                <span className="stat-warn"> | Захиалах: {notSwipedCount}</span>
                {(favorites.length > 0 || extraEmployees.length > 0) && (
                  <span className="stat"> | Fav: {favorites.length} | Нэмэлт: {extraEmployees.length}</span>
                )}
              </div>
              <div>
                <button type="button" className="action-btn" onClick={() => setSelectedEmployees(sortedFilteredEmployees.filter(e => !e.is_swiped).map(e => e.id))}>Бүгд</button>
                <button type="button" className="action-btn" onClick={() => setSelectedEmployees([])}>Цуцлах</button>
                <button type="button" className="action-btn" style={{borderColor:'#1677ff', color:'#1677ff'}} onClick={() => setShowAddModal(true)}>+ Нэмэх</button>
                <button type="button" className="action-btn" style={{borderColor:'#ff4d4f', color:'#ff4d4f'}} onClick={refreshShift}>↻ Ээлж шинэчлэх</button>
              </div>
            </div>

            {showAddModal && (
              <AddEmployeeModal
                favorites={favorites}
                token={token}
                onAdd={(emp, tab) => {
                  setExtraEmployees(prev => prev.find(e => e.id === emp.id) ? prev : [...prev, {...emp, is_extra: true, extra_type: tab, is_swiped: false}]);
                  setSelectedEmployees(prev => prev.includes(emp.id) ? prev : [...prev, emp.id]);
                  if (token) {
                    apiFetch('/my-extra-employees/save', {
                      method: 'POST',
                      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
                      body: JSON.stringify({
                        employee_id: emp.id,
                        extra_type: tab,
                        name: emp.name,
                        last_name: emp.last_name,
                        dept_name: emp.dept_name,
                        job_title: emp.job_title,
                        location: emp.location
                      })
                    }).catch(console.error);
                  }
                }}
                onClose={() => setShowAddModal(false)}
              />
            )}
            <EmployeeTable
    employees={sortedFilteredEmployees}
    favorites={favorites}
    selectedEmployees={selectedEmployees}
    setSelectedEmployees={setSelectedEmployees}
    removeFavorite={removeFavorite}
    removeExtraEmployee={removeExtraEmployee}
    saveFavorite={saveFavorite}
    hideEmployee={hideEmployee}
    isFavoriteEligible={isFavoriteEligible}
  />
            {selectedEmployees.filter(id => sortedFilteredEmployees.find(e => e.id === id)).length > 0 && (
              <div style={{display:'flex', gap: '10px', flexWrap: 'wrap'}}>
                <button type="button" className="submit-btn" onClick={submitOrder}>
                  Захиалга илгээх ({selectedEmployees.filter(id => sortedFilteredEmployees.find(e => e.id === id)).length} ажилтан)
                </button>
                <button type="button" className="approve-btn" onClick={saveShift}>
                  Ээлж хадгалах
                </button>
              </div>
            )}
          </div>
        )}
      </div>
    );
  }

  export default KitchenView;