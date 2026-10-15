import React, { useState, useEffect } from 'react';
import { Power, Settings, AlertTriangle, History } from 'lucide-react';
import { apiRequest } from '../api/client.js';

export const AdminDashboard: React.FC = () => {
  const [activeTab, setActiveTab] = useState<'teachers' | 'system' | 'logs'>('teachers');

  // Teachers
  const [teachers, setTeachers] = useState<any[]>([]);
  const [newUsername, setNewUsername] = useState('');
  const [newPassword, setNewPassword] = useState('GiaoVien@2026!');
  const [newFullName, setNewFullName] = useState('');
  const [newIsTestTeacher, setNewIsTestTeacher] = useState(false);

  // System settings
  const [dailyLimit, setDailyLimit] = useState(20);
  const [systemHardCap, setSystemHardCap] = useState(5000);
  const [isKillSwitchActive, setIsKillSwitchActive] = useState(false);
  const [geminiConfigured, setGeminiConfigured] = useState(false);

  // Audit logs
  const [logs, setLogs] = useState<any[]>([]);

  useEffect(() => {
    loadTeachers();
    loadSettings();
    loadLogs();
  }, []);

  const loadTeachers = async () => {
    try {
      const data = await apiRequest('/api/admin/teachers');
      setTeachers(data.teachers || []);
    } catch {}
  };

  const loadSettings = async () => {
    try {
      const data = await apiRequest('/api/admin/settings');
      if (data.settings) {
        setDailyLimit(data.settings.daily_limit);
        setSystemHardCap(data.settings.system_hard_cap);
        setIsKillSwitchActive(data.settings.is_kill_switch_active);
      }
      setGeminiConfigured(!!data.geminiConfigured);
    } catch {}
  };

  const loadLogs = async () => {
    try {
      const data = await apiRequest('/api/admin/audit-logs');
      setLogs(data.logs || []);
    } catch {}
  };

  const handleCreateTeacher = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newUsername.trim() || !newPassword.trim() || !newFullName.trim()) return;

    try {
      await apiRequest('/api/admin/teachers', {
        method: 'POST',
        body: JSON.stringify({
          username: newUsername.trim(),
          password: newPassword.trim(),
          fullName: newFullName.trim(),
          isTestTeacher: newIsTestTeacher,
        }),
      });
      alert('Tạo giáo viên thành công.');
      setNewUsername('');
      setNewFullName('');
      loadTeachers();
    } catch (err: any) {
      alert(err.message);
    }
  };

  const handleToggleTestRole = async (teacherId: string, currentTest: boolean) => {
    try {
      const res = await apiRequest(`/api/admin/teachers/${teacherId}/test-role`, {
        method: 'PUT',
        body: JSON.stringify({ isTestTeacher: !currentTest }),
      });
      alert(res.message);
      loadTeachers();
    } catch (err: any) {
      alert(err.message);
    }
  };

  const handleSaveSettings = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const res = await apiRequest('/api/admin/settings', {
        method: 'PUT',
        body: JSON.stringify({
          dailyLimit: Number(dailyLimit),
          systemHardCap: Number(systemHardCap),
          isKillSwitchActive,
        }),
      });
      alert(res.message);
      loadSettings();
    } catch (err: any) {
      alert(err.message);
    }
  };

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      {/* Tabs */}
      <div className="flex gap-2 mb-6 border-b border-[#e8e2d5] pb-3">
        {[
          { id: 'teachers', label: 'Quản lý Giáo viên' },
          { id: 'system', label: 'Hạn mức & Công tắc khẩn cấp' },
          { id: 'logs', label: 'Nhật ký kiểm toán' },
        ].map((t) => (
          <button
            key={t.id}
            onClick={() => setActiveTab(t.id as any)}
            className={`px-4 py-2 rounded-xl text-sm font-semibold transition-all ${
              activeTab === t.id
                ? 'bg-[#0f2942] text-white shadow-xs'
                : 'bg-white hover:bg-amber-50/50 text-[#1c2530] border border-[#e8e2d5]'
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {/* TAB 1: TEACHERS */}
      {activeTab === 'teachers' && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Create teacher form */}
          <div className="bg-white p-5 rounded-2xl border border-[#e8e2d5] shadow-2xs space-y-4">
            <h3 className="text-base font-bold text-[#0f2942]">Tạo tài khoản giáo viên</h3>
            <form onSubmit={handleCreateTeacher} className="space-y-3">
              <div>
                <label className="text-xs font-semibold text-slate-600 block mb-1">Tên đăng nhập:</label>
                <input
                  type="text"
                  placeholder="e.g. coduong2"
                  value={newUsername}
                  onChange={(e) => setNewUsername(e.target.value)}
                  className="w-full text-xs p-2.5 rounded-xl border border-[#e8e2d5] bg-[#fbf9f4]"
                  required
                />
              </div>

              <div>
                <label className="text-xs font-semibold text-slate-600 block mb-1">Họ và tên:</label>
                <input
                  type="text"
                  placeholder="e.g. Nguyễn Thu Dương"
                  value={newFullName}
                  onChange={(e) => setNewFullName(e.target.value)}
                  className="w-full text-xs p-2.5 rounded-xl border border-[#e8e2d5] bg-[#fbf9f4]"
                  required
                />
              </div>

              <div>
                <label className="text-xs font-semibold text-slate-600 block mb-1">Mật khẩu ban đầu:</label>
                <input
                  type="text"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  className="w-full text-xs p-2.5 rounded-xl border border-[#e8e2d5] bg-[#fbf9f4]"
                  required
                />
              </div>

              <div className="flex items-center gap-2 pt-1">
                <input
                  type="checkbox"
                  id="test-teacher-cb"
                  checked={newIsTestTeacher}
                  onChange={(e) => setNewIsTestTeacher(e.target.checked)}
                  className="rounded text-[#0f2942]"
                />
                <label htmlFor="test-teacher-cb" className="text-xs text-slate-700 cursor-pointer">
                  Cấp quyền Giáo viên Test (Miễn hạn mức hỏi hằng ngày)
                </label>
              </div>

              <button
                type="submit"
                className="w-full py-2.5 rounded-xl bg-[#0f2942] text-white text-xs font-semibold hover:bg-[#1e3a5f]"
              >
                Tạo giáo viên
              </button>
            </form>
          </div>

          {/* Teacher list */}
          <div className="lg:col-span-2 bg-white p-5 rounded-2xl border border-[#e8e2d5] shadow-2xs space-y-4">
            <h3 className="text-base font-bold text-[#0f2942]">Danh sách giáo viên</h3>
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead>
                  <tr className="border-b border-[#e8e2d5] text-slate-400 font-semibold">
                    <th className="py-2">Tên đăng nhập</th>
                    <th className="py-2">Họ và tên</th>
                    <th className="py-2">Vai trò / Quyền</th>
                    <th className="py-2">Lớp phân công</th>
                    <th className="py-2 text-right">Thao tác</th>
                  </tr>
                </thead>
                <tbody>
                  {teachers.map((t) => (
                    <tr key={t.id} className="border-b border-slate-100 last:border-none">
                      <td className="py-2.5 font-bold text-[#0f2942]">{t.username}</td>
                      <td className="py-2.5">{t.full_name}</td>
                      <td className="py-2.5">
                        {t.is_test_teacher ? (
                          <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-emerald-100 text-emerald-800">
                            Giáo viên Test (Miễn hạn mức)
                          </span>
                        ) : (
                          <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-slate-100 text-slate-700">
                            Giáo viên tiêu chuẩn
                          </span>
                        )}
                      </td>
                      <td className="py-2.5 text-slate-500">
                        {t.assignedClasses?.map((c: any) => c.name).join(', ') || 'Chưa gán lớp'}
                      </td>
                      <td className="py-2.5 text-right">
                        <button
                          onClick={() => handleToggleTestRole(t.id, t.is_test_teacher)}
                          className={`text-[11px] px-2.5 py-1 rounded-lg border font-semibold ${
                            t.is_test_teacher
                              ? 'bg-amber-50 text-amber-900 border-amber-300'
                              : 'bg-white text-slate-700 border-slate-300'
                          }`}
                        >
                          {t.is_test_teacher ? 'Thu hồi Test' : 'Cấp quyền Test'}
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* TAB 2: SYSTEM & KILL SWITCH */}
      {activeTab === 'system' && (
        <div className="max-w-2xl bg-white p-6 rounded-2xl border border-[#e8e2d5] shadow-2xs space-y-6">
          <div>
            <h3 className="text-base font-bold text-[#0f2942] flex items-center gap-2">
              <Settings className="w-5 h-5 text-amber-700" />
              Cấu hình hạn mức & An toàn hệ thống
            </h3>
            <p className="text-xs text-slate-500 mt-1">
              Kiểm soát trần sử dụng API Gemini, hạn mức mặc định của học sinh và công tắc ngắt khẩn cấp.
            </p>
          </div>

          <form onSubmit={handleSaveSettings} className="space-y-4">
            <div>
              <label className="text-xs font-semibold text-slate-700 block mb-1">
                Hạn mức mặc định của học sinh (câu hỏi/ngày):
              </label>
              <input
                type="number"
                min={1}
                max={100}
                value={dailyLimit}
                onChange={(e) => setDailyLimit(Number(e.target.value))}
                className="w-full text-xs p-2.5 rounded-xl border border-[#e8e2d5] bg-[#fbf9f4]"
              />
            </div>

            <div>
              <label className="text-xs font-semibold text-slate-700 block mb-1">
                Trần toàn hệ thống trong ngày (Hard Cap bảo vệ chi phí API):
              </label>
              <input
                type="number"
                min={100}
                max={50000}
                value={systemHardCap}
                onChange={(e) => setSystemHardCap(Number(e.target.value))}
                className="w-full text-xs p-2.5 rounded-xl border border-[#e8e2d5] bg-[#fbf9f4]"
              />
            </div>

            {/* Kill switch card */}
            <div className={`p-4 rounded-xl border flex items-center justify-between ${
              isKillSwitchActive ? 'bg-red-50 border-red-300' : 'bg-slate-50 border-slate-200'
            }`}>
              <div>
                <div className="flex items-center gap-2">
                  <Power className={`w-4 h-4 ${isKillSwitchActive ? 'text-red-600' : 'text-slate-500'}`} />
                  <span className="text-xs font-bold text-slate-900">Công tắc dừng gọi AI khẩn cấp (Kill Switch)</span>
                </div>
                <p className="text-[11px] text-slate-500 mt-0.5">
                  Khi bật, mọi yêu cầu hỏi đáp RAG sẽ dừng lại ngay lập tức để bảo trì hoặc ngăn lạm dụng.
                </p>
              </div>

              <button
                type="button"
                onClick={() => setIsKillSwitchActive(!isKillSwitchActive)}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
                  isKillSwitchActive ? 'bg-red-600 text-white' : 'bg-slate-200 text-slate-700'
                }`}
              >
                {isKillSwitchActive ? 'ĐANG BẬT (AI TẮT)' : 'ĐANG TẮT (AI BÌNH THƯỜNG)'}
              </button>
            </div>

            <div className="p-3 rounded-xl bg-amber-50 border border-amber-200 text-xs text-amber-900 flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 shrink-0 text-amber-700" />
              <span>
                Trạng thái Gemini API Key: <strong>{geminiConfigured ? 'Đã cấu hình API Key thật' : 'Chế độ mô phỏng kiểm thử (Mock Mode)'}</strong>
              </span>
            </div>

            <button
              type="submit"
              className="px-5 py-2.5 rounded-xl bg-[#0f2942] text-white text-xs font-semibold hover:bg-[#1e3a5f]"
            >
              Lưu cấu hình hệ thống
            </button>
          </form>
        </div>
      )}

      {/* TAB 3: AUDIT LOGS */}
      {activeTab === 'logs' && (
        <div className="bg-white p-6 rounded-2xl border border-[#e8e2d5] shadow-2xs space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-base font-bold text-[#0f2942] flex items-center gap-2">
              <History className="w-5 h-5 text-slate-600" />
              Nhật ký kiểm toán hệ thống
            </h3>
            <button
              onClick={loadLogs}
              className="text-xs px-3 py-1.5 rounded-lg border border-[#e8e2d5] hover:bg-slate-50"
            >
              Làm mới
            </button>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead>
                <tr className="border-b border-[#e8e2d5] text-slate-400 font-semibold">
                  <th className="py-2">Thời gian</th>
                  <th className="py-2">Người thực hiện</th>
                  <th className="py-2">Hành động</th>
                  <th className="py-2">Mục tiêu</th>
                  <th className="py-2">IP</th>
                </tr>
              </thead>
              <tbody>
                {logs.map((l) => (
                  <tr key={l.id} className="border-b border-slate-100 last:border-none">
                    <td className="py-2.5 font-mono text-slate-500">{new Date(l.created_at).toLocaleString('vi-VN')}</td>
                    <td className="py-2.5 font-semibold text-[#0f2942]">{l.username || 'Hệ thống'}</td>
                    <td className="py-2.5 font-mono text-[11px] text-amber-900">{l.action}</td>
                    <td className="py-2.5 text-slate-600">{l.target_type} ({l.target_id || '-'})</td>
                    <td className="py-2.5 font-mono text-slate-400">{l.ip_address || '-'}</td>
                  </tr>
                ))}
                {logs.length === 0 && (
                  <tr>
                    <td colSpan={5} className="py-6 text-center text-slate-400">
                      Chưa có nhật ký kiểm toán nào được ghi nhận.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
};
