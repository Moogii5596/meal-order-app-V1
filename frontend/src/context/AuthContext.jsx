import React, {
  createContext,
  useContext,
  useEffect,
  useState
} from 'react';

const API =
  process.env.REACT_APP_API_URL

const AuthContext = createContext();

export function AuthProvider({ children }) {
  const [token, setToken] = useState(null);
  const [role, setRole] = useState(null);
  const [userDept, setUserDept] = useState(null);
  const [userLocation, setUserLocation] = useState(null);
  const [isLoadingAuth, setIsLoadingAuth] = useState(true);

  // App start үед localStorage-оос auth сэргээх
  useEffect(() => {
    const storedToken =
      localStorage.getItem('authToken');

    if (!storedToken) {
      setIsLoadingAuth(false);
      return;
    }

    fetch(`${API}/me`, {
      headers: {
        Authorization: `Bearer ${storedToken}`
      }
    })
      .then(res => {
        if (!res.ok) {
          throw new Error('Unauthorized');
        }

        return res.json();
      })
      .then(data => {
        setToken(storedToken);
        setRole(data.role);

        if (data.dept_id) {
          setUserDept({
            id: String(data.dept_id),
            name: data.dept_name
          });
        }

        if (data.location) {
          setUserLocation(data.location);
        }
      })
      .catch(() => {
        logout();
      })
      .finally(() => {
        setIsLoadingAuth(false);
      });

  }, []);

  // Login
  const login = async (username, password) => {
    const res = await fetch(`${API}/login`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        username,
        password
      })
    });

    const data = await res.json();

    if (!data.success) {
      throw new Error(
        'Нэвтрэх нэр эсвэл нууц үг буруу'
      );
    }

    localStorage.setItem(
      'authToken',
      data.token
    );

    setToken(data.token);
    setRole(data.role);

    if (data.dept_id) {
      setUserDept({
        id: String(data.dept_id),
        name: data.dept_name
      });
    }

    if (data.location) {
      setUserLocation(data.location);
    }

    return data;
  };

  // Logout
  const logout = () => {
    localStorage.removeItem('authToken');

    setToken(null);
    setRole(null);
    setUserDept(null);
    setUserLocation(null);
  };

  return (
    <AuthContext.Provider
      value={{
        token,
        role,
        userDept,
        userLocation,
        isLoadingAuth,
        login,
        logout
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  return useContext(AuthContext);
}