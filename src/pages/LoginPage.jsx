import React, { useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import Layout from '../components/Shared/Layout';
import styles from './styles/LoginPage.module.scss';

const LoginPage = () => {
  const [email,    setEmail]    = useState('');
  const [password, setPassword] = useState('');
  const [error,    setError]    = useState('');
  const [isLoading, setIsLoading] = useState(false);

  const { login } = useAuth();
  const navigate  = useNavigate();
  const location  = useLocation();
  const from      = location.state?.from?.pathname || '/';

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');

    if (!email || !password) {
      setError('請輸入 Email 和密碼');
      return;
    }
    setIsLoading(true);
    const res = await login(email, password);
    if (res.success) navigate(from, { replace: true });
    else setError(res.message);
    setIsLoading(false);
  };

  return (
    <Layout>
      <div className={styles.loginContainer}>
        <div className={styles.loginBox}>
          <h2>登入</h2>
          {error && <div className={styles.error}>{error}</div>}
          <form onSubmit={handleSubmit} className={styles.loginForm}>
            <div className={styles.formGroup}>
              <label htmlFor="email">Email</label>
              <input
                id="email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                disabled={isLoading}
                placeholder="請輸入 Email"
              />
            </div>

            <div className={styles.formGroup}>
              <label htmlFor="password">密碼</label>
              <input
                id="password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                disabled={isLoading}
                placeholder="請輸入密碼"
              />
            </div>

            <button type="submit" disabled={isLoading} className={styles.loginButton}>
              {isLoading ? '登入中…' : '登入'}
            </button>
          </form>
        </div>
      </div>
    </Layout>
  );
};

export default LoginPage;
