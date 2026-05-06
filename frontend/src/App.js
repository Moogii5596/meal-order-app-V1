import React, { useState, useEffect } from 'react';
import './App.css';

const API = process.env.REACT_APP_API_URL;

function App() {
  const [departments, setDepartments] = useState([]);
  const [selectedDept, setSelectedDept] = useState('');
  const [employees, setEmployees] = useState([]);
  const [selectedEmployees, setSelectedEmployees] = useState([]);
  const [selectedMeal, setSelectedMeal] = useState('lunch');
  const [selectedDate, setSelectedDate] = useState(
    new Date().toISOString().split('T')[0]
  );
  const [loading, setLoading] = useState(false);

  // departments
  useEffect(() => {
    fetch(`${API}/departments`)
      .then(res => res.json())
      .then(data => setDepartments(data))
      .catch(err => console.error(err));
  }, []);

  // employees
  useEffect(() => {
    if (selectedDept) {
      setLoading(true);

      fetch(`${API}/employees?dept_id=${selectedDept}&date=${selectedDate}&meal_type=${selectedMeal}`)
        .then(res => res.json())
        .then(data => {
          setEmployees(data.employees || []);
          setSelectedEmployees(
            data.employees
              ? data.employees.filter(e => !e.is_swiped).map(e => e.id)
              : []
          );
          setLoading(false);
        });
    }
  }, [selectedDept, selectedDate, selectedMeal]);

  const handleCheckboxChange = (id) => {
    setSelectedEmployees(prev =>
      prev.includes(id)
        ? prev.filter(x => x !== id)
        : [...prev, id]
    );
  };

  const submitOrder = () => {
    if (selectedEmployees.length === 0) {
      alert("Ажилтан сонгоно уу!");
      return;
    }

    fetch(`${API}/create-order?date=${selectedDate}&meal_type=${selectedMeal}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(selectedEmployees)
    })
      .then(res => res.json())
      .then(data => alert(`Амжилттай! Захиалга ID: ${data.order_id}`))
      .catch(() => alert("Алдаа гарлаа"));
  };

  const selectAll = () => {
    const ids = employees
      .filter(e => !e.is_swiped)
      .map(e => e.id);
    setSelectedEmployees(ids);
  };

  const deselectAll = () => setSelectedEmployees([]);

  return (
    <div className="App">
      <h1>Хоолны захиалга</h1>

      <input
        type="date"
        value={selectedDate}
        onChange={e => setSelectedDate(e.target.value)}
      />

      <select onChange={e => setSelectedDept(e.target.value)}>
        <option value="">-- Хэлтэс --</option>
        {departments.map(d => (
          <option key={d.id} value={d.id}>{d.name}</option>
        ))}
      </select>

      <div>
        {['breakfast', 'lunch', 'dinner', 'night'].map(t => (
          <button key={t} onClick={() => setSelectedMeal(t)}>
            {t}
          </button>
        ))}
      </div>

      {loading ? <p>Уншиж байна...</p> : (
        <div>
          <button onClick={selectAll}>Бүгд</button>
          <button onClick={deselectAll}>Цуцлах</button>

          <table>
            <thead>
              <tr>
                <th></th>
                <th>Овог</th>
                <th>Нэр</th>
                <th>Албан тушаал</th>
                <th>Карт</th>
              </tr>
            </thead>
            <tbody>
              {employees.map(emp => (
                <tr key={emp.id}>
                  <td>
                    <input
                      type="checkbox"
                      checked={selectedEmployees.includes(emp.id)}
                      onChange={() => handleCheckboxChange(emp.id)}
                      disabled={emp.is_swiped}
                    />
                  </td>
                  <td>{emp.last_name}</td>
                  <td>{emp.name}</td>
                  <td>{emp.job_title}</td>
                  <td>{emp.is_swiped ? "✔" : "❌"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {employees.length > 0 && (
        <button onClick={submitOrder}>
          Захиалга илгээх
        </button>
      )}
    </div>
  );
}

export default App;