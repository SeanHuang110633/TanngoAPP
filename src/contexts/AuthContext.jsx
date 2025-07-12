import React, { createContext, useContext, useState, useEffect } from 'react';
import { getFirestore, doc, getDoc } from 'firebase/firestore';
import app from '../firebase';

// 創建並導出 AuthContext
export const AuthContext = createContext();
const db = getFirestore(app);

export function useAuth() {
  return useContext(AuthContext);
}

export function AuthProvider({ children }) {
  const [currentUser, setCurrentUser] = useState(null);
  const [loading, setLoading] = useState(true);

  // 登入函數
  const login = async (username, password) => {
    try {
      // 從 Firestore 獲取用戶資料
      const userRef = doc(db, 'User', username); // 因為db是用小寫當doc id
      const userDoc = await getDoc(userRef);
      
      if (userDoc.exists()) {
        const userData = userDoc.data();
        // 注意：在生產環境中，應該使用 bcrypt 等庫進行密碼驗證
        if (userData.pwd === password) {
          console.log("username:" + userData.name);
          setCurrentUser(userData.name);
          localStorage.setItem('currentUser', JSON.stringify({ name: userData.name }));
          return { success: true };
        }
      }
      return { success: false, message: '用戶名或密碼錯誤' };
    } catch (error) {
      console.error('登入時出錯:', error);
      return { success: false, message: '登入時發生錯誤' };
    }
  };

  // 登出函數
  const logout = () => {
    setCurrentUser(null);
    localStorage.removeItem('currentUser');
  };

  // 檢查本地存儲中是否有登入狀態
  useEffect(() => {
    const storedUser = localStorage.getItem('currentUser');
    if (storedUser) {
      setCurrentUser(JSON.parse(storedUser).name);
    }
    setLoading(false);
  }, []);

  const value = {
    currentUser,
    login,
    logout,
    isAuthenticated: !!currentUser
  };

  return (
    <AuthContext.Provider value={value}>
      {!loading && children}
    </AuthContext.Provider>
  );
}

export default AuthContext;
