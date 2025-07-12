import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { doc, getDoc, updateDoc } from 'firebase/firestore';
import { db, updateN4Record } from '../firebase';
import Layout from '../components/Shared/Layout';
import { addDays, getTodayString } from '../utils/helpers';
import { SPACING_INTERVALS } from '../utils/constants';
import styles from './styles/ReviewPage.module.scss';

const N4Review = () => {
  const currentUser = JSON.parse(localStorage.getItem('currentUser')).name;
  const { category } = useParams();
  const [words, setWords] = useState([]);
  const [wordsToReview, setWordsToReview] = useState([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [showAnswer, setShowAnswer] = useState(false);
  const [sessionResults, setSessionResults] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [minDate, setMinDate] = useState('');
  const navigate = useNavigate();

  // 從 Firebase 加載單字數據
  useEffect(() => {
    const fetchWords = async () => {
      if (!currentUser) return;
      
      try {
        setIsLoading(true);
        const today = getTodayString();
        
        // 1. 從 Sean/N4_{category} 獲取單字列表
        const docId = `N4_${category}`;
        const docRef = doc(db, currentUser, docId);
        const docSnap = await getDoc(docRef);
        
        if (!docSnap.exists()) {
          console.error('未找到單字數據');
          return;
        }

        const fetchedWords = docSnap.data().words;
        console.log("data: ", fetchedWords);
        
        // 先設置 words，然後使用 fetchedWords 進行後續操作
        setWords(fetchedWords);
        
        // 找到目前第二小的日期(後續更新N4_record複習表使用的)
        if (fetchedWords.length >= 2) {
          // 1. 過濾出有 nextReview 的單字
          const wordsWithReview = fetchedWords.filter(word => word.nextReview);
          
          if (wordsWithReview.length >= 2) {
            // 2. 將日期轉換為 YYYY-MM-DD 格式並去重
            const uniqueDates = [...new Set(
              wordsWithReview.map(word => word.nextReview.split('T')[0])
            )].sort();
            
            console.log('所有不重複的日期:', uniqueDates);
            
            if (uniqueDates.length >= 2) {
              // 3. 取得第二個不重複的日期
              const secondUniqueDate = uniqueDates[1];
              console.log('第二個不重複的日期:', secondUniqueDate);
              setMinDate(secondUniqueDate);
            } else {
              console.log('不重複的日期不足 2 個');
              setMinDate('');
            }
          } else {
            console.log("有 nextReview 的單字不足 2 個");
            setMinDate('');
          }
        } else {
          console.log("單字數量不足 2 個");
          setMinDate('');
        }

        // 2. 篩選出需要複習的單字(nextReview日期小於等於今天)
        const wordsReview = fetchedWords.filter(word => 
          !word.nextReview || new Date(word.nextReview) <= new Date(today)
        );
        
        setWordsToReview(wordsReview);
      } catch (error) {
        console.error('加載單字時出錯:', error);
      } finally {
        setIsLoading(false);
      }
    };
    
    fetchWords();
  }, [category, currentUser]);


  // 處理返回上一個單字
  const handlePrevious = () => {
    if (currentIndex > 0) {
      setCurrentIndex(prev => prev - 1);
      setIsFlipped(false);
      // 移除上一個結果
      setSessionResults(prev => prev.slice(0, -1));
    }
  };

  // 批次更新所有單字到資料庫
  const updateAllWords = async (wordsToUpdate) => {
    if (!currentUser) return;
    
    try {
      const docId = `N4_${category}`;
      const docRef = doc(db, currentUser, docId);
      const docSnap = await getDoc(docRef);
      
      if (docSnap.exists()) {
        // 用新的單字列表更新舊的單字列表，然後存到資料庫
        const tempWords = words.map(word => {
          const updatedWord = wordsToUpdate.find(w => w.id === word.id);
          return updatedWord ? {...word, ...updatedWord}:word;
        });

        await updateDoc(docRef, {
          words: tempWords,
          updatedAt: new Date().toISOString()
        });
        console.log('批次更新單字完成');
      }
    } catch (error) {
      console.error('批量更新單字時出錯:', error);
      throw error; // 重新拋出錯誤，讓上層處理
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
    const updatedWords = [...wordsToReview];
    updatedWords[currentIndex] = updatedWord;
    setWordsToReview(updatedWords);
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
    if (currentIndex < wordsToReview.length-1) {
      // 還有單字，移動到下一個
      console.log('移動到下一個單字，當前索引:', currentIndex, '總單字數:', wordsToReview.length);
      setCurrentIndex(currentIndex + 1);
    } else {
      try {
        console.log('所有單字複習完成，準備更新記錄...');
        // 所有單字都複習完畢，批次更新所有單字
        await updateAllWords(updatedWords);
        
        // 更新 N4_record 中的下次複習日期
        await updateRecord(updatedWords);
        
        // 導向總結頁面，傳遞所有結果和類別信息
        console.log('準備導向總結頁面，結果:', updatedResults);
        
        navigate('/summary', { 
          state: { 
            results: updatedResults,
            category: category ? category.charAt(0).toUpperCase() + category.slice(1) : 'N4'
          },
          replace: true
        });
      } catch (error) {
        console.error('更新記錄時出錯:', error);
        // 即使出錯也導向總結頁面
        console.log('出錯，但仍嘗試導向總結頁面');
        navigate('/summary', { 
          state: { 
            results: updatedResults || [],
            category: category ? category.charAt(0).toUpperCase() + category.slice(1) : 'N4'
          },
          replace: true
        });
      }
    }
  };

  // 更新 N4_record 中的下次複習日期
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

      console.log("這次複習中最小的日期:" + nextReviewDate);
      console.log("所有單字中第二小的日期:" + minDate);
        
      // 比較nextReviewDate與minDate
      const finalDate = nextReviewDate < minDate ? nextReviewDate : minDate;

      // 更新 N4_record
      await updateN4Record(currentUser, category, finalDate)
      
    } catch (error) {
      console.error('更新 N4_record 時出錯:', error);
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
                    <p className={styles.jp}>{currentWord.example.jp}</p>
                    <p className={styles.zh}>{currentWord.example.zh}</p>
                  </div>
                )}
              </>
            )}
          </div>
        </div>

        <div className={styles.buttons}>
          <div className={styles.navButtonContainer}>
            <button 
              className={styles.navButton}
              onClick={(e) => {
                e.stopPropagation();
                handlePrevious();
              }}
              disabled={currentIndex === 0}
            >
              ← 上一個
            </button>
          </div>
          
          <div className={styles.buttonGroup}>
            <button 
              className={styles.forgotButton}
              onClick={(e) => {
                e.stopPropagation();
                handleAnswer(false);
              }}
            >
              <span>✕</span> 忘惹
            </button>
            <button 
              className={styles.rememberButton}
              onClick={(e) => {
                e.stopPropagation();
                handleAnswer(true);
              }}
            >
              <span>✓</span> 記住惹
            </button>
          </div>
          
          <div className={styles.bottomButtons}>
            <button 
              className={styles.toggleButton}
              onClick={(e) => {
                e.stopPropagation();
                setShowAnswer(!showAnswer);
              }}
            >
              {showAnswer ? '隱藏答案' : '顯示答案'}
            </button>
          </div>
        </div>
      </div>
    </Layout>
  );
};

export default N4Review;
