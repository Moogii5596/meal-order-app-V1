import React, { useState, useEffect, useRef } from 'react';

import { fetchRentalEmployees, searchEmployees } from '../../services/employees';

function AddEmployeeModal({
  onAdd,
  onClose,
  favorites = []
}) {

  const [tab, setTab] = useState('sunasan');
  const [query, setQuery] = useState('');
  const [results, setResults] = useState([]);
  const [searching, setSearching] = useState(false);
  const currentFetchController = useRef(null);

  useEffect(() => {
    if (currentFetchController.current) {
      currentFetchController.current.abort();
    }

    if (tab === 'rental') {
      setSearching(true);
      const controller = new AbortController();
      currentFetchController.current = controller;

      fetchRentalEmployees('', controller.signal)
        .then(data => {
          setResults(data);
          setSearching(false);
        })
        .catch(error => {
          if (error.name === 'AbortError') return;
          setResults([]);
          setSearching(false);
        });
    } else {
      setResults([]);
      setQuery('');
    }

    return () => {
      currentFetchController.current?.abort();
    };
  }, [tab]);

  const search = () => {

    if (tab === 'sunasan') {
      if (!query.trim()) return;
      setSearching(true);
      if (currentFetchController.current) {
        currentFetchController.current.abort();
      }

      const controller = new AbortController();
      currentFetchController.current = controller;

      searchEmployees(query, controller.signal)
        .then(data => {
          setResults(data);
          setSearching(false);
        })
        .catch(error => {
          if (error.name === 'AbortError') return;
          setResults([]);
          setSearching(false);
        });
    } else {
      setSearching(true);
      if (currentFetchController.current) {
        currentFetchController.current.abort();
      }

      const controller = new AbortController();
      currentFetchController.current = controller;

      fetchRentalEmployees(query, controller.signal)
        .then(data => {
          setResults(data);
          setSearching(false);
        })
        .catch(error => {
          if (error.name === 'AbortError') return;
          setResults([]);
          setSearching(false);
        });
    }

  };

  return (
    <div
      className="modal-overlay"
      onClick={onClose}
    >

      <div
        className="modal-box"
        onClick={e => e.stopPropagation()}
      >

        <div className="modal-header">
          <strong>Ажилтан нэмэх</strong>

          <button
            className="action-btn"
            onClick={onClose}
          >
            ✕
          </button>
        </div>

        <div
          className="meal-types"
          style={{ marginBottom: 12 }}
        >

          <button
            className={tab === 'sunasan' ? 'active' : ''}
            onClick={() => setTab('sunasan')}
          >
            Сунасан
          </button>

          <button
            className={tab === 'rental' ? 'active' : ''}
            onClick={() => setTab('rental')}
          >
            Түрээсийн
          </button>

        </div>

        <div
          style={{
            display: 'flex',
            gap: 8,
            marginBottom: 12
          }}
        >

          <input
            style={{
              flex: 1,
              padding: '8px 12px',
              border: '1px solid #d9d9d9',
              borderRadius: 6,
              fontSize: 14
            }}
            placeholder="Нэрээр хайх..."
            value={query}
            onChange={e => setQuery(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && search()}
          />

          <button
            className="approve-btn"
            onClick={search}
            disabled={searching}
          >
            {searching ? 'Хайж байна...' : 'Хайх'}
          </button>

        </div>

        {searching && (
          <div className="empty-state">
            Уншиж байна...
          </div>
        )}

        {!searching &&
          results.length === 0 &&
          tab === 'sunasan' && (
            <div
              className="empty-state"
              style={{ padding: 20 }}
            >
              Нэр бичиж хайна уу
            </div>
          )}

        {results.length > 0 && (
          <table className="employee-table">

            <thead>
              <tr>
                <th>Нэр</th>
                <th>Хэлтэс</th>
                <th></th>
              </tr>
            </thead>

            <tbody>

              {results.map(emp => (
                <tr key={emp.id}>

                  <td>
                    {favorites.includes(emp.id) &&
                    tab === 'rental'
                      ? '⭐ '
                      : ''}

                    {emp.last_name} {emp.name}
                  </td>

                  <td
                    style={{
                      fontSize: 12,
                      color: '#888'
                    }}
                  >
                    {emp.dept_name}
                  </td>

                  <td>
                    <button
                      className="confirm-btn"
                      onClick={() => {
                        onAdd(emp, tab);
                        onClose();
                      }}
                    >
                      Нэмэх
                    </button>
                  </td>

                </tr>
              ))}

            </tbody>

          </table>
        )}

      </div>
    </div>
  );
}

export default AddEmployeeModal;
