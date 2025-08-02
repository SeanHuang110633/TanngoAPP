// 將日期轉換為 YYYY-MM-DD 格式
export const getTodayString = () => new Date().toISOString().split('T')[0];

// 在指定日期上加上天數
export const addDays = (date, days) => {
    const result = new Date(date);
    result.setDate(result.getDate() + days);
    return result.toISOString().split('T')[0];
};
