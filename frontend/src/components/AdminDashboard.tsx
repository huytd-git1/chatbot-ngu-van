import React, { useState, useEffect } from 'react';
import {
  Power, Settings, History, Sparkles,
  CheckCircle2, AlertCircle, Eye, EyeOff, Loader2, Cpu
} from 'lucide-react';
import { apiRequest } from '../api/client.js';

export const AdminDashboard: React.FC = () => {
  const [activeTab, setActiveTab] = useState<'teachers' | 'ai' | 'system' | 'logs'>('teachers');

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

  // AI Configuration State
  const [apiKeyInput, setApiKeyInput] = useState('');
  const [showApiKey, setShowApiKey] = useState(false);
  const [maskedApiKey, setMaskedApiKey] = useState('');
  const [hasSavedKey, setHasSavedKey] = useState(false);
  const [selectedModel, setSelectedModel] = useState('gemini-3.8-flash');
  const [supportedModels, setSupportedModels] = useState<any[]>([]);
  const [isLiveAiConfigured, setIsLiveAiConfigured] = useState(false);
  const [savingAi, setSavingAi] = useState(false);
  const [saveAiMsg, setSaveAiMsg] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [testResult, setTestResult] = useState<{
    loading: boolean;
    success?: boolean;
    message?: string;
    responseTimeMs?: number;
  } | null>(null);

  // Audit logs
  const [logs, setLogs] = useState<any[]>([]);

  useEffect(() => {
    loadTeachers();
    loadSettings();
    loadAiSettings();
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
    } catch {}
  };

  const loadAiSettings = async () => {
    try {
      const data = await apiRequest('/api/admin/ai-settings');
      setIsLiveAiConfigured(!!data.isLiveConfigured);
      setMaskedApiKey(data.maskedApiKey || '');
      setHasSavedKey(!!data.hasApiKey);
      if (data.activeModel) setSelectedModel(data.activeModel);
      if (data.supportedModels) setSupportedModels(data.supportedModels);
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
          password: newPassword,
          fullName: newFullName.trim(),
          isTestTeacher: newIsTestTeacher,
        }),
      });
      alert('Tạo giáo viên thành công!');
      setNewUsername('');
      setNewFullName('');
      setNewPassword('GiaoVien@2026!');
      setNewIsTestTeacher(false);
      loadTeachers();
    } catch (err: any) {
      alert(err.message);
    }
  };

  const handleToggleTestRole = async (teacherId: string, currentStatus: boolean) => {
    try {
      const res = await apiRequest(`/api/admin/teachers/${teacherId}/test-role`, {
        method: 'PUT',
        body: JSON.stringify({ isTestTeacher: !currentStatus }),
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

  const handleSaveAiSettings = async (e: React.FormEvent) => {
    e.preventDefault();
    setSavingAi(true);
    setSaveAiMsg(null);
    try {
      const res = await apiRequest('/api/admin/ai-settings', {
        method: 'PUT',
        body: JSON.stringify({
          apiKey: apiKeyInput.trim() || undefined,
          modelName: selectedModel,
        }),
      });
      setSaveAiMsg({ type: 'success', text: res.message || 'Đã lưu cấu hình AI thành công.' });
      setApiKeyInput('');
      loadAiSettings();
      loadSettings();
    } catch (err: any) {
      setSaveAiMsg({ type: 'error', text: err.message || 'Lưu cấu hình AI thất bại.' });
    } finally {
      setSavingAi(false);
    }
  };

  const handleTestAiConnection = async () => {
    setTestResult({ loading: true });
    try {
      const res = await apiRequest('/api/admin/ai-settings/test', {
        method: 'POST',
        body: JSON.stringify({
          apiKey: apiKeyInput.trim() || undefined,
          modelName: selectedModel,
        }),
      });
      setTestResult({
        loading: false,
        success: true,
        message: res.message,
        responseTimeMs: res.responseTimeMs,
      });
    } catch (err: any) {
      setTestResult({
        loading: false,
        success: false,
        message: err.message || 'Không thể kết nối tới Google Gemini API.',
      });
    }
  };

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      {/* Tabs */}
      <div className="flex flex-wrap gap-2 mb-6 border-b border-[#e8e2d5] pb-3">
        {[
          { id: 'teachers', label: 'Quản lý Giáo viên' },
          { id: 'ai', label: 'Quản lý AI & Gemini Model', icon: Sparkles },
          { id: 'system', label: 'Hạn mức & Công tắc khẩn cấp' },
          { id: 'logs', label: 'Nhật ký kiểm toán' },
        ].map((t) => {
          const IconComponent = (t as any).icon;
          return (
            <button
              key={t.id}
              onClick={() => setActiveTab(t.id as any)}
              className={`px-4 py-2 rounded-xl text-sm font-semibold transition-all flex items-center gap-1.5 ${
                activeTab === t.id
                  ? 'bg-[#0f2942] text-white shadow-xs'
                  : 'bg-white hover:bg-amber-50/50 text-[#1c2530] border border-[#e8e2d5]'
              }`}
            >
              {IconComponent && <IconComponent className="w-4 h-4 text-amber-400" />}
              {t.label}
            </button>
          );
        })}
      </div>

      {/* TAB 1: TEACHERS */}
      {activeTab === 'teachers' && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Create teacher form */}
          <div className="bg-white p-5 rounded-2xl border border-[#e8e2d5] shadow-2xs space-y-4">
            <h3 className="text-base font-bold text-[#0f2942]">Tạo tài khoản giáo viên</h3>
            <form onSubmit={handleCreateTeacher} className="space-y-3">
              <div>
                <label className="text-xs font-semibold text-slate-700 block mb-1">Tên đăng nhập:</label>
                <input
                  type="text"
                  placeholder="Ví dụ: gv_lan"
                  value={newUsername}
                  onChange={(e) => setNewUsername(e.target.value)}
                  className="w-full text-xs p-2.5 rounded-xl border border-[#e8e2d5] bg-[#fbf9f4]"
                  required
                />
              </div>

              <div>
                <label className="text-xs font-semibold text-slate-700 block mb-1">Họ và tên giáo viên:</label>
                <input
                  type="text"
                  placeholder="Ví dụ: Cô Nguyễn Thị Lan"
                  value={newFullName}
                  onChange={(e) => setNewFullName(e.target.value)}
                  className="w-full text-xs p-2.5 rounded-xl border border-[#e8e2d5] bg-[#fbf9f4]"
                  required
                />
              </div>

              <div>
                <label className="text-xs font-semibold text-slate-700 block mb-1">Mật khẩu khởi tạo:</label>
                <input
                  type="text"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  className="w-full text-xs p-2.5 rounded-xl border border-[#e8e2d5] bg-[#fbf9f4] font-mono"
                  required
                />
              </div>

              <div className="flex items-center gap-2 pt-1">
                <input
                  type="checkbox"
                  id="testTeacher"
                  checked={newIsTestTeacher}
                  onChange={(e) => setNewIsTestTeacher(e.target.checked)}
                  className="rounded text-[#0f2942]"
                />
                <label htmlFor="testTeacher" className="text-xs text-slate-700 cursor-pointer">
                  Cấp quyền <strong>Giáo viên Test</strong> (Miễn hạn mức hỏi ngày)
                </label>
              </div>

              <button
                type="submit"
                className="w-full py-2.5 rounded-xl bg-[#0f2942] text-white text-xs font-semibold hover:bg-[#1e3a5f]"
              >
                Tạo tài khoản
              </button>
            </form>
          </div>

          {/* Teacher list */}
          <div className="lg:col-span-2 bg-white p-5 rounded-2xl border border-[#e8e2d5] shadow-2xs space-y-4">
            <h3 className="text-base font-bold text-[#0f2942]">Danh sách giáo viên hệ thống</h3>
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead>
                  <tr className="border-b border-[#e8e2d5] text-slate-400 font-semibold">
                    <th className="py-2">Tên đăng nhập</th>
                    <th className="py-2">Họ tên</th>
                    <th className="py-2">Lớp phụ trách</th>
                    <th className="py-2">Quyền Test</th>
                    <th className="py-2">Thao tác</th>
                  </tr>
                </thead>
                <tbody>
                  {teachers.map((t) => (
                    <tr key={t.id} className="border-b border-slate-100 last:border-none">
                      <td className="py-2.5 font-mono font-semibold text-[#0f2942]">{t.username}</td>
                      <td className="py-2.5 font-medium">{t.full_name}</td>
                      <td className="py-2.5 text-slate-600">
                        {t.assignedClasses && t.assignedClasses.length > 0 ? (
                          <div className="flex flex-wrap gap-1">
                            {t.assignedClasses.map((c: any) => (
                              <span key={c.id} className="px-2 py-0.5 rounded-md bg-amber-50 text-amber-900 border border-amber-200 text-[10px]">
                                {c.name}
                              </span>
                            ))}
                          </div>
                        ) : (
                          <span className="text-slate-400 italic">Chưa phân lớp</span>
                        )}
                      </td>
                      <td className="py-2.5">
                        {t.is_test_teacher ? (
                          <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-800 border border-emerald-200">
                            Miễn hạn mức
                          </span>
                        ) : (
                          <span className="text-slate-400 text-[11px]">Bình thường</span>
                        )}
                      </td>
                      <td className="py-2.5">
                        <button
                          onClick={() => handleToggleTestRole(t.id, t.is_test_teacher)}
                          className={`px-2.5 py-1 rounded-lg text-[11px] font-semibold transition-all ${
                            t.is_test_teacher
                              ? 'bg-amber-100 text-amber-900 hover:bg-amber-200'
                              : 'bg-emerald-50 text-emerald-800 hover:bg-emerald-100 border border-emerald-200'
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

      {/* TAB 2: AI & GEMINI CONFIGURATION */}
      {activeTab === 'ai' && (
        <div className="max-w-3xl bg-white p-6 rounded-2xl border border-[#e8e2d5] shadow-2xs space-y-6">
          <div className="flex items-start justify-between">
            <div>
              <h3 className="text-base font-bold text-[#0f2942] flex items-center gap-2">
                <Sparkles className="w-5 h-5 text-amber-600" />
                Quản lý Google Gemini API & Lựa chọn Mô hình
              </h3>
              <p className="text-xs text-slate-500 mt-1">
                Cấu hình trực tiếp API Key và chuyển đổi linh hoạt các mô hình Gemini trong quá trình vận hành mà không cần sửa file code hay khởi động lại máy chủ.
              </p>
            </div>

            {/* Current Mode Badge */}
            <div className={`px-3 py-1.5 rounded-full text-xs font-semibold flex items-center gap-1.5 shrink-0 ${
              isLiveAiConfigured
                ? 'bg-emerald-100 text-emerald-800 border border-emerald-200'
                : 'bg-amber-100 text-amber-900 border border-amber-200'
            }`}>
              {isLiveAiConfigured ? (
                <>
                  <span className="w-2 h-2 rounded-full bg-emerald-600 animate-pulse" />
                  Gemini API Thật (Live Mode)
                </>
              ) : (
                <>
                  <span className="w-2 h-2 rounded-full bg-amber-500" />
                  Giả lập kiểm thử (Mock Mode)
                </>
              )}
            </div>
          </div>

          {saveAiMsg && (
            <div className={`p-3 rounded-xl text-xs flex items-center gap-2 border ${
              saveAiMsg.type === 'success'
                ? 'bg-emerald-50 border-emerald-200 text-emerald-800'
                : 'bg-red-50 border-red-200 text-red-700'
            }`}>
              {saveAiMsg.type === 'success' ? (
                <CheckCircle2 className="w-4 h-4 shrink-0" />
              ) : (
                <AlertCircle className="w-4 h-4 shrink-0" />
              )}
              <span>{saveAiMsg.text}</span>
            </div>
          )}

          <form onSubmit={handleSaveAiSettings} className="space-y-5">
            {/* Prominent Active Saved Key Card */}
            {hasSavedKey && (
              <div className="p-3.5 bg-emerald-50 border border-emerald-200 rounded-xl flex items-center justify-between shadow-2xs">
                <div className="flex items-center gap-2.5">
                  <div className="w-8 h-8 rounded-lg bg-emerald-100 flex items-center justify-center text-emerald-700 shrink-0">
                    <CheckCircle2 className="w-5 h-5" />
                  </div>
                  <div>
                    <div className="text-xs font-bold text-emerald-950 flex items-center gap-2">
                      Đã lưu & Kích hoạt Gemini API Key thành công!
                    </div>
                    <div className="text-[11px] text-emerald-700 font-mono mt-0.5">
                      Khóa đang chạy thực tế: <span className="bg-white/80 px-2 py-0.5 rounded font-bold border border-emerald-200">{maskedApiKey}</span>
                    </div>
                  </div>
                </div>
                <span className="px-2.5 py-1 bg-emerald-600 text-white rounded-full text-[10px] font-bold tracking-wide uppercase">
                  Live Active
                </span>
              </div>
            )}

            {/* API Key input */}
            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <label className="text-xs font-bold text-slate-700">
                  {hasSavedKey ? 'Nhập khóa API mới nếu muốn thay đổi:' : 'Nhập Google Gemini API Key:'}
                </label>
              </div>

              <div className="relative">
                <input
                  type={showApiKey ? 'text' : 'password'}
                  placeholder={hasSavedKey ? `Đang dùng khóa (${maskedApiKey}) - Để trống nếu giữ nguyên` : 'AIzaSy... (Lấy tại aistudio.google.com)'}
                  value={apiKeyInput}
                  onChange={(e) => setApiKeyInput(e.target.value)}
                  className="w-full text-xs p-2.5 pr-10 rounded-xl border border-[#e8e2d5] bg-[#fbf9f4] font-mono focus:ring-2 focus:ring-[#0f2942]/20 focus:outline-none"
                />
                <button
                  type="button"
                  onClick={() => setShowApiKey(!showApiKey)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                >
                  {showApiKey ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>

              <p className="text-[11px] text-slate-500">
                Lấy API Key hoàn toàn miễn phí tại{' '}
                <a
                  href="https://aistudio.google.com/app/apikey"
                  target="_blank"
                  rel="noreferrer"
                  className="text-amber-700 underline font-semibold"
                >
                  Google AI Studio
                </a>.
              </p>
            </div>

            {/* Model Selection */}
            <div className="space-y-2">
              <label className="text-xs font-bold text-slate-700 block">
                Lựa chọn Mô hình AI (Model Selection):
              </label>

              <div className="grid grid-cols-1 gap-2.5">
                {supportedModels.map((m) => {
                  const isSelected = selectedModel === m.id;
                  return (
                    <label
                      key={m.id}
                      onClick={() => setSelectedModel(m.id)}
                      className={`p-3.5 rounded-xl border cursor-pointer transition-all flex items-start justify-between ${
                        isSelected
                          ? 'border-[#0f2942] bg-[#0f2942]/5 ring-1 ring-[#0f2942]'
                          : 'border-[#e8e2d5] bg-white hover:bg-[#fbf9f4]'
                      }`}
                    >
                      <div className="flex items-start gap-3">
                        <input
                          type="radio"
                          name="geminiModel"
                          value={m.id}
                          checked={isSelected}
                          onChange={() => setSelectedModel(m.id)}
                          className="mt-1 text-[#0f2942]"
                        />
                        <div>
                          <div className="flex items-center gap-2">
                            <span className="text-xs font-bold text-[#0f2942]">{m.name}</span>
                            {m.badge && (
                              <span className={`text-[10px] px-2 py-0.2 rounded-full font-semibold ${
                                m.badge === 'Khuyên dùng'
                                  ? 'bg-amber-100 text-amber-800 border border-amber-200'
                                  : 'bg-indigo-100 text-indigo-800 border border-indigo-200'
                              }`}>
                                {m.badge}
                              </span>
                            )}
                          </div>
                          <p className="text-[11px] text-slate-500 mt-0.5">{m.description}</p>
                          <code className="text-[10px] font-mono text-slate-400 mt-1 block">ID: {m.id}</code>
                        </div>
                      </div>
                      <Cpu className={`w-4 h-4 shrink-0 mt-1 ${isSelected ? 'text-[#0f2942]' : 'text-slate-300'}`} />
                    </label>
                  );
                })}
              </div>

              {/* Custom Model input */}
              <div className="pt-2">
                <label className="text-[11px] text-slate-600 block mb-1">Hoặc nhập mã mô hình Gemini tùy chỉnh khác:</label>
                <input
                  type="text"
                  placeholder="Ví dụ: gemini-1.5-flash, gemini-1.5-pro..."
                  value={selectedModel}
                  onChange={(e) => setSelectedModel(e.target.value.trim())}
                  className="w-full text-xs p-2 rounded-xl border border-[#e8e2d5] bg-[#fbf9f4] font-mono"
                />
              </div>
            </div>

            {/* Test Connection Results Card */}
            {testResult && (
              <div className={`p-3.5 rounded-xl text-xs border ${
                testResult.success
                  ? 'bg-emerald-50 border-emerald-200 text-emerald-900'
                  : 'bg-red-50 border-red-200 text-red-800'
              }`}>
                <div className="flex items-center justify-between font-bold mb-1">
                  <span className="flex items-center gap-1.5">
                    {testResult.success ? (
                      <CheckCircle2 className="w-4 h-4 text-emerald-700" />
                    ) : (
                      <AlertCircle className="w-4 h-4 text-red-600" />
                    )}
                    {testResult.success ? 'Kiểm tra thành công!' : 'Kiểm tra thất bại!'}
                  </span>
                  {testResult.responseTimeMs && (
                    <span className="font-mono text-[10px] text-slate-500">
                      Độ trễ: {testResult.responseTimeMs}ms
                    </span>
                  )}
                </div>
                <p className="text-[11px] leading-relaxed">{testResult.message}</p>
              </div>
            )}

            {/* Action buttons */}
            <div className="flex items-center justify-between pt-3 border-t border-[#e8e2d5]">
              <button
                type="button"
                onClick={handleTestAiConnection}
                disabled={testResult?.loading}
                className="px-4 py-2.5 rounded-xl border border-[#0f2942] text-[#0f2942] hover:bg-slate-50 text-xs font-semibold flex items-center gap-1.5 disabled:opacity-50"
              >
                {testResult?.loading ? (
                  <>
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    Đang gửi ping kiểm tra...
                  </>
                ) : (
                  <>
                    <Sparkles className="w-3.5 h-3.5 text-amber-600" />
                    Kiểm tra kết nối
                  </>
                )}
              </button>

              <button
                type="submit"
                disabled={savingAi}
                className="px-6 py-2.5 rounded-xl bg-[#0f2942] hover:bg-[#1e3a5f] text-white text-xs font-semibold flex items-center gap-1.5 shadow-xs disabled:opacity-50"
              >
                {savingAi ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : null}
                Lưu cấu hình AI
              </button>
            </div>
          </form>
        </div>
      )}

      {/* TAB 3: SYSTEM & KILL SWITCH */}
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

            <button
              type="submit"
              className="px-5 py-2.5 rounded-xl bg-[#0f2942] text-white text-xs font-semibold hover:bg-[#1e3a5f]"
            >
              Lưu cấu hình hệ thống
            </button>
          </form>
        </div>
      )}

      {/* TAB 4: AUDIT LOGS */}
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
