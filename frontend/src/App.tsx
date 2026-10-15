import React, { useState, useEffect } from 'react';
import { Navbar } from './components/Navbar.js';
import { StudentChat } from './components/StudentChat.js';
import { TeacherDashboard } from './components/TeacherDashboard.js';
import { AdminDashboard } from './components/AdminDashboard.js';
import { LoginModal } from './components/LoginModal.js';
import { ChangePasswordModal } from './components/ChangePasswordModal.js';
import type { User, QuotaInfo, Work } from './types.js';
import { apiRequest } from './api/client.js';
import { Loader2 } from 'lucide-react';

export const App: React.FC = () => {
  const [user, setUser] = useState<User | null>(null);
  const [quota, setQuota] = useState<QuotaInfo | null>(null);
  const [works, setWorks] = useState<Work[]>([]);
  const [currentView, setCurrentView] = useState<'student' | 'teacher' | 'admin'>('student');
  const [isLoginOpen, setIsLoginOpen] = useState(false);
  const [isChangePasswordOpen, setIsChangePasswordOpen] = useState(false);
  const [isForcedPasswordChange, setIsForcedPasswordChange] = useState(false);
  const [loadingInitial, setLoadingInitial] = useState(true);

  const fetchSession = async () => {
    try {
      const res = await apiRequest<{ user: User }>('/api/auth/me');
      if (res.user) {
        setUser(res.user);
        if (res.user.mustChangePassword) {
          setIsForcedPasswordChange(true);
          setIsChangePasswordOpen(true);
        }
        await loadUserData(res.user);
      } else {
        setUser(null);
      }
    } catch {
      setUser(null);
    } finally {
      setLoadingInitial(false);
    }
  };

  const loadUserData = async (u: User) => {
    try {
      // Load Quota
      const qRes = await apiRequest<{ quota: QuotaInfo }>('/api/student/quota');
      if (qRes.quota) setQuota(qRes.quota);

      // Load Works
      const wRes = await apiRequest<{ works: Work[] }>('/api/student/works');
      if (wRes.works) setWorks(wRes.works);

      // Default view based on role
      if (u.role === 'admin') {
        setCurrentView('admin');
      } else if (u.role === 'teacher') {
        setCurrentView('teacher');
      } else {
        setCurrentView('student');
      }
    } catch (err) {
      console.error('Error loading user data:', err);
    }
  };

  const refreshQuota = async () => {
    try {
      const qRes = await apiRequest<{ quota: QuotaInfo }>('/api/student/quota');
      if (qRes.quota) setQuota(qRes.quota);
    } catch {}
  };

  useEffect(() => {
    fetchSession();
  }, []);

  const handleLogout = async () => {
    try {
      await apiRequest('/api/auth/logout', { method: 'POST' });
    } catch {}
    setUser(null);
    setQuota(null);
    setWorks([]);
    setCurrentView('student');
  };

  const handleLoginSuccess = async (loggedInUser: User) => {
    setUser(loggedInUser);
    setIsLoginOpen(false);
    if (loggedInUser.mustChangePassword) {
      setIsForcedPasswordChange(true);
      setIsChangePasswordOpen(true);
    }
    await loadUserData(loggedInUser);
  };

  const handlePasswordChangeSuccess = () => {
    setIsChangePasswordOpen(false);
    setIsForcedPasswordChange(false);
    if (user) {
      setUser({ ...user, mustChangePassword: false });
    }
  };

  if (loadingInitial) {
    return (
      <div className="min-h-screen bg-[#fbf9f4] flex flex-col items-center justify-center space-y-3">
        <Loader2 className="w-10 h-10 text-[#0f2942] animate-spin" />
        <p className="text-sm text-slate-600 font-medium">Đang tải ứng dụng Cô Dương dạy văn...</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex flex-col bg-[#fbf9f4] text-[#1c2530]">
      <Navbar
        user={user}
        quota={quota}
        currentView={currentView}
        onViewChange={(v) => setCurrentView(v)}
        onOpenChangePassword={() => {
          setIsForcedPasswordChange(false);
          setIsChangePasswordOpen(true);
        }}
        onLogout={handleLogout}
        onOpenLogin={() => setIsLoginOpen(true)}
      />

      <main className="flex-1">
        {currentView === 'student' && (
          <StudentChat
            works={works}
            quota={quota}
            onRefreshQuota={refreshQuota}
          />
        )}

        {currentView === 'teacher' && user && (user.role === 'teacher' || user.role === 'admin') && (
          <TeacherDashboard />
        )}

        {currentView === 'admin' && user && user.role === 'admin' && (
          <AdminDashboard />
        )}

        {/* Fallback if user tries to switch to teacher/admin without login */}
        {((currentView === 'teacher' || currentView === 'admin') && !user) && (
          <div className="max-w-md mx-auto my-20 p-8 bg-white rounded-2xl border border-amber-200 text-center shadow-sm">
            <h3 className="text-lg font-bold text-[#0f2942] mb-2">Yêu cầu đăng nhập</h3>
            <p className="text-sm text-slate-600 mb-6">
              Bạn cần đăng nhập với tài khoản Giáo viên hoặc Quản trị viên để truy cập tính năng này.
            </p>
            <button
              onClick={() => setIsLoginOpen(true)}
              className="px-6 py-2.5 bg-[#0f2942] hover:bg-[#1e3a5f] text-white rounded-xl font-medium shadow-xs"
            >
              Đăng nhập ngay
            </button>
          </div>
        )}
      </main>

      <footer className="border-t border-[#e8e2d5] bg-white/60 py-4 text-center text-xs text-slate-500">
        Cô Dương dạy văn dễ thương &copy; 2026 &bull; Chatbot RAG Ngữ văn dựa trên tài liệu giáo viên cung cấp
      </footer>

      {/* Modals */}
      <LoginModal
        isOpen={isLoginOpen}
        onClose={() => setIsLoginOpen(false)}
        onSuccess={handleLoginSuccess}
      />

      <ChangePasswordModal
        isOpen={isChangePasswordOpen}
        isForced={isForcedPasswordChange}
        onClose={() => {
          if (!isForcedPasswordChange) setIsChangePasswordOpen(false);
        }}
        onSuccess={handlePasswordChangeSuccess}
      />
    </div>
  );
};

export default App;
