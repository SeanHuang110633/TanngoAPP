import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { getN5Record, db, COLLECTIONS } from '../firebase';
import { doc, getDoc, setDoc } from 'firebase/firestore';
import Layout from '../components/Shared/Layout';
import { WORD_CATEGORIES } from '../utils/constants';
import styles from './styles/LevelPage.module.scss';

// 計算日期加n天
const addDays = (date, days) => {
  const result = new Date(date);
  result.setDate(result.getDate() + days);
  return result.toISOString().split('T')[0]; // 返回 YYYY-MM-DD 格式
};

const N5Page = () => {
  const currentUser = JSON.parse(localStorage.getItem('currentUser')).name;
  const [categoryStatus, setCategoryStatus] = useState({});
  const [isLoading, setIsLoading] = useState(true);
  const [showGoalModal, setShowGoalModal] = useState(false);
  const [selectedCategory, setSelectedCategory] = useState('');
  const [dailyGoal, setDailyGoal] = useState('');
  const [categoryTotalWords, setCategoryTotalWords] = useState(0);
  const navigate = useNavigate();
  
  // 獲取分類的單字總數
  const fetchCategoryTotalWords = async (category) => {
    try {
      const categoryDocRef = doc(db, COLLECTIONS.N5, `${category}`);
      const categoryDoc = await getDoc(categoryDocRef);
      
      if (categoryDoc.exists()) {
        const data = categoryDoc.data();
        return data.words.length || 0;
      }
      return 0;
    } catch (error) {
      console.error(`獲取 ${category} 單字總數時出錯:`, error);
      return 0;
    }
  };
  

  // 載入 N5 學習記錄
  useEffect(() => {
    const loadN5Record = async () => {
      if (!currentUser) {
        setIsLoading(false);
        return;
      }

      try {
        console.log("currentUser:", currentUser);
        const record = await getN5Record(currentUser);
        console.log("record:", JSON.stringify(record, null, 2));
        console.log("record type:", typeof record);
        console.log("record keys:", Object.keys(record));
        setCategoryStatus(record);
      } catch (error) {
        console.error('載入 N5 學習記錄時出錯:', error);
        setCategoryStatus({});
      } finally {
        setIsLoading(false);
      }
    };

    loadN5Record();
  }, [currentUser]);

  // 當選擇分類時，獲取該分類的單字總數
  useEffect(() => {
    if (selectedCategory) {
      fetchCategoryTotalWords(selectedCategory).then(count => {
        setCategoryTotalWords(count);
      });
    }
  }, [selectedCategory]);

  // 初始化學習記錄
  const initializeLearning = async () => {
    if (!selectedCategory || !dailyGoal || !currentUser) return;
    
    setIsLoading(true);
    
    try {
      // 1. 從 Firebase 獲取該詞性的單字列表
      const categoryDocRef = doc(db, COLLECTIONS.N5, `${selectedCategory}`);
      const categoryDoc = await getDoc(categoryDocRef);
      
      if (!categoryDoc.exists()) {
        throw new Error(`找不到 ${selectedCategory} 的單字資料`);
      }
      
      const categoryData = categoryDoc.data();
      const words = categoryData.words || [];
      const totalWords = words.length;
      
      if (totalWords === 0) {
        throw new Error('該分類沒有可用的單字');
      }
      
      // 2. 計算每個單字的 nextReview 日期
      const today = new Date().toISOString().split('T')[0];
      const wordsWithReviewDates = words.map((word, index) => {
        const dayOffset = Math.floor(index / dailyGoal);
        return {
          ...word,
          nextReview: addDays(today, dayOffset)
        };
      });
      
      // 3. 創建學習記錄文檔
      // 文檔 ID 格式: N5_{category}，例如 N5_noun
      const docId = `N5_${selectedCategory}`;
      const learningDocRef = doc(db, COLLECTIONS.SEAN, docId);
      
      // 獲取現有文檔（如果存在）
      const docSnap = await getDoc(learningDocRef);
      
      // 準備要保存的數據
      const learningData = {
        words: wordsWithReviewDates,
        total: totalWords,
        category: selectedCategory,
        level: 'N5',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        // 保留原有的其他字段（如果存在）
        ...(docSnap.exists() ? docSnap.data() : {})
      };
      
      // 保存文檔
      await setDoc(learningDocRef, learningData);
      
  
      // 4. 導向複習頁面
      navigate(`/n5/review/${selectedCategory}`);
      
    } catch (error) {
      console.error('初始化學習記錄時出錯:', error);
      alert(`初始化失敗: ${error.message}`);
    } finally {
      setIsLoading(false);
      setShowGoalModal(false);
    }
  };
  
  // 處理開始學習按鈕點擊
  const handleStartLearning = async (category) => {
    console.log("category:", category);
    const status = categoryStatus[category] || '';
    console.log("status:" + status);
    
    if (!status) {
      console.log("未開始學習");
      // 未開始學習，顯示目標設定對話框
      setSelectedCategory(category);
      setShowGoalModal(true);
    } else {
      console.log("已經開始學習");
      // 已經開始學習，導向複習頁面
      // 檢查是否需要複習（日期小於等於今天）
      const reviewDate = new Date(status);
      const today = new Date();
      console.log("reviewDate:" + reviewDate);
      console.log("today:" + today);
      
      if (reviewDate <= today) {
        console.log("需要複習");
        navigate(`/n5/review/${category}`);
      }else{
        console.log("不需要複習");
        // 如果日期大於今天，不執行任何操作（表示已完成）
        alert(`還未到達${category}的複習日期`);
      }
      
    }
  };

  if (isLoading) {
    return (
      <Layout>
        <div className={styles.loading}>載入中...</div>
      </Layout>
    );
  }
  
  if (!currentUser) {
    return (
      <Layout>
        <div className={styles.unauthorized}>
          <p>請先登入以查看 N5 單字</p>
        </div>
      </Layout>
    );
  }

  return (
    <Layout>
      <div className={styles.levelPage}>
        <h1 className={styles.pageTitle}>N5 單字分類</h1>
        <div className={styles.categoryList}>
          {WORD_CATEGORIES.map(category => {
            const status = categoryStatus[category] || '';
            const statusClass = status ? 
              (new Date(status) > new Date() ? styles.completed : styles.highlight) : 
              '';
              
            return (
              <div
                key={category}
                className={`${styles.categoryItem} ${statusClass}`}
                onClick={() => handleStartLearning(category)}
              >
                <div className={styles.categoryName}>{category}</div>
                <div className={styles.status}>
                  {!status ? '開始學習' : 
                   new Date(status) <= new Date() ? '需要複習' : '已完成'}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* 每日目標設定對話框 */}
      {showGoalModal && (
        <div className={styles.modalOverlay}>
          <div className={styles.modal}>
            <h3>設定每日學習目標 - {selectedCategory}</h3>
            <p>請設定您每天想要學習的單字數量：</p>
            <div className={styles.goalContainer}>
              <input
                type="number"
                min="1"
                value={dailyGoal}
                onChange={(e) => {
                  const value = parseInt(e.target.value);
                  setDailyGoal(Math.min(Math.max(1, value), 150));
                }}
                className={styles.goalInput}
              />
              <span className={styles.totalWords}>
                共 {categoryTotalWords} 個單字，預計 {Math.ceil(categoryTotalWords / dailyGoal)} 天完成
              </span>
            </div>
            <div className={styles.modalActions}>
              <button 
                onClick={() => setShowGoalModal(false)}
                className={styles.cancelButton}
                disabled={isLoading}
              >
                取消
              </button>
              <button 
                onClick={initializeLearning}
                className={styles.confirmButton}
                disabled={!dailyGoal || isLoading}
              >
                {isLoading ? '處理中...' : '開始學習'}
              </button>
            </div>
          </div>
        </div>
      )}
    </Layout>
  );
};

export default N5Page;
