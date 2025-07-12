import React, { useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import Layout from '../components/Shared/Layout';
import styles from './styles/LoginPage.module.scss';

const LoginPage = () => {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  
  const { login } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  
  // 從哪裡重定向過來的路徑
  const from = location.state?.from?.pathname || '/';

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    
    if (!username || !password) {
      setError('請輸入用戶名和密碼');
      return;
    }
    
    try {
      setIsLoading(true);
      const result = await login(username, password);
      
      if (result.success) {
        navigate(from, { replace: true });
      } else {
        setError(result.message || '登入失敗');
      }
    } catch (error) {
      console.error('登入時出錯:', error);
      setError('登入時發生錯誤');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Layout>
      <div className={styles.loginContainer}>
        <div className={styles.loginBox}>
          <h2>登入</h2>
          {error && <div className={styles.error}>{error}</div>}
          
          <form onSubmit={handleSubmit} className={styles.loginForm}>
            <div className={styles.formGroup}>
              <label htmlFor="username">用戶名</label>
              <input
                id="username"
                type="text"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                disabled={isLoading}
                placeholder="請輸入用戶名"
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
            
            <button 
              type="submit" 
              className={styles.loginButton}
              disabled={isLoading}
            >
              {isLoading ? '登入中...' : '登入'}
            </button>
          </form>
        </div>
      </div>
    </Layout>
  );
};

export default LoginPage;
