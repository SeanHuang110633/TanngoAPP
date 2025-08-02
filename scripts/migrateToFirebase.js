import { readFile } from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';
import { initializeApp } from 'firebase/app';
import { getFirestore, collection, doc, writeBatch } from 'firebase/firestore';
import dotenv from 'dotenv';

// 載入環境變數
dotenv.config({ path: path.resolve(process.cwd(), '.env') });

// 在 ES Modules 中獲取 __dirname 的等價物
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

console.log("app專案路徑名稱 : ", __dirname);

// 檢查必要的環境變數
const requiredEnvVars = [
  'VITE_FIREBASE_API_KEY',
  'VITE_FIREBASE_AUTH_DOMAIN',
  'VITE_FIREBASE_PROJECT_ID',
  'VITE_FIREBASE_STORAGE_BUCKET',
  'VITE_FIREBASE_MESSAGING_SENDER_ID',
  'VITE_FIREBASE_APP_ID'
];

requiredEnvVars.forEach(envVar => {
  if (!process.env[envVar]) {
    throw new Error(`❌ 缺少必要的環境變數: ${envVar}`);
  }
});

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

// 單字檔案列表(每次只要改level和files就可以上傳不同的檔案)
// 詞性對應表
const CATEGORY_MAP = {
  'noun': '名詞',
  'verb': '動詞',
  'adj': 'い形容詞',
  'na-adj': 'な形容詞',
  'adverb': '副詞',
  'loanword': '外來語'
};

const level = 'N0';
const files = [
  { type: 'adj-na', file: 'N0_adj-na.json' },
  // { type: 'verb', file: 'N5_verb.json' },
  // { type: 'adj', file: 'N5_adj.json' },
  // { type: 'adj-na', file: 'N5_adj-na.json'},
  // { type: 'adv', file: 'N5_adv.json'},
  // { type: 'loanword', file: 'N5_loanword.json'},
];

// 讀取 JSON 檔案
async function readJsonFile(filePath) {
  try {
    const data = await readFile(filePath, 'utf8');
    return JSON.parse(data);
  } catch (error) {
    console.error(`讀取檔案 ${filePath} 時發生錯誤:`, error);
    throw error;
  }
}

// 上傳單字到 Firestore
async function uploadWordsToFirestore(level, category, words, originalData) {
  // 單字很少，批次上傳沒太大必要，但先留著
  const BATCH_SIZE = 500; 
  let totalProcessed = 0;
  
  try {
    console.log(`🔄 正在處理 ${category} 類別，共 ${words.length} 個單字...`);
    
    // 分批處理單字
    for (let i = 0; i < words.length; i += BATCH_SIZE) {
      const batch = writeBatch(db);
      const batchWords = words.slice(i, i + BATCH_SIZE);
      const collectionRef = collection(db, level);
      const docRef = doc(collectionRef, category);
      
      // 準備要寫入的資料，保持原始資料不變
      const wordData = {
        ...originalData,  // 保留原始資料的所有屬性
        words: batchWords,  // 直接使用批次處理的單字
        updatedAt: new Date().toISOString()  // 只更新更新時間
      };

      // 添加到批次
      batch.set(docRef, wordData, { merge: true });
      
      // 執行批次寫入
      await batch.commit();
      
      totalProcessed += batchWords.length;
      const progress = Math.min(Math.round((i + batchWords.length) / words.length * 100), 100);
      process.stdout.write(`\r📊 進度: ${progress}% (${i + batchWords.length}/${words.length})`);
    }
    
    console.log(`\n✅ 已上傳 ${level} ${category} 類別，共 ${words.length} 個單字`);
    return words.length;
    
  } catch (error) {
    console.error(`\n❌ 上傳 ${category} 類別時發生錯誤:`, error.message);
    throw error;
  }
}

// 主函數
async function main() {
  const startTime = Date.now();
  
  try {
    console.log('🚀 開始上傳單字資料到 Firebase...');
    console.log('📌 專案 ID:', firebaseConfig.projectId);
    
    let totalWords = 0;
    let successfulFiles = 0;
    
    // 處理每個檔案
    for (const { type, file } of files) {
      const filePath = path.join(__dirname, '..', 'public', file);
      console.log("看看 filePath : ", filePath);
      
      try {
        const data = await readJsonFile(filePath);
        
        if (!data.words || !Array.isArray(data.words)) {
          console.warn(`⚠️ ${file} words 格式不符合預期，跳過`);
          continue;
        }
        
        console.log(`🔍 找到 ${data.words.length} 個單字`);
        
        // 上傳單字到 Firestore，傳入整個 data 物件
        const count = await uploadWordsToFirestore(level, type, data.words, data);
        totalWords += count;
        successfulFiles++;
        
      } catch (error) {
        console.error(`\n❌ 處理 ${file} 時發生嚴重錯誤:`, error.message);
        console.error('詳細錯誤:', error);
        // 繼續處理下一個檔案
      }
    }

    const executionTime = ((Date.now() - startTime) / 1000).toFixed(2);
    console.log('\n' + '='.repeat(50));
    console.log(`🎉 資料上傳完成！`);
    console.log(`📊 成功處理: ${successfulFiles}/${files.length} 個檔案`);
    console.log(`📝 總共上傳了 ${totalWords} 個 ${level} 單字`);
    console.log(`⏱️ 總執行時間: ${executionTime} 秒`);
    console.log('='.repeat(50));
    
  } catch (error) {
    console.error('\n❌ 上傳過程中發生未預期的錯誤:', error.message);
    console.error('堆疊追蹤:', error.stack);
    process.exit(1);
  } finally {
    process.exit(0);
  }
}

// 執行主函數
main();
