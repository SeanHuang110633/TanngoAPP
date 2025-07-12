import React from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import styles from './styles/Navbar.module.scss';

const Navbar = () => {
  const { currentUser, logout } = useAuth();
  const navigate = useNavigate();
  
  const handleLogout = async () => {
    try {
      await logout();
      navigate('/login');
    } catch (error) {
      console.error('登出失敗:', error);
    }
  };
  
  return (
    <nav className={styles.navbar}>
      <Link to="/" className={styles.logo}>日文單字間隔複習</Link>
      <div className={styles.navLinks}>
        {currentUser ? (
          // 已登入狀態
          <>
            <button onClick={() => navigate('/n5')} className={styles.navLink}>N5</button>
            <button onClick={() => navigate('/n4')} className={styles.navLink}>N4</button>
            <div className={styles.userSection}>
              <span className={styles.username}>歡迎, {currentUser.name}</span>
              <button onClick={handleLogout} className={`${styles.navLink} ${styles.logoutButton}`}>
                登出
              </button>
            </div>
          </>
        ) : (
          // 未登入狀態
          <button 
            onClick={() => navigate('/login')} 
            className={`${styles.navLink} ${styles.loginButton}`}
          >
            登入
          </button>
        )}
      </div>
    </nav>
  );
};

export default Navbar;
