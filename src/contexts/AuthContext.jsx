import React, {
  createContext, useContext, useState, useEffect,
} from 'react';
import {
  signInWithEmailAndPassword,
  signOut,
  onAuthStateChanged,
  updateProfile,
} from 'firebase/auth';
import { auth } from '../firebase';   // 現在從同一檔匯入

export const AuthContext = createContext();
export function useAuth() { return useContext(AuthContext); }

export function AuthProvider({ children }) {
  const [currentUser, setCurrentUser] = useState(null);
  const [loading, setLoading] = useState(true);

  // 登入函數
  const login = async (email, password) => {
    try {
      const userCredential = await signInWithEmailAndPassword(auth, email, password);
      const user = userCredential.user;
      console.log('登入成功：', user);

      if (!user.displayName) {
        let name = '';
        if (email.includes('sean')) name = 'Sean';
        else if (email.includes('grace')) name = 'Grace';

        await updateProfile(user, { displayName: name });
        console.log(`DisplayName 設定為：${name}`);
      }

      return { success: true };
    } catch (err) {
      console.error('登入失敗：', err.code, err.message);
      let msg = '登入失敗';
      if (err.code === 'auth/user-not-found' || err.code === 'auth/wrong-password') {
        msg = '帳號或密碼錯誤';
      }
      return { success: false, message: msg };
    }
  };

  // 登出函數
  const logout = () => signOut(auth);

  // 監聽使用者狀態
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      setCurrentUser(user);   // user 為 null → 已登出

      if(user){
        localStorage.setItem('currentUser', JSON.stringify({ name: user.displayName }));
      }else{
        localStorage.removeItem('currentUser');
      }

      console.log('使用者狀態改變：', user);
      setLoading(false);
    });
    return unsubscribe;       // componentWillUnmount 時解除監聽
  }, []);

  const value = {
    currentUser,           // 直接是 Firebase User 物件
    isAuthenticated: !!currentUser,
    login,
    logout,
  };

  return (
    <AuthContext.Provider value={value}>
      {!loading && children}
    </AuthContext.Provider>
  );
}