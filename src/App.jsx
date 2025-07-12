import React from 'react';
import { Routes, Route, Navigate, useLocation } from 'react-router-dom';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import Home from './pages/Home';
import N4Page from './pages/N4Page';
import N5Page from './pages/N5Page';
import N4Review from './pages/N4Review';
import N5Review from './pages/N5Review';
import Summary from './pages/Summary';
import LoginPage from './pages/LoginPage';
import Navbar from './components/Shared/Navbar';
import './App.css';

// 受保護的路由組件
const ProtectedRoute = ({ children }) => {
  const { currentUser } = useAuth();
  const location = useLocation();

  if (!currentUser) {
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
        path="/n4"
        element={
          <ProtectedRoute>
            <N4Page />
          </ProtectedRoute>
        }
      />
      <Route
        path="/n5"
        element={
          <ProtectedRoute>
            <N5Page />
          </ProtectedRoute>
        }
      />
      <Route
        path="/n4/review/:category"
        element={
          <ProtectedRoute>
            <N4Review />
          </ProtectedRoute>
        }
      />
      <Route
        path="/n5/review/:category"
        element={
          <ProtectedRoute>
            <N5Review />
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