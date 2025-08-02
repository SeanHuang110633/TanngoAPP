// src/firebase.js
import { initializeApp } from "firebase/app";
import { getFirestore, collection, doc, getDoc, setDoc, updateDoc, deleteDoc, query, where, getDocs } from "firebase/firestore";

// 檢查必要的環境變數
const requiredEnvVars = [
  'VITE_FIREBASE_API_KEY',
  'VITE_FIREBASE_AUTH_DOMAIN',
  'VITE_FIREBASE_PROJECT_ID',
  'VITE_FIREBASE_STORAGE_BUCKET',
  'VITE_FIREBASE_MESSAGING_SENDER_ID',
  'VITE_FIREBASE_APP_ID'
];

// 驗證環境變數
requiredEnvVars.forEach(envVar => {
  if (!import.meta.env[envVar]) {
    console.error(`錯誤：缺少必要的環境變數 ${envVar}`);
  }
});

// Firebase 設定
const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: import.meta.env.VITE_FIREBASE_APP_ID
};

// 初始化 Firebase
const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

// 定義了要操作的「集合名稱（collections）」，避免 hardcode，增加可維護性。
// COLLECTIONS 相當於table
const COLLECTIONS = {
  USER: 'User',
  SEAN: 'Sean',
  N5: 'N5',
  N4: 'N4' 
};


// 獲取或創建用戶資料
const getUserData = async (userId) => {
  const userRef = doc(db, COLLECTIONS.USER, userId);
  const userSnap = await getDoc(userRef);
  
  if (!userSnap.exists()) {
    return await initUserData(userId);
  }
  
  return userSnap.data();
};

// 獲取用戶學習記錄
const getRecord = async (userId, level) => {
  try {
    const userRef = doc(db, COLLECTIONS.USER, userId);
    const userSnap = await getDoc(userRef);
    
    if (!userSnap.exists()) {
      // 如果用戶不存在，拋出錯誤
      throw new Error(`用戶${userId}不存在`);
    }
    
    const userData = userSnap.data();
    console.log('userData:', userData);
    const record_name = level + '_record';
    console.log('record_name:', record_name);
    return userData[record_name] || {};
  } catch (error) {
    console.error('獲取 ' + level + ' 記錄時出錯:', error);
    return {};
  }
};


// 更新用戶的學習記錄
const updateRecord = async (userId, category, status, level) => {
  try {
    const userRef = doc(db, COLLECTIONS.USER, userId); // 用小寫當doc id
    const userSnap = await getDoc(userRef);
    
    let userData = {};
    if (userSnap.exists()) {
      userData = userSnap.data();
    }else{
      alert(`用戶${userId}不存在`);
      return;
    }
    
    // 更新 N5_record，更新選到的詞性的值(初始化的話就是當天，如果是復習的話就另外處理)
    const updatedRecord = {
      ...userData,
      [level + '_record']: {
        ...(userData[level + '_record'] || {}),
        [category]: status
      },
      updatedAt: new Date().toISOString()
    };
    
    await setDoc(userRef, updatedRecord, { merge: true });
    return updatedRecord[level + '_record'];
  } catch (error) {
    console.error('更新 ' + level + ' 記錄時出錯:', error);
    throw error;
  }
};


// 保存單字資料
const saveWord = async (userId, wordData) => {
  const wordRef = doc(collection(db, COLLECTIONS.USER_WORDS, userId, COLLECTIONS.WORDS));
  await setDoc(wordRef, {
    ...wordData,
    id: wordRef.id,
    userId,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  });
  return wordRef.id;
};

// 更新單字資料
const updateWord = async (userId, wordId, updates) => {
  const wordRef = doc(db, COLLECTIONS.USER_WORDS, userId, COLLECTIONS.WORDS, wordId);
  await updateDoc(wordRef, {
    ...updates,
    updatedAt: new Date().toISOString()
  });
};

// 獲取用戶的所有單字
const getUserWords = async (userId) => {
  const q = query(collection(db, COLLECTIONS.USER_WORDS, userId, COLLECTIONS.WORDS));
  const querySnapshot = await getDocs(q);
  return querySnapshot.docs.map(doc => ({
    id: doc.id,
    ...doc.data()
  }));
};

// 刪除單字
const deleteWord = async (userId, wordId) => {
  const wordRef = doc(db, COLLECTIONS.USER_WORDS, userId, COLLECTIONS.WORDS, wordId);
  await deleteDoc(wordRef);
};

export {
  db,
  COLLECTIONS,
  getUserData,
  updateRecord,
  saveWord,
  updateWord,
  getUserWords,
  deleteWord,
  getRecord
};

export default app;
