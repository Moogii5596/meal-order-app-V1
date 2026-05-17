import React from 'react';

import { LOCATION_LABELS } from '../../constants';

function EmployeeTable({
  employees,
  favorites,
  selectedEmployees,
  setSelectedEmployees,
  removeFavorite,
  removeExtraEmployee,
  saveFavorite,
  hideEmployee,
  isFavoriteEligible
}) {

  const renderActionBtn = (emp) => {
    if (favorites.includes(emp.id)) {
      return (
        <button
          type="button"
          className="action-btn"
          style={{ borderColor: '#ff4d4f', color: '#ff4d4f' }}
          onClick={() => removeFavorite(emp.id)}
        >
          Хасах
        </button>
      );
    }
    if (emp.is_extra) {
      return (
        <button
          type="button"
          className="action-btn"
          style={{ borderColor: '#ff9800', color: '#ff9800' }}
          onClick={() => removeExtraEmployee(emp.id)}
        >
          Нэмэлтээс хасах
        </button>
      );
    }
    if (isFavoriteEligible(emp)) {
      return (
        <button
          type="button"
          className="action-btn"
          style={{ borderColor: '#1677ff', color: '#1677ff' }}
          onClick={() => saveFavorite(emp.id)}
        >
          Хадгалах
        </button>
      );
    }
    return (
      <button
        type="button"
        className="action-btn"
        style={{ borderColor: '#ff4d4f', color: '#ff4d4f' }}
        onClick={() => hideEmployee(emp.id)}
      >
        Хасах
      </button>
    );
  };

  return (
    <div className="table-scroll">
      <table className="employee-table">

        <thead>
          <tr>
            <th>
              <input
                type="checkbox"
                checked={
                  employees.filter(e => !e.is_swiped).length > 0 &&
                  employees
                    .filter(e => !e.is_swiped)
                    .every(e => selectedEmployees.includes(e.id))
                }
                onChange={e => {
                  const ids = employees
                    .filter(emp => !emp.is_swiped)
                    .map(emp => emp.id);
                  if (e.target.checked) {
                    setSelectedEmployees(prev => [...new Set([...prev, ...ids])]);
                  } else {
                    setSelectedEmployees(prev => prev.filter(id => !ids.includes(id)));
                  }
                }}
              />
            </th>

            {/* Desktop-only columns */}
            <th className="col-desktop">Овог</th>
            <th className="col-desktop">Нэр</th>
            <th className="col-desktop">Албан тушаал</th>
            <th className="col-desktop">Байршил</th>

            {/* Mobile combined column */}
            <th className="col-mobile">Ажилтан</th>

            <th>Карт</th>
            <th>Тохиргоо</th>
          </tr>
        </thead>

        <tbody>
          {employees.map(emp => {
            const starPrefix = favorites.includes(emp.id) && emp.extra_type === 'rental' ? '⭐ ' : '';
            const locationLabel = LOCATION_LABELS[emp.location] || emp.location || '';
            const extraLabel = emp.is_extra
              ? ` (${emp.extra_type === 'rental' ? 'түрээсийн' : 'сунасан'})`
              : '';

            return (
              <tr key={emp.id} className={emp.is_swiped ? 'swiped-row' : ''}>

                <td>
                  <input
                    type="checkbox"
                    checked={selectedEmployees.includes(emp.id)}
                    disabled={emp.is_swiped}
                    onChange={() => {
                      setSelectedEmployees(prev =>
                        prev.includes(emp.id)
                          ? prev.filter(x => x !== emp.id)
                          : [...prev, emp.id],
                      );
                    }}
                  />
                </td>

                {/* Desktop-only cells */}
                <td className="col-desktop">{emp.last_name}</td>
                <td className="col-desktop">{starPrefix}{emp.name}</td>
                <td className="col-desktop">{emp.job_title}</td>
                <td className="col-desktop">
                  {locationLabel}
                  {emp.is_extra && (
                    <span style={{ marginLeft: 4, fontSize: 11, color: '#1677ff' }}>
                      ({emp.extra_type === 'rental' ? 'түрээсийн' : 'сунасан'})
                    </span>
                  )}
                </td>

                {/* Mobile combined cell */}
                <td className="col-mobile">
                  <div className="emp-name-cell">
                    <div className="emp-name-main">
                      {starPrefix}{emp.last_name} {emp.name}
                    </div>
                    <div className="emp-name-meta">
                      {emp.job_title}
                      {emp.job_title && locationLabel ? ' · ' : ''}
                      {locationLabel}
                      {extraLabel}
                    </div>
                  </div>
                </td>

                <td>
                  <span className={`badge ${emp.is_swiped ? 'success' : 'error'}`}>
                    {emp.is_swiped ? 'Шивэгдсэн' : 'Шивэгдээгүй'}
                  </span>
                </td>

                <td>{renderActionBtn(emp)}</td>

              </tr>
            );
          })}
        </tbody>

      </table>
    </div>
  );
}

export default EmployeeTable;
