import { initializeApp } from 'firebase/app';
import { getFirestore, doc, setDoc } from 'firebase/firestore';
import dotenv from 'dotenv';

// 載入環境變數
dotenv.config({ path: path.resolve(process.cwd(), '.env') });

// Firebase 設定
const firebaseConfig = {
  apiKey: process.env.VITE_FIREBASE_API_KEY,
  authDomain: process.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: process.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.VITE_FIREBASE_APP_ID
};

// 初始化 Firebase
const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

// 添加用戶到 Firestore
async function addUser(userData) {
  try {
    const userRef = doc(db, 'User', userData.name);
    await setDoc(userRef, userData);
    console.log(`用戶 ${userData.name} 已成功添加到 Firestore`);
    return true;
  } catch (error) {
    console.error('添加用戶時出錯:', error);
    return false;
  }
}

// 要添加的用戶資料
const userData = {
  name: "Sean",
  pwd: "",
  // record中記錄的是下次複習的時間例如2025-07-11，初始化是空，因為還沒開始任何複習
  N5_record: {
    "verb": "",
    "noun": "",
    "adj": "",
    "adj-na": "",
    "adv": "",
    "loanword": ""
  },
  N4_record: {
    "verb": "",
    "noun": "",
    "adj": "",
    "adj-na": "",
    "adv": "",
    "loanword": ""
  }
};

// 執行添加用戶
addUser(userData)
  .then(success => {
    if (success) {
      console.log('用戶添加完成');
      process.exit(0);
    } else {
      console.error('添加用戶失敗');
      process.exit(1);
    }
  });
