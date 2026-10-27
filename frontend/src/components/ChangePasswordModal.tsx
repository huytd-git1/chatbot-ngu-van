import React, { useState } from 'react';
import { X, KeyRound, AlertCircle } from 'lucide-react';
import { apiRequest } from '../api/client.js';

interface ChangePasswordModalProps {
  isOpen: boolean;
  isForced: boolean;
  onClose: () => void;
  onSuccess: (updatedUser?: any) => void;
}

export const ChangePasswordModal: React.FC<ChangePasswordModalProps> = ({
  isOpen,
  isForced,
  onClose,
  onSuccess,
}) => {
  const [oldPassword, setOldPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (newPassword.length < 6) {
      setError('Mật khẩu mới phải có ít nhất 6 ký tự.');
      return;
    }

    if (newPassword !== confirmPassword) {
      setError('Mật khẩu xác nhận không khớp.');
      return;
    }

    setLoading(true);
    try {
      const res = await apiRequest<{ message: string; user?: any }>('/api/auth/change-password', {
        method: 'POST',
        body: JSON.stringify({ oldPassword, newPassword }),
      });
      alert('Đổi mật khẩu thành công!');
      onSuccess(res.user);
      onClose();
    } catch (err: any) {
      setError(err.message || 'Không thể đổi mật khẩu.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-xs p-4">
      <div className="bg-white rounded-3xl p-6 sm:p-8 max-w-md w-full shadow-xl border border-[#e8e2d5] relative">
        {!isForced && (
          <button
            onClick={onClose}
            className="absolute top-5 right-5 text-slate-400 hover:text-slate-600 p-1 rounded-lg"
          >
            <X className="w-5 h-5" />
          </button>
        )}

        <div className="text-center mb-6">
          <div className="w-12 h-12 rounded-2xl bg-amber-100 flex items-center justify-center text-amber-900 mx-auto mb-3 shadow-inner">
            <KeyRound className="w-6 h-6 text-amber-800" />
          </div>
          <h2 className="text-xl font-bold text-[#0f2942]">
            {isForced ? 'Đổi mật khẩu lần đầu đăng nhập' : 'Đổi mật khẩu'}
          </h2>
          <p className="text-xs text-slate-500 mt-1">
            {isForced
              ? 'Để bảo mật tài khoản, vui lòng thiết lập mật khẩu mới của riêng em trước khi tiếp tục.'
              : 'Nhập mật khẩu hiện tại và thiết lập mật khẩu mới.'}
          </p>
        </div>

        {error && (
          <div className="mb-4 p-3 rounded-xl bg-red-50 border border-red-200 text-xs text-red-700 flex items-center gap-2">
            <AlertCircle className="w-4 h-4 shrink-0" />
            <span>{error}</span>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-3.5">
          <div>
            <label className="text-xs font-semibold text-slate-600 block mb-1">Mật khẩu hiện tại:</label>
            <input
              type="password"
              placeholder="Nhập mật khẩu hiện tại"
              value={oldPassword}
              onChange={(e) => setOldPassword(e.target.value)}
              className="w-full text-sm px-3 py-2.5 rounded-xl border border-[#e8e2d5] bg-[#fbf9f4]"
              required
            />
          </div>

          <div>
            <label className="text-xs font-semibold text-slate-600 block mb-1">Mật khẩu mới (tối thiểu 6 ký tự):</label>
            <input
              type="password"
              placeholder="Nhập mật khẩu mới"
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              className="w-full text-sm px-3 py-2.5 rounded-xl border border-[#e8e2d5] bg-[#fbf9f4]"
              required
            />
          </div>

          <div>
            <label className="text-xs font-semibold text-slate-600 block mb-1">Xác nhận mật khẩu mới:</label>
            <input
              type="password"
              placeholder="Nhập lại mật khẩu mới"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              className="w-full text-sm px-3 py-2.5 rounded-xl border border-[#e8e2d5] bg-[#fbf9f4]"
              required
            />
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full py-3 rounded-xl bg-[#0f2942] text-white text-sm font-semibold hover:bg-[#1e3a5f] disabled:opacity-50 transition-all shadow-xs mt-2"
          >
            {loading ? 'Đang cập nhật...' : 'Cập nhật mật khẩu'}
          </button>
        </form>
      </div>
    </div>
  );
};
