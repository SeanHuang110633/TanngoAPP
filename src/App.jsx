import React from 'react';
import { Routes, Route, Navigate, useLocation } from 'react-router-dom';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import Home from './pages/Home';
import Review from './pages/Review';
import Summary from './pages/Summary';
import LoginPage from './pages/LoginPage';
import LevelPage from './pages/LevelPage';
import Navbar from './components/Shared/Navbar';
import './App.css';

// 受保護的路由組件
const ProtectedRoute = ({ children }) => {
  const { currentUser } = useAuth();
  const location = useLocation();

  if (!currentUser) {
    console.log('no user found, redirecting to login...');
    // 保存用戶嘗試訪問的頁面，登入後重定向回去
    return <Navigate to="/login" state={{ from: location }} replace />;
  }

  return children;
};

const AppRoutes = () => {
  return (
    <Routes>
      <Route path="/login" element={<LoginPage />} />
      <Route
        path="/"
        element={
          <ProtectedRoute>
            <Home />
          </ProtectedRoute>
        }
      />
      <Route
        path="/:level"
        element={
          <ProtectedRoute>
            <LevelPage />
          </ProtectedRoute>
        }
      />
      <Route
        path="/:level/review/:category"
        element={
          <ProtectedRoute>
            <Review />
          </ProtectedRoute>
        }
      />
      <Route
        path="/summary"
        element={
          <ProtectedRoute>
            <Summary />
          </ProtectedRoute>
        }
      />
      {/* 處理不存在的路徑 */}
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
};

const App = () => {
  return (
    <AuthProvider>
      <div className="app">
        <Navbar />
        <div className="content">
          <AppRoutes />
        </div>
      </div>
    </AuthProvider>
  );
};

export default App;