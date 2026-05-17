import { useCallback, useState } from 'react';
import {
  addEmployeeToGroup,
  createGroup    as storageCreate,
  deleteGroup    as storageDelete,
  loadGroups,
  removeEmployeeFromGroup,
  updateGroup    as storageUpdate,
} from './groupsStorage';

/**
 * React hook for managing operational employee groups.
 *
 * State is initialised from localStorage on first render.
 * Every mutating operation writes through to storage and refreshes local state
 * atomically, so the component always reflects what was persisted.
 *
 * @returns {{
 *   groups:         Array,
 *   createGroup:    (data: object) => object,
 *   updateGroup:    (id: string, changes: object) => void,
 *   deleteGroup:    (id: string) => void,
 *   addEmployee:    (groupId: string, employee: object) => void,
 *   removeEmployee: (groupId: string, employeeId: number) => void,
 *   refresh:        () => void,
 * }}
 */
export function useGroups() {
  const [groups, setGroups] = useState(() => loadGroups());

  /** Pull the latest state from storage into React state. */
  const refresh = useCallback(() => setGroups(loadGroups()), []);

  const handleCreate = useCallback((data) => {
    const group = storageCreate(data);
    setGroups(loadGroups());
    return group;
  }, []);

  const handleUpdate = useCallback((id, changes) => {
    storageUpdate(id, changes);
    setGroups(loadGroups());
  }, []);

  const handleDelete = useCallback((id) => {
    storageDelete(id);
    setGroups(loadGroups());
  }, []);

  const handleAddEmployee = useCallback((groupId, employee) => {
    addEmployeeToGroup(groupId, employee);
    setGroups(loadGroups());
  }, []);

  const handleRemoveEmployee = useCallback((groupId, employeeId) => {
    removeEmployeeFromGroup(groupId, employeeId);
    setGroups(loadGroups());
  }, []);

  return {
    groups,
    refresh,
    createGroup:    handleCreate,
    updateGroup:    handleUpdate,
    deleteGroup:    handleDelete,
    addEmployee:    handleAddEmployee,
    removeEmployee: handleRemoveEmployee,
  };
}
