import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { doc, getDoc, updateDoc } from 'firebase/firestore';
import { db, updateN5Record } from '../firebase';
import Layout from '../components/Shared/Layout';
import { addDays, getTodayString } from '../utils/helpers';
import { SPACING_INTERVALS } from '../utils/constants';
import styles from './styles/ReviewPage.module.scss';

const N5Review = () => {
  const currentUser = JSON.parse(localStorage.getItem('currentUser')).name;
  const { category } = useParams();
  const [words, setWords] = useState([]); // 拿到整個目前複習的進度
  const [wordsToReview, setWordsToReview] = useState([]); // 拿到這次需要複習的單字
  const [updatedWords, setUpdatedWords] = useState([]); // 紀錄需要更新的單字
  const [currentIndex, setCurrentIndex] = useState(0);
  const [showAnswer, setShowAnswer] = useState(false);
  const [sessionResults, setSessionResults] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [minDate, setMinDate] = useState('');
  const navigate = useNavigate();

  // 從 Firebase 加載N5單字數據(是單字原始資料，非個人複習進度)
  useEffect(() => {
    console.log('N5Review useEffect' + currentUser);
    const fetchWords = async () => {
      if (!currentUser) return;
      
      try {
        setIsLoading(true);
        const today = getTodayString();
        
        // 1. 從 Sean/N5_{category} 獲取單字列表
        const docId = `N5_${category}`;
        const docRef = doc(db, currentUser, docId);
        const docSnap = await getDoc(docRef);
        
        if (!docSnap.exists()) {
          console.error('未找到單字數據');
          return;
        }

        const fetchedWords = docSnap.data().words;
        
        // 先設置 words，然後使用 fetchedWords 進行後續操作
        setWords(fetchedWords);
        
        // 找到目前第二小的日期(後續更新N5_record複習表使用的)
        if (fetchedWords.length >= 2) {
          // 1. 過濾出有 nextReview 的單字
          const wordsWithReview = fetchedWords.filter(word => word.nextReview);
          
          if (wordsWithReview.length >= 2) {
            // 2. 將日期轉換為 YYYY-MM-DD 格式並去重
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
        setUpdatedWords(wordsReview);
      } catch (error) {
        console.error('加載單字時出錯:', error);
      } finally {
        setIsLoading(false);
      }
    };
    
    fetchWords();
  }, [category, currentUser]); // 當類別或使用者改變時重新載入


  // 處理返回上一個單字
  const handlePrevious = () => {
    if (currentIndex > 0) {
      setCurrentIndex(prev => prev - 1);
      // 移除上一個結果
      setSessionResults(prev => prev.slice(0, -1));
    }
  };

  // 資料庫更新
  // 更新單字
  const updateAllWords = async (wordsToUpdate) => {
    if (!currentUser) return;
    
    try {
      const docId = `N5_${category}`;
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


  // 更新下次複習日期 (N5_record)
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

      // 更新 N5_record
      await updateN5Record(currentUser, category, finalDate)
      
    } catch (error) {
      console.error('更新 N5_record 時出錯:', error);
    }
  };


  // 處理用戶回答
  const handleAnswer = async (wasRemembered) => {
    const today = getTodayString();
    const word = wordsToReview[currentIndex];
    console.log("來看看有沒有每次都被更新 word: ", wordsToReview);
    console.log("比較一下 updatedWords: ", updatedWords);
    let newLevel;
    let nextReviewDate;

    // 計算新的等級和下次複習日期
    if (wasRemembered) {
      newLevel = Math.min((word.level || 1) + 1, SPACING_INTERVALS.length);
      const daysToAdd = SPACING_INTERVALS[newLevel - 2];
      nextReviewDate = addDays(today, daysToAdd);
      console.log("newLevel: ", newLevel);
      console.log("newReviewDate: ", nextReviewDate);
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

    
    const temp_updatedWords = [...updatedWords];
    temp_updatedWords[currentIndex] = updatedWord;
    // 只更新 updatedWords 狀態 (維持 wordsToReview 再更新之前都與資料庫同步)
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
    if (currentIndex < wordsToReview.length-1) {
      // 還有單字，移動到下一個
      console.log('移動到下一個單字，當前索引:', currentIndex, '總單字數:', wordsToReview.length);
      setCurrentIndex(currentIndex + 1);
    } else {
      try {
        console.log('所有單字複習完成，準備更新記錄...');
        // 所有單字都複習完畢，批次更新所有單字
        await updateAllWords(updatedWords);
        
        // 更新 N5_record 中的下次複習日期
        await updateRecord(updatedWords);
        
        // 導向總結頁面，傳遞所有結果和類別信息
        console.log('準備導向總結頁面，結果:', updatedResults);
        
        navigate('/summary', { 
          state: { 
            results: updatedResults,
            category: category ? category.charAt(0).toUpperCase() + category.slice(1) : 'N5'
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
            category: category ? category.charAt(0).toUpperCase() + category.slice(1) : 'N5'
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

export default N5Review;
