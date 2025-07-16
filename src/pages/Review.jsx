import React, { useState, useEffect } from 'react';
import { useParams, useNavigate, useLocation } from 'react-router-dom';
import { doc, getDoc, updateDoc } from 'firebase/firestore';
import { db, updateN4Record, updateN5Record } from '../firebase';
import Layout from '../components/Shared/Layout';
import { addDays, getTodayString } from '../utils/helpers';
import { SPACING_INTERVALS } from '../utils/constants';
import styles from './styles/ReviewPage.module.scss';

const Review = () => {
  const currentUser = JSON.parse(localStorage.getItem('currentUser'))?.name;
  const { category } = useParams();
  const location = useLocation();
  const [words, setWords] = useState([]); // 拿到整個目前複習的進度
  const [wordsToReview, setWordsToReview] = useState([]); // 拿到這次需要複習的單字
  const [updatedWords, setUpdatedWords] = useState([]); // 紀錄需要更新的單字
  const [currentIndex, setCurrentIndex] = useState(0);
  const [showAnswer, setShowAnswer] = useState(false);
  const [sessionResults, setSessionResults] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [minDate, setMinDate] = useState('');
  const navigate = useNavigate();

  // 從路徑判斷是 N4 還是 N5
  const level = location.pathname.includes('n4-review') ? 'N4' : 'N5';
  const updateRecordFunc = level === 'N4' ? updateN4Record : updateN5Record;
  const collectionPrefix = level; // N4 或 N5
  console.log('Review useEffect' + currentUser);
  console.log('Review useEffect' + level);
  console.log('Review useEffect' + collectionPrefix);

  // 從 Firebase 加載單字數據(是單字原始資料，非個人複習進度)
  useEffect(() => {
    const fetchWords = async () => {
      if (!currentUser) return;
      
      try {
        setIsLoading(true);
        const today = getTodayString();
        
        // 1. 從 {level}_{category} 獲取單字列表
        const docId = `${collectionPrefix}_${category}`;
        const docRef = doc(db, currentUser, docId);
        const docSnap = await getDoc(docRef);
        
        if (!docSnap.exists()) {
          console.error('未找到單字數據');
          return;
        }

        const fetchedWords = docSnap.data().words;
        
        // 先設置 words，然後使用 fetchedWords 進行後續操作
        setWords(fetchedWords);
        
        // 找到目前第二小的日期(後續更新N4/N5_record複習表使用的)
        if (fetchedWords.length >= 2) {
          // 1. 過濾出有 nextReview 的單字
          const wordsWithReview = fetchedWords.filter(word => word.nextReview);
          
          if (wordsWithReview.length >= 2) {
            // 2. 取得所有不重複的日期並排序
            const uniqueDates = [...new Set(
              wordsWithReview.map(word => word.nextReview.split('T')[0])
            )].sort();
            
            if (uniqueDates.length >= 2) {
              // 3. 取得第二個不重複的日期
              const secondUniqueDate = uniqueDates[1];
              setMinDate(secondUniqueDate);
            } else {
              console.log('不重複的日期不足 2 個');
              setMinDate('');
            }
          } else {
            console.log("單字數量不足 2 個");
            setMinDate('');
          }
        }

        // 2. 篩選出需要複習的單字(nextReview日期小於等於今天)
        const wordsReview = fetchedWords.filter(word => 
          !word.nextReview || word.nextReview <= today
        );
        
        setWordsToReview(wordsReview);
        setUpdatedWords(wordsReview);
      } catch (error) {
        console.error('加載單字時出錯:', error);
      } finally {
        setIsLoading(false);
      }
    };

    fetchWords();
  }, [currentUser, category, collectionPrefix]);

  // 處理上一個單字
  const handlePrevious = () => {
    if (currentIndex > 0) {
      setCurrentIndex(prev => prev - 1);
      // 移除上一個結果
      setSessionResults(prev => prev.slice(0, -1));
    }
  };

  // 資料庫更新
  // 更新所有單字
  const updateAllWords = async (wordsToUpdate) => {
    if (!currentUser) return;
    
    try {
      const docId = `${collectionPrefix}_${category}`;
      const docRef = doc(db, currentUser, docId);
      await updateDoc(docRef, { words: words });
    } catch (error) {
      console.error('更新單字時出錯:', error);
      throw error;
    }
  };

  // 更新下次複習日期 (N4/N5_record)
  const updateRecord = async (updatedWords) => {
    if (!currentUser) return;
    let nextReviewDate;
    try {
      // 獲取所有單字中最早的 nextReview 日期
      updatedWords.forEach(word => {
        // 找到目前最小的日期
        nextReviewDate = updatedWords.reduce((min, word) => {
          return word.nextReview < min ? word.nextReview : min;
        }, updatedWords[0].nextReview);
      })
      
      // 比較nextReviewDate與minDate
      const finalDate = nextReviewDate < minDate ? nextReviewDate : minDate;

      // 更新 N4/N5_record
      await updateRecordFunc(currentUser, category, finalDate);
      
    } catch (error) {
      console.error(`更新 ${level}_record 時出錯:`, error);
    }
  };

  // 處理顯示/隱藏答案
  // 處理用戶回答
  const handleAnswer = async (wasRemembered) => {
    const today = getTodayString();
    const word = wordsToReview[currentIndex];
    let newLevel;
    let nextReviewDate;

    // 計算新的等級和下次複習日期
    if (wasRemembered) {
      newLevel = Math.min((word.level || 1) + 1, SPACING_INTERVALS.length);
      const daysToAdd = SPACING_INTERVALS[newLevel - 2];
      nextReviewDate = addDays(today, daysToAdd);
    } else {
      newLevel = word.level;
      nextReviewDate = today; // 忘記的話，下次複習日期設為今天
    }

    // 更新單字的等級和下次複習日期
    const updatedWord = {
      ...word,
      level: newLevel,
      lastReviewed: today,
      nextReview: nextReviewDate
    };

    // 更新本地狀態
    const temp_updatedWords = [...updatedWords];
    temp_updatedWords[currentIndex] = updatedWord;
    setUpdatedWords(temp_updatedWords);
    setShowAnswer(false);

    // 準備當前單字的結果
    const currentResult = {
      wordId: word.id,
      word: word.word,
      reading: word.reading,
      meaning: word.meaning,
      remembered: wasRemembered,
      level: newLevel,
      nextReview: nextReviewDate
    };

    // 更新會話結果
    const updatedResults = [...sessionResults, currentResult];
    setSessionResults(updatedResults);

    // 移動到下一個單字或結束會話
    if (currentIndex < wordsToReview.length - 1) {
      // 還有單字，移動到下一個
      setCurrentIndex(currentIndex + 1);
    } else {
      try {
        // 所有單字都複習完畢，批次更新所有單字
        await updateAllWords(updatedWords);
        
        // 更新 N4/N5_record 中的下次複習日期
        await updateRecord(updatedWords);
        
        // 導向總結頁面，傳遞所有結果和類別信息
        navigate('/summary', { 
          state: { 
            results: updatedResults,
            category: category ? category.charAt(0).toUpperCase() + category.slice(1) : level
          },
          replace: true
        });
      } catch (error) {
        console.error('更新記錄時出錯:', error);
        // 即使出錯也導向總結頁面
        navigate('/summary', { 
          state: { 
            results: updatedResults || [],
            category: category ? category.charAt(0).toUpperCase() + category.slice(1) : level
          },
          replace: true
        });
      }
    }
  };

  if (isLoading) return <div className={styles.loading}>載入中...</div>;
  if (wordsToReview.length === 0) return <div className={styles.noWords}>沒有需要複習的單字！</div>;

  // 獲取當前單字
  const currentWord = wordsToReview[currentIndex];

  return (
    <Layout>
      <div className={styles.reviewPage}>
        <div className={styles.progress}>
          進度: {currentIndex + 1} / {wordsToReview.length}
          {currentWord.level && <span> | 等級: {currentWord.level}</span>}
        </div>
        
        <div 
          className={styles.flashcard}
          onClick={() => setShowAnswer(!showAnswer)}
        >
          <div className={styles.cardContent}>
            <h2 className={styles.word}>{currentWord.word}</h2>
            <p className={styles.reading}>
              {showAnswer ? currentWord.reading : '點擊顯示讀音'}
            </p>
            
            {showAnswer && (
              <>
                <h3 className={styles.meaning}>{currentWord.meaning}</h3>
                {currentWord.example && (
                  <div className={styles.example}>
                    <p className={styles.exampleSentence}>{currentWord.example.sentence}</p>
                    <p className={styles.exampleMeaning}>{currentWord.example.meaning}</p>
                  </div>
                )}
                {currentWord.hint && (
                  <div className={styles.hint}>
                    <p>提示: {currentWord.hint}</p>
                  </div>
                )}
              </>
            )}
          </div>
        </div>

        {showAnswer && (
          <div className={styles.buttons}>
            <button 
              className={`${styles.button} ${styles.wrong}`}
              onClick={(e) => {
                e.stopPropagation();
                handleAnswer(false);
              }}
            >
              忘記了
            </button>
            <button 
              className={`${styles.button} ${styles.correct}`}
              onClick={(e) => {
                e.stopPropagation();
                handleAnswer(true);
              }}
            >
              記得
            </button>
          </div>
        )}

        <div className={styles.navigation}>
          <button 
            className={`${styles.navButton} ${currentIndex === 0 ? styles.disabled : ''}`}
            onClick={handlePrevious}
            disabled={currentIndex === 0}
          >
            上一個
          </button>
          <button 
            className={styles.navButton}
            onClick={() => navigate(`/${level.toLowerCase()}`)}
          >
            結束複習
          </button>
        </div>
      </div>
    </Layout>
  );
};

export default Review;
