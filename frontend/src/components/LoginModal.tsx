import React, { useState } from 'react';
import { X, Lock, User as UserIcon, ShieldCheck, KeyRound } from 'lucide-react';
import { apiRequest } from '../api/client.js';
import type { User } from '../types.js';

interface LoginModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: (user: User) => void;
}

export const LoginModal: React.FC<LoginModalProps> = ({ isOpen, onClose, onSuccess }) => {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [totpCode, setTotpCode] = useState('');
  const [require2fa, setRequire2fa] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);

    try {
      const res = await apiRequest<{
        require2fa?: boolean;
        message?: string;
        user?: User;
      }>('/api/auth/login', {
        method: 'POST',
        body: JSON.stringify({
          username: username.trim(),
          password,
          totpCode: totpCode.trim() || undefined,
        }),
      });

      if (res.require2fa) {
        setRequire2fa(true);
        setError('Tài khoản đã bật 2FA. Vui lòng nhập mã từ Google Authenticator hoặc mã khôi phục.');
        return;
      }

      if (res.user) {
        onSuccess(res.user);
        onClose();
      }
    } catch (err: any) {
      setError(err.message || 'Đăng nhập không thành công.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-xs p-4">
      <div className="bg-white rounded-3xl p-6 sm:p-8 max-w-md w-full shadow-xl border border-[#e8e2d5] relative animate-in fade-in zoom-in-95">
        <button
          onClick={onClose}
          className="absolute top-5 right-5 text-slate-400 hover:text-slate-600 p-1 rounded-lg"
        >
          <X className="w-5 h-5" />
        </button>

        <div className="text-center mb-6">
          <div className="w-12 h-12 rounded-2xl bg-amber-100 flex items-center justify-center text-amber-900 mx-auto mb-3 shadow-inner">
            <Lock className="w-6 h-6 text-amber-800" />
          </div>
          <h2 className="text-xl font-bold text-[#0f2942]">Đăng nhập hệ thống</h2>
          <p className="text-xs text-slate-500 mt-1">Cô Dương dạy văn dễ thương</p>
        </div>

        {error && (
          <div className="mb-4 p-3 rounded-xl bg-red-50 border border-red-200 text-xs text-red-700">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="text-xs font-semibold text-slate-600 block mb-1">
              Tên đăng nhập hoặc Mã học sinh:
            </label>
            <div className="relative">
              <UserIcon className="w-4 h-4 text-slate-400 absolute left-3 top-3" />
              <input
                type="text"
                placeholder="Mã HS (e.g. HS2026001) hoặc username"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                className="w-full text-sm pl-9 pr-3 py-2.5 rounded-xl border border-[#e8e2d5] bg-[#fbf9f4] focus:outline-none focus:ring-2 focus:ring-[#0f2942]/20"
                required
                disabled={require2fa}
              />
            </div>
          </div>

          <div>
            <label className="text-xs font-semibold text-slate-600 block mb-1">Mật khẩu:</label>
            <div className="relative">
              <KeyRound className="w-4 h-4 text-slate-400 absolute left-3 top-3" />
              <input
                type="password"
                placeholder="Nhập mật khẩu"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full text-sm pl-9 pr-3 py-2.5 rounded-xl border border-[#e8e2d5] bg-[#fbf9f4] focus:outline-none focus:ring-2 focus:ring-[#0f2942]/20"
                required
                disabled={require2fa}
              />
            </div>
          </div>

          {require2fa && (
            <div className="pt-2 border-t border-slate-100">
              <label className="text-xs font-bold text-amber-900 block mb-1 flex items-center gap-1">
                <ShieldCheck className="w-4 h-4 text-emerald-600" />
                Mã xác thực 2 bước (TOTP 6 số hoặc mã khôi phục):
              </label>
              <input
                type="text"
                placeholder="e.g. 123456"
                value={totpCode}
                onChange={(e) => setTotpCode(e.target.value)}
                className="w-full text-sm font-mono px-3 py-2.5 rounded-xl border border-amber-300 bg-amber-50 focus:outline-none focus:ring-2 focus:ring-amber-500/20"
                autoFocus
                required
              />
            </div>
          )}

          <button
            type="submit"
            disabled={loading}
            className="w-full py-3 rounded-xl bg-[#0f2942] text-white text-sm font-semibold hover:bg-[#1e3a5f] disabled:opacity-50 transition-all shadow-xs"
          >
            {loading ? 'Đang xác thực...' : require2fa ? 'Xác nhận mã 2FA' : 'Đăng nhập'}
          </button>
        </form>

        <div className="mt-6 pt-4 border-t border-slate-100 text-center text-[11px] text-slate-400">
          Tài khoản kiểm thử mẫu: <strong>HS2026001</strong> / <strong>HocSinh@123</strong>
        </div>
      </div>
    </div>
  );
};
