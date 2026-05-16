import React from 'react';

import {
  LOCATION_LABELS
} from '../../shared/constants';

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

  return (
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

                  setSelectedEmployees(prev => [
                    ...new Set([...prev, ...ids])
                  ]);

                } else {

                  setSelectedEmployees(prev =>
                    prev.filter(id => !ids.includes(id))
                  );

                }

              }}
            />
          </th>

          <th>Овог</th>
          <th>Нэр</th>
          <th>Албан тушаал</th>
          <th>Байршил</th>
          <th>Карт</th>
          <th>Тохиргоо</th>

        </tr>
      </thead>

      <tbody>

        {employees.map(emp => (

          <tr
            key={emp.id}
            className={emp.is_swiped ? 'swiped-row' : ''}
          >

            <td>

              <input
                type="checkbox"
                checked={selectedEmployees.includes(emp.id)}
                disabled={emp.is_swiped}
                onChange={() => {

                  setSelectedEmployees(prev =>

                    prev.includes(emp.id)
                      ? prev.filter(x => x !== emp.id)
                      : [...prev, emp.id]

                  );

                }}
              />

            </td>

            <td>{emp.last_name}</td>

            <td>
              {favorites.includes(emp.id) &&
              emp.extra_type === 'rental'
                ? '⭐ '
                : ''}

              {emp.name}
            </td>

            <td>{emp.job_title}</td>

            <td>

              {LOCATION_LABELS[emp.location] ||
                emp.location ||
                '—'}

              {emp.is_extra && (
                <span
                  style={{
                    marginLeft: 4,
                    fontSize: 11,
                    color: '#1677ff'
                  }}
                >
                  (
                  {emp.extra_type === 'rental'
                    ? 'түрээсийн'
                    : 'сунасан'}
                  )
                </span>
              )}

            </td>

            <td>

              <span
                className={`badge ${
                  emp.is_swiped
                    ? 'success'
                    : 'error'
                }`}
              >
                {emp.is_swiped
                  ? 'Шивэгдсэн'
                  : 'Шивэгдээгүй'}
              </span>

            </td>

            <td>

              {favorites.includes(emp.id) ? (

                <button
                  type="button"
                  className="action-btn"
                  style={{
                    borderColor: '#ff4d4f',
                    color: '#ff4d4f'
                  }}
                  onClick={() =>
                    removeFavorite(emp.id)
                  }
                >
                  Хасах
                </button>

              ) : emp.is_extra ? (

                <button
                  type="button"
                  className="action-btn"
                  style={{
                    borderColor: '#ff9800',
                    color: '#ff9800'
                  }}
                  onClick={() =>
                    removeExtraEmployee(emp.id)
                  }
                >
                  Нэмэлтээс хасах
                </button>

              ) : isFavoriteEligible(emp) ? (

                <button
                  type="button"
                  className="action-btn"
                  style={{
                    borderColor: '#1677ff',
                    color: '#1677ff'
                  }}
                  onClick={() =>
                    saveFavorite(emp.id)
                  }
                >
                  Хадгалах
                </button>

              ) : (

                <button
                  type="button"
                  className="action-btn"
                  style={{
                    borderColor: '#ff4d4f',
                    color: '#ff4d4f'
                  }}
                  onClick={() =>
                    hideEmployee(emp.id)
                  }
                >
                  Хасах
                </button>

              )}

            </td>

          </tr>

        ))}

      </tbody>

    </table>
  );
}

export default EmployeeTable;