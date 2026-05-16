import { useEffect, useState } from 'react';
import { login, getMe } from '../services/authService';

export default function useAuth() {
  const [role, setRole] = useState(null);
  const [token, setToken] = useState(null);
  const [userDept, setUserDept] = useState(null);
  const [userLocation, setUserLocation] = useState(null);
  const [isLoadingAuth, setIsLoadingAuth] = useState(true);

  useEffect(() => {
    const storedToken = localStorage.getItem('authToken');

    if (!storedToken) {
      setIsLoadingAuth(false);
      return;
    }

    getMe(storedToken)
      .then(data => {
        if (data.role) {
          setToken(storedToken);
          setRole(data.role);

          if (data.dept_id) {
            setUserDept({
              id: String(data.dept_id),
              name: data.dept_name,
            });
          }

          if (data.location) {
            setUserLocation(data.location);
          }
        } else {
          localStorage.removeItem('authToken');
        }
      })
      .catch(() => {
        localStorage.removeItem('authToken');
      })
      .finally(() => {
        setIsLoadingAuth(false);
      });
  }, []);

  const handleLogin = async (username, password) => {
    const data = await login(username, password);

    if (!data.success) {
      throw new Error('Нэвтрэх нэр эсвэл нууц үг буруу байна');
    }

    setRole(data.role);
    setToken(data.token);

    if (data.dept_id) {
      setUserDept({
        id: String(data.dept_id),
        name: data.dept_name,
      });

      localStorage.setItem('authDeptId', String(data.dept_id));
      localStorage.setItem('authDeptName', data.dept_name);
    }

    if (data.location) {
      setUserLocation(data.location);
      localStorage.setItem('authLocation', data.location);
    }

    localStorage.setItem('authToken', data.token);
  };

  const handleLogout = () => {
    setRole(null);
    setToken(null);
    setUserDept(null);
    setUserLocation(null);

    localStorage.clear();
  };

  return {
    role,
    token,
    userDept,
    userLocation,
    isLoadingAuth,
    handleLogin,
    handleLogout,
  };
}