import React from 'react';
import { BookOpen, User as UserIcon, LogOut, KeyRound, Sparkles } from 'lucide-react';
import type { User, QuotaInfo } from '../types.js';

interface NavbarProps {
  user: User | null;
  quota: QuotaInfo | null;
  currentView: 'student' | 'teacher' | 'admin';
  onViewChange: (view: 'student' | 'teacher' | 'admin') => void;
  onOpenChangePassword: () => void;
  onLogout: () => void;
  onOpenLogin: () => void;
}

export const Navbar: React.FC<NavbarProps> = ({
  user,
  quota,
  currentView,
  onViewChange,
  onOpenChangePassword,
  onLogout,
  onOpenLogin,
}) => {
  return (
    <header className="bg-white/90 backdrop-blur-md border-b border-[#e8e2d5] sticky top-0 z-30 shadow-xs">
      <div className="max-w-7xl mx-auto px-2 sm:px-4 lg:px-8 h-14 sm:h-16 flex items-center justify-between gap-2">
        {/* Brand */}
        <div className="flex items-center space-x-2 sm:space-x-3 cursor-pointer min-w-0 shrink" onClick={() => onViewChange('student')}>
          <div className="w-8 h-8 sm:w-10 sm:h-10 rounded-xl overflow-hidden border border-amber-300 shadow-xs shrink-0 ring-2 ring-amber-100">
            <img src="/co-duong-avatar.png" alt="Cô Dương" className="w-full h-full object-cover" />
          </div>
          <div className="min-w-0">
            <h1 className="text-sm sm:text-base lg:text-lg font-bold text-[#0f2942] tracking-tight flex items-center gap-1.5 whitespace-nowrap truncate">
              <span className="hidden sm:inline">Cô Dương dạy văn dễ thương</span>
              <span className="sm:hidden">Cô Dương AI</span>
              <span className="text-[9px] sm:text-[10px] px-1.5 sm:px-2 py-0.5 rounded-full font-medium bg-amber-100 text-amber-800 border border-amber-200 shrink-0">
                AI RAG
              </span>
            </h1>
            <p className="text-[11px] text-slate-500 hidden md:block truncate">Trợ lý học tập Ngữ văn có căn cứ tài liệu chính thức</p>
          </div>
        </div>

        {/* Center / Right controls */}
        <div className="flex items-center space-x-1.5 sm:space-x-3 shrink-0">
          {user ? (
            <>
              {/* Quota Indicator for Student / Test Teacher */}
              {quota && (
                <>
                  {/* Desktop Quota Indicator */}
                  <div className="hidden lg:flex items-center px-3 py-1 rounded-full text-xs font-medium border bg-amber-50/80 border-amber-200 text-amber-900 shadow-2xs">
                    {quota.isUnlimited ? (
                      <span className="flex items-center gap-1 text-emerald-800 font-semibold">
                        <Sparkles className="w-3.5 h-3.5 text-emerald-600" />
                        Lượt hỏi: Không giới hạn {user.role === 'admin' ? '(Quản trị viên)' : '(Giáo viên Test)'}
                      </span>
                    ) : (
                      <span className="flex items-center gap-1">
                        <span className="w-2 h-2 rounded-full bg-amber-500 animate-pulse" />
                        Lượt hôm nay: <strong className="font-bold text-[#0f2942]">{quota.remaining}</strong>/{quota.limit} còn lại
                        {quota.extraGranted > 0 && (
                          <span className="text-[10px] ml-1 px-1.5 py-0.2 rounded bg-amber-200 text-amber-900">
                            +{quota.extraGranted} cấp thêm
                          </span>
                        )}
                      </span>
                    )}
                  </div>

                  {/* Mobile Compact Quota Badge */}
                  <div className="lg:hidden flex items-center px-2 py-0.5 sm:py-1 rounded-lg text-[10px] sm:text-[11px] font-bold bg-amber-50 border border-amber-200/80 text-amber-900 shrink-0">
                    {quota.isUnlimited ? (
                      <span className="flex items-center gap-1 text-emerald-700">
                        <Sparkles className="w-3 h-3 text-emerald-600" />
                        <span>Vô hạn {user.role === 'admin' ? '(Admin)' : ''}</span>
                      </span>
                    ) : (
                      <span className="flex items-center gap-1">
                        <span className="w-1.5 h-1.5 rounded-full bg-amber-500" />
                        <span>{quota.remaining}/{quota.limit}</span>
                      </span>
                    )}
                  </div>
                </>
              )}

              {/* View Switcher based on role */}
              <div className="flex items-center bg-[#f4efe6] p-0.5 sm:p-1 rounded-lg text-xs font-medium shrink-0">
                <button
                  onClick={() => onViewChange('student')}
                  className={`px-2 sm:px-2.5 py-1 rounded-md transition-all text-[11px] sm:text-xs ${
                    currentView === 'student' ? 'bg-white text-[#0f2942] shadow-2xs font-semibold' : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  <span className="hidden sm:inline">Góc học sinh</span>
                  <span className="sm:hidden">Học sinh</span>
                </button>

                {(user.role === 'teacher' || user.role === 'admin') && (
                  <button
                    onClick={() => onViewChange('teacher')}
                    className={`px-2 sm:px-2.5 py-1 rounded-md transition-all text-[11px] sm:text-xs ${
                      currentView === 'teacher' ? 'bg-white text-[#0f2942] shadow-2xs font-semibold' : 'text-slate-600 hover:text-slate-900'
                    }`}
                  >
                    <span className="hidden sm:inline">Bàn giáo viên</span>
                    <span className="sm:hidden">Giáo viên</span>
                  </button>
                )}

                {user.role === 'admin' && (
                  <button
                    onClick={() => onViewChange('admin')}
                    className={`px-2 sm:px-2.5 py-1 rounded-md transition-all text-[11px] sm:text-xs ${
                      currentView === 'admin' ? 'bg-white text-[#0f2942] shadow-2xs font-semibold' : 'text-slate-600 hover:text-slate-900'
                    }`}
                  >
                    Quản trị
                  </button>
                )}
              </div>

              {/* User Dropdown / Controls */}
              <div className="flex items-center space-x-1 sm:space-x-2">
                <div className="hidden lg:flex flex-col text-right">
                  <span className="text-xs font-semibold text-[#0f2942]">{user.fullName}</span>
                  <span className="text-[10px] text-slate-500 capitalize">
                    {user.role === 'student' ? 'Học sinh' : user.role === 'teacher' ? (user.isTestTeacher ? 'Giáo viên Test' : 'Giáo viên') : 'Quản trị viên'}
                  </span>
                </div>

                <button
                  onClick={onOpenChangePassword}
                  title="Đổi mật khẩu"
                  className="p-1.5 text-slate-600 hover:text-[#0f2942] hover:bg-slate-100 rounded-lg transition-colors"
                >
                  <KeyRound className="w-4 h-4" />
                </button>

                <button
                  onClick={onLogout}
                  title="Đăng xuất"
                  className="p-1.5 text-red-600 hover:text-red-700 hover:bg-red-50 rounded-lg transition-colors"
                >
                  <LogOut className="w-4 h-4" />
                </button>
              </div>
            </>
          ) : (
            <button
              onClick={onOpenLogin}
              className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl text-sm font-semibold bg-[#0f2942] text-white hover:bg-[#1e3a5f] shadow-xs transition-colors"
            >
              <UserIcon className="w-4 h-4" />
              Đăng nhập
            </button>
          )}
        </div>
      </div>
    </header>
  );
};
