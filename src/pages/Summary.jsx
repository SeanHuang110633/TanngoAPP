import { useLocation, useNavigate } from 'react-router-dom';
import Layout from '../components/Shared/Layout';
import styles from './styles/SummaryPage.module.scss';

const Summary = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const { results = [], category = 'N5' } = location.state || {};

  // 計算統計數據
  const totalWords = results.length;
  const rememberedWords = results.filter(word => word.remembered).length;
  const forgottenWords = totalWords - rememberedWords;
  const successRate = totalWords > 0 ? Math.round((rememberedWords / totalWords) * 100) : 0;

  // 獲取對應的目錄路徑
  const getCategoryPath = () => {
    switch (category) {
      case 'N5':
        return '/n5';
      case 'N4':
        return '/n4';
      // 可以根據需要添加更多級別
      default:
        return '/n5'; // 預設返回 N5 目錄
    }
  };

  // 處理返回目錄的點擊事件
  const handleBackToCategory = () => {
    navigate(getCategoryPath());
  };

  return (
    <Layout>
      <div className={styles.summaryContainer}>
        <h1>複習完成！</h1>
        
        <div className={styles.statsContainer}>
          <div className={styles.statItem}>
            <div className={styles.statNumber}>{totalWords}</div>
            <div className={styles.statLabel}>總複習單字</div>
          </div>
          <div className={styles.statItem}>
            <div className={`${styles.statNumber} ${styles.remembered}`}>
              {rememberedWords}
            </div>
            <div className={styles.statLabel}>記住</div>
          </div>
          <div className={styles.statItem}>
            <div className={`${styles.statNumber} ${forgottenWords > 0 ? styles.forgotten : ''}`}>
              {forgottenWords}
            </div>
            <div className={styles.statLabel}>忘記</div>
          </div>
          <div className={styles.statItem}>
            <div className={styles.statNumber}>
              {successRate}%
            </div>
            <div className={styles.statLabel}>正確率</div>
          </div>
        </div>

        <div className={styles.wordsList}>
          <h2>單字列表</h2>
          <div className={styles.wordsGrid}>
            {results.map((word, index) => (
              <div 
                key={`${word.wordId || index}`} 
                className={`${styles.wordItem} ${!word.remembered ? styles.forgottenWord : ''}`}
              >
                <div className={styles.wordContent}>
                  <div className={styles.wordText}>
                    <span className={styles.japanese}>{word.word}</span>
                    <span className={styles.reading}>{word.reading || ''}</span>
                  </div>
                  <div className={styles.meaning}>{word.meaning}</div>
                </div>
                <div className={styles.statusIndicator}>
                  {word.remembered ? '✓' : '✕'}
                </div>
              </div>
            ))}
          </div>
        </div>

        <button 
          className={styles.backButton}
          onClick={handleBackToCategory}
        >
          返回{category}目錄
        </button>
      </div>
    </Layout>
  );
};

export default Summary;
