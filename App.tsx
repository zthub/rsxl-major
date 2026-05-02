import React from 'react';
import { HashRouter as Router, Routes, Route } from 'react-router-dom';
import { Layout } from './components/Layout';
import { HomePage } from './pages/HomePage';
import { ModuleDetail } from './pages/ModuleDetail';
import { GamePlayer } from './pages/GamePlayer';
import { AuthProvider } from './utils/authContext';
import { ProtectedRoute } from './utils/protectedRoute';
import { GameSessionTracker } from './utils/GameSessionTracker';
import { AuthPage } from './pages/AuthPage';
import { AdminPage } from './pages/AdminPage';
import { ProfilePage } from './pages/ProfilePage';

const App: React.FC = () => {
  return (
    <Router>
      <AuthProvider>
        <Layout>
          <Routes>
            <Route path="/" element={<HomePage />} />
            <Route path="/auth" element={<AuthPage />} />
            <Route path="/module/:moduleId" element={<ModuleDetail />} />
            <Route
              path="/module/:moduleId/game/:gameId"
              element={
                <ProtectedRoute>
                  <GameSessionTracker>
                    <GamePlayer />
                  </GameSessionTracker>
                </ProtectedRoute>
              }
            />
            {/* 兼容旧版路径 */}
            <Route
              path="/pages/fusion-training/game-player"
              element={
                <ProtectedRoute>
                  <GameSessionTracker>
                    <GamePlayer />
                  </GameSessionTracker>
                </ProtectedRoute>
              }
            />
            <Route
              path="/profile"
              element={
                <ProtectedRoute>
                  <ProfilePage />
                </ProtectedRoute>
              }
            />
            <Route
              path="/admin"
              element={
                <ProtectedRoute requireAdmin={true}>
                  <AdminPage />
                </ProtectedRoute>
              }
            />
          </Routes>
        </Layout>
      </AuthProvider>
    </Router>
  );
};

export default App;