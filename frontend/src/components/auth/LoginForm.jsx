import React, { useState } from 'react';
import { useAuth } from '../../context/AuthContext';

function LoginForm() {
  const { login } = useAuth();
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError]       = useState('');
  const [isLoading, setIsLoading] = useState(false);

  const handleSubmit = async () => {
    if (!username.trim() || !password.trim()) return;
    setError('');
    setIsLoading(true);
    try {
      await login(username, password);
    } catch (err) {
      setError(err.message || 'Нэвтрэхэд алдаа гарлаа');
    } finally {
      setIsLoading(false);
    }
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Enter') handleSubmit();
  };

  return (
    <div className="login-box">
      <h1>Camp Meal Login</h1>

      {error && (
        <div style={{ color: '#ff4d4f', marginBottom: 12, fontSize: 14 }}>
          {error}
        </div>
      )}

      <input
        type="text"
        placeholder="Нэвтрэх нэр"
        value={username}
        onChange={(e) => setUsername(e.target.value)}
        onKeyDown={handleKeyDown}
        disabled={isLoading}
      />

      <input
        type="password"
        placeholder="Нууц үг"
        value={password}
        onChange={(e) => setPassword(e.target.value)}
        onKeyDown={handleKeyDown}
        disabled={isLoading}
      />

      <button
        className="login-btn"
        onClick={handleSubmit}
        disabled={isLoading}
      >
        {isLoading ? 'Нэвтэрч байна...' : 'Нэвтрэх'}
      </button>
    </div>
  );
}

export default LoginForm;
