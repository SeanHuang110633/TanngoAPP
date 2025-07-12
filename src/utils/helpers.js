import { 
  WORD_CATEGORIES, 
  CATEGORY_FILE_MAP, 
  DEFAULT_DAILY_GOAL,
  SPACING_INTERVALS 
} from './constants';
import { 
  getUserData, 
  saveWord as firebaseSaveWord, 
  updateWord as firebaseUpdateWord, 
  getUserWords as firebaseGetUserWords,
  deleteWord as firebaseDeleteWord,
  COLLECTIONS
} from '../firebase';

// 將日期轉換為 YYYY-MM-DD 格式
export const getTodayString = () => new Date().toISOString().split('T')[0];

// 在指定日期上加上天數
export const addDays = (date, days) => {
    const result = new Date(date);
    result.setDate(result.getDate() + days);
    return result.toISOString().split('T')[0];
};

// 從 Firebase 載入用戶的單字資料
export const loadWordsData = async (userId) => {
    try {
        if (!userId) {
            console.error('無法載入單字資料:缺少用戶ID');
            return [];
        }
        return await firebaseGetUserWords(userId);
    } catch (error) {
        console.error('從 Firebase 載入單字資料失敗:', error);
        return [];
    }
};

// 載入特定分類的單字
export const loadWordsByCategory = async (category) => {
    const fileName = CATEGORY_FILE_MAP[category];
    if (!fileName) {
        throw new Error(`找不到分類: ${category}`);
    }
    
    try {
        const response = await fetch(`/${fileName}`);
        if (!response.ok) {
            throw new Error(`無法載入 ${fileName}`);
        }
        const data = await response.json();
        const today = getTodayString();
        
        // 確保每個單字都有必要的欄位
        return (data.words || []).map(word => ({
            ...word,
            // 確保 example 是字串，如果是物件則轉換為日文例句
            example: typeof word.example === 'string' 
                ? word.example 
                : (word.example?.jp || word.example?.zh || ''),
            // 確保有必要的欄位
            level: word.level || 1,
            nextReview: word.nextReview || today,
            reviewHistory: Array.isArray(word.reviewHistory) ? word.reviewHistory : [],
            category: category // 確保有分類資訊
        }));
    } catch (error) {
        console.error(`載入 ${category} 單字時發生錯誤:`, error);
        throw error;
    }
};

// 載入所有詞性的單字
export const loadAllWords = async () => {
    try {
        const allWords = [];
        for (const category of WORD_CATEGORIES) {
            const words = await loadWordsByCategory(category);
            allWords.push(...words);
        }
        return allWords;
    } catch (error) {
        console.error('載入所有單字時發生錯誤:', error);
        return [];
    }
};

// 保存單字資料到 Firebase
export const saveWordsData = async (words, userId) => {
    if (!userId) {
        console.error('無法儲存單字資料:缺少用戶ID');
        return;
    }

    if (!words || words.length === 0) {
        console.warn('嘗試儲存空的單字資料，已跳過');
        return;
    }

    try {
        // 先刪除用戶現有的單字
        const existingWords = await firebaseGetUserWords(userId);
        const deletePromises = existingWords.map(word => 
            firebaseDeleteWord(userId, word.id)
        );
        await Promise.all(deletePromises);

        // 儲存新的單字
        const savePromises = words.map(word => 
            firebaseSaveWord(userId, word)
        );
        await Promise.all(savePromises);
        
        console.log('成功儲存單字資料到 Firebase, 共', words.length, '筆');
    } catch (error) {
        console.error('儲存單字資料到 Firebase 失敗:', error);
    }
};

// 更新單字資料
export const updateWord = async (userId, wordId, updates) => {
    if (!userId) {
        console.error('無法更新單字:缺少用戶ID');
        return [];
    }

    try {
        await firebaseUpdateWord(userId, wordId, updates);
        return await loadWordsData(userId);
    } catch (error) {
        console.error('更新單字時發生錯誤:', error);
        return [];
    }
};

// 獲取或設置每日學習目標
export const getDailyGoal = async (userId) => {
    if (!userId) {
        console.warn('缺少用戶ID, 返回預設每日目標');
        return DEFAULT_DAILY_GOAL;
    }

    try {
        const userData = await getUserData(userId);
        return userData.dailyGoal || DEFAULT_DAILY_GOAL;
    } catch (error) {
        console.error('獲取每日目標時發生錯誤:', error);
        return DEFAULT_DAILY_GOAL;
    }
};

export const setDailyGoal = async (userId, goal) => {
    if (!userId) {
        console.error('無法設置每日目標:缺少用戶ID');
        return;
    }

    try {
        await firebaseUpdateWord(userId, userId, { dailyGoal: goal }, COLLECTIONS.USERS);
    } catch (error) {
        console.error('設置每日目標時發生錯誤:', error);
    }
};

// 初始化單字學習進度
export const initializeWordsProgress = async (userId, category, dailyGoal = DEFAULT_DAILY_GOAL) => {
    if (!userId) {
        return { 
            success: false, 
            message: '無法初始化單字:缺少用戶ID' 
        };
    }

    try {
        // 載入該分類的所有單字
        const words = await loadWordsByCategory(category);
        const userWords = await loadWordsData(userId);
        const today = getTodayString();
        
        // 過濾掉已經初始化的單字
        const existingWordIds = new Set(userWords.map(w => w.wordId));
        const wordsToInitialize = words.filter(word => !existingWordIds.has(word.id));
        
        if (wordsToInitialize.length === 0) {
            return { success: true, message: '所有單字已經初始化' };
        }
        
        // 計算每個等級應該分配多少單字
        const totalLevels = SPACING_INTERVALS.length;
        const wordsPerLevel = Math.ceil(dailyGoal / totalLevels);
        
        // 初始化單字進度
        const savePromises = [];
        
        for (let i = 0; i < wordsToInitialize.length; i++) {
            const word = wordsToInitialize[i];
            // 計算這個單字應該分配到哪個等級
            const level = Math.min(
                Math.floor(i / wordsPerLevel) + 1,
                totalLevels
            );
            
            // 計算下次複習日期
            const daysToAdd = SPACING_INTERVALS[level - 1] || 1;
            const nextReview = addDays(new Date(), daysToAdd).split('T')[0];
            
            const wordData = {
                ...word,
                level,
                nextReview,
                reviewHistory: [],
                category,
                lastReviewed: today
            };
            
            savePromises.push(firebaseSaveWord(userId, wordData));
        }
        
        await Promise.all(savePromises);
        
        return { 
            success: true, 
            message: `成功初始化 ${wordsToInitialize.length} 個單字的學習進度`,
            initializedCount: wordsToInitialize.length
        };
    } catch (error) {
        console.error('初始化單字進度時發生錯誤:', error);
        return { 
            success: false, 
            message: `初始化失敗: ${error.message}` 
        };
    }
};

// 檢查並初始化單字學習進度
export const checkAndInitializeWords = async (userId, category) => {
    if (!userId) {
        return { 
            success: false, 
            message: '無法檢查單字:缺少用戶ID',
            initializedCount: 0
        };
    }

    const userWords = await loadWordsData(userId);
    const categoryWords = userWords.filter(w => w.category === category);
    
    if (categoryWords.length === 0) {
        const dailyGoal = await getDailyGoal(userId);
        return initializeWordsProgress(userId, category, dailyGoal);
    }
    
    return { 
        success: true, 
        message: '單字已經初始化',
        initializedCount: 0
    };
};
