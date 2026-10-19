import React, { useState, useEffect } from 'react';
import {
  Power, Settings, History, Sparkles,
  CheckCircle2, AlertCircle, Eye, EyeOff, Loader2, Cpu,
  Layers, RefreshCw, Zap, ShieldCheck,
  Trash2, Users, GraduationCap, Plus, BookOpen, Lock, Unlock, KeyRound, X, Award,
  BarChart3, RotateCcw, Activity, TrendingUp, Coins, Clock, ShieldAlert, ArrowRight,
  Globe, ExternalLink, Network, Server
} from 'lucide-react';
import { apiRequest } from '../api/client.js';
import type { KeyPoolItem, TokenStatsSummary, ThirdPartyPreset } from '../types.js';

export const AdminDashboard: React.FC = () => {
  const [activeTab, setActiveTab] = useState<'teachers' | 'classes' | 'ai' | 'system' | 'logs'>('teachers');

  // Teachers
  const [teachers, setTeachers] = useState<any[]>([]);
  const [newUsername, setNewUsername] = useState('');
  const [newPassword, setNewPassword] = useState('GiaoVien@2026!');
  const [newFullName, setNewFullName] = useState('');
  const [newIsTestTeacher, setNewIsTestTeacher] = useState(false);

  // Teacher Class Assignment Modal
  const [assignModalTeacher, setAssignModalTeacher] = useState<any | null>(null);
  const [selectedAssignClassIds, setSelectedAssignClassIds] = useState<string[]>([]);
  const [savingAssignments, setSavingAssignments] = useState(false);

  // Classes & Students management (Admin supreme view)
  const [classes, setClasses] = useState<any[]>([]);
  const [selectedClassId, setSelectedClassId] = useState<string>('');
  const [classStudents, setClassStudents] = useState<any[]>([]);
  const [loadingClassStudents, setLoadingClassStudents] = useState(false);
  const [newClassName, setNewClassName] = useState('');
  const [newClassGrade, setNewClassGrade] = useState(9);

  // System settings
  const [dailyLimit, setDailyLimit] = useState(20);
  const [systemHardCap, setSystemHardCap] = useState(5000);
  const [isKillSwitchActive, setIsKillSwitchActive] = useState(false);

  // AI Configuration State
  const [providerType, setProviderType] = useState<'google_official' | 'third_party'>('google_official');
  const [apiKeyInput, setApiKeyInput] = useState('');
  const [showApiKey, setShowApiKey] = useState(false);
  const [maskedApiKey, setMaskedApiKey] = useState('');
  const [hasSavedKey, setHasSavedKey] = useState(false);
  const [keyCount, setKeyCount] = useState(0);
  const [activeKeyCount, setActiveKeyCount] = useState(0);
  const [keyPool, setKeyPool] = useState<KeyPoolItem[]>([]);
  const [tokenStats, setTokenStats] = useState<TokenStatsSummary | null>(null);
  const [refreshingStats, setRefreshingStats] = useState(false);
  const [resettingStats, setResettingStats] = useState(false);
  const [selectedModel, setSelectedModel] = useState('gemini-3.8-flash');
  const [supportedModels, setSupportedModels] = useState<any[]>([]);

  // Third-Party Gateway settings (RouteAPI, OpenRouter, DeepSeek, etc.)
  const [customBaseUrl, setCustomBaseUrl] = useState('https://api.routeapi.ai/v1');
  const [customApiKeyInput, setCustomApiKeyInput] = useState('');
  const [showCustomApiKey, setShowCustomApiKey] = useState(false);
  const [customModelName, setCustomModelName] = useState('google/gemini-2.5-flash');
  const [hasCustomApiKey, setHasCustomApiKey] = useState(false);
  const [customKeyCount, setCustomKeyCount] = useState(0);
  const [customKeyPool, setCustomKeyPool] = useState<KeyPoolItem[]>([]);
  const [thirdPartyPresets, setThirdPartyPresets] = useState<ThirdPartyPreset[]>([]);
  const [selectedPresetId, setSelectedPresetId] = useState('routeapi');

  const [isLiveAiConfigured, setIsLiveAiConfigured] = useState(false);
  const [savingAi, setSavingAi] = useState(false);
  const [saveAiMsg, setSaveAiMsg] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [testResult, setTestResult] = useState<{
    loading: boolean;
    success?: boolean;
    message?: string;
    responseTimeMs?: number;
    totalKeys?: number;
    workingKeys?: number;
    results?: Array<{
      index: number;
      maskedKey: string;
      success: boolean;
      modelUsed: string;
      responseTimeMs?: number;
      message: string;
      status: 'ready' | 'quota_exceeded' | 'unavailable' | 'error';
    }>;
  } | null>(null);

  // Audit logs
  const [logs, setLogs] = useState<any[]>([]);

  useEffect(() => {
    loadTeachers();
    loadClasses();
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

  const loadClasses = async () => {
    try {
      const data = await apiRequest('/api/admin/classes');
      const cls = data.classes || [];
      setClasses(cls);
      if (cls.length > 0 && !selectedClassId) {
        setSelectedClassId(cls[0].id);
        loadClassStudents(cls[0].id);
      }
    } catch {}
  };

  const loadClassStudents = async (classId: string) => {
    if (!classId) return;
    setLoadingClassStudents(true);
    try {
      const data = await apiRequest(`/api/admin/classes/${classId}/students`);
      setClassStudents(data.students || []);
    } catch {
      setClassStudents([]);
    } finally {
      setLoadingClassStudents(false);
    }
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
      setProviderType(data.providerType || 'google_official');
      setMaskedApiKey(data.maskedApiKey || '');
      setHasSavedKey(!!data.hasApiKey);
      setKeyCount(data.keyCount || 0);
      setActiveKeyCount(data.activeKeyCount || 0);
      setKeyPool(data.keyPool || []);
      if (data.tokenStats) setTokenStats(data.tokenStats);
      if (data.activeModel) setSelectedModel(data.activeModel);
      if (data.supportedModels) setSupportedModels(data.supportedModels);

      // Third-party Gateway settings
      if (data.customBaseUrl) setCustomBaseUrl(data.customBaseUrl);
      if (data.customModelName) setCustomModelName(data.customModelName);
      setHasCustomApiKey(!!data.hasCustomApiKey);
      setCustomKeyCount(data.customKeyCount || 0);
      setCustomKeyPool(data.customKeyPool || []);
      if (data.thirdPartyPresets) setThirdPartyPresets(data.thirdPartyPresets);
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

  const handleDeleteTeacher = async (teacherId: string, fullName: string, username: string) => {
    if (!confirm(`Bạn có chắc chắn muốn XÓA tài khoản giáo viên "${fullName}" (@${username}) không?\n\nLưu ý: Mọi phân công lớp học của giáo viên này sẽ bị hủy bỏ vĩnh viễn.`)) {
      return;
    }

    try {
      const res = await apiRequest(`/api/admin/teachers/${teacherId}`, { method: 'DELETE' });
      alert(res.message);
      loadTeachers();
      loadClasses();
    } catch (err: any) {
      alert(err.message);
    }
  };

  const handleOpenAssignModal = (teacher: any) => {
    setAssignModalTeacher(teacher);
    setSelectedAssignClassIds((teacher.assignedClasses || []).map((c: any) => c.id));
  };

  const handleToggleAssignClass = (classId: string) => {
    if (selectedAssignClassIds.includes(classId)) {
      setSelectedAssignClassIds(selectedAssignClassIds.filter((id) => id !== classId));
    } else {
      setSelectedAssignClassIds([...selectedAssignClassIds, classId]);
    }
  };

  const handleSaveAssignments = async () => {
    if (!assignModalTeacher) return;
    setSavingAssignments(true);
    try {
      const res = await apiRequest(`/api/admin/teachers/${assignModalTeacher.id}/classes`, {
        method: 'PUT',
        body: JSON.stringify({ classIds: selectedAssignClassIds }),
      });
      alert(res.message);
      setAssignModalTeacher(null);
      loadTeachers();
      loadClasses();
    } catch (err: any) {
      alert(err.message);
    } finally {
      setSavingAssignments(false);
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

  // Class & Student Actions (Admin supreme view)
  const handleCreateClass = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newClassName.trim()) return;
    try {
      const res = await apiRequest('/api/admin/classes', {
        method: 'POST',
        body: JSON.stringify({ name: newClassName.trim(), grade: newClassGrade }),
      });
      alert(res.message);
      setNewClassName('');
      loadClasses();
    } catch (err: any) {
      alert(err.message);
    }
  };

  const handleDeleteClass = async (classId: string, className: string) => {
    if (!confirm(`Bạn có chắc chắn muốn xóa lớp "${className}" không? Chỉ có thể xóa lớp khi không có học sinh.`)) return;
    try {
      const res = await apiRequest(`/api/admin/classes/${classId}`, { method: 'DELETE' });
      alert(res.message);
      loadClasses();
    } catch (err: any) {
      alert(err.message);
    }
  };

  const handleDeleteStudent = async (studentId: string, studentName: string) => {
    if (!confirm(`Bạn có chắc chắn muốn XÓA học sinh "${studentName}" khỏi lớp này không?\n\nTài khoản học sinh sẽ bị xóa vĩnh viễn khỏi toàn bộ hệ thống.`)) return;
    try {
      const res = await apiRequest(`/api/admin/students/${studentId}`, { method: 'DELETE' });
      alert(res.message);
      loadClassStudents(selectedClassId);
      loadClasses();
    } catch (err: any) {
      alert(err.message);
    }
  };

  const handleResetStudentPassword = async (studentId: string) => {
    const tempPass = prompt('Nhập mật khẩu tạm thời mới cho học sinh (tối thiểu 6 ký tự):', 'HocSinh@2026!');
    if (!tempPass) return;
    try {
      const res = await apiRequest(`/api/teacher/students/${studentId}/reset-password`, {
        method: 'POST',
        body: JSON.stringify({ tempPassword: tempPass }),
      });
      alert(res.message);
      loadClassStudents(selectedClassId);
    } catch (err: any) {
      alert(err.message);
    }
  };

  const handleToggleStudentLock = async (studentId: string, currentActive: boolean) => {
    try {
      await apiRequest(`/api/teacher/students/${studentId}/lock`, {
        method: 'PUT',
        body: JSON.stringify({ isActive: !currentActive }),
      });
      loadClassStudents(selectedClassId);
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

  const handleSelectPreset = (preset: ThirdPartyPreset) => {
    setSelectedPresetId(preset.id);
    setCustomBaseUrl(preset.baseUrl);
    if (preset.suggestedModels && preset.suggestedModels.length > 0) {
      setCustomModelName(preset.suggestedModels[0].id);
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
          providerType,
          apiKey: apiKeyInput.trim() || undefined,
          modelName: selectedModel,
          customBaseUrl: customBaseUrl.trim() || undefined,
          customApiKey: customApiKeyInput.trim() || undefined,
          customModelName: customModelName.trim() || undefined,
        }),
      });
      setSaveAiMsg({ type: 'success', text: res.message || 'Đã lưu cấu hình AI thành công.' });
      setApiKeyInput('');
      setCustomApiKeyInput('');
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
          providerType,
          apiKey: apiKeyInput.trim() || undefined,
          modelName: selectedModel,
          customBaseUrl: customBaseUrl.trim() || undefined,
          customApiKey: customApiKeyInput.trim() || undefined,
          customModelName: customModelName.trim() || undefined,
        }),
      });
      setTestResult({
        loading: false,
        success: res.success,
        message: res.message,
        responseTimeMs: res.responseTimeMs,
        totalKeys: res.totalKeys,
        workingKeys: res.workingKeys,
        results: res.results,
      });
    } catch (err: any) {
      setTestResult({
        loading: false,
        success: false,
        message: err.data?.message || err.message || 'Không thể kết nối tới nhà cung cấp AI.',
        results: err.data?.results,
        totalKeys: err.data?.totalKeys,
        workingKeys: err.data?.workingKeys,
      });
    }
  };

  const handleDeleteKey = async (index: number, maskedKey: string, provider: 'google_official' | 'third_party' = providerType) => {
    const label = provider === 'third_party' ? 'Token bên thứ 3' : 'API Key';
    if (!confirm(`Bạn có chắc chắn muốn xóa ${label} #${index} (${maskedKey}) khỏi hệ thống không?`)) return;
    try {
      const res = await apiRequest(`/api/admin/ai-settings/keys/${index}?provider=${provider}`, { method: 'DELETE' });
      alert(res.message);
      loadAiSettings();
      loadSettings();
    } catch (err: any) {
      alert(err.message);
    }
  };

  const handleClearAllKeys = async (provider: 'google_official' | 'third_party' = providerType) => {
    const label = provider === 'third_party' ? 'toàn bộ Token bên thứ 3' : 'toàn bộ Google Gemini API Keys';
    if (!confirm(`Bạn có chắc chắn muốn XÓA ${label} không?\n\nHệ thống sẽ chuyển về chế độ Giả lập kiểm thử (Mock Mode) cho đến khi có cấu hình mới.`)) return;
    try {
      const res = await apiRequest(`/api/admin/ai-settings/keys?provider=${provider}`, { method: 'DELETE' });
      alert(res.message);
      loadAiSettings();
      loadSettings();
    } catch (err: any) {
      alert(err.message);
    }
  };

  const handleRefreshAiSettings = async () => {
    setRefreshingStats(true);
    try {
      await loadAiSettings();
    } finally {
      setRefreshingStats(false);
    }
  };

  const handleResetTokenStats = async () => {
    if (!confirm('Bạn có chắc chắn muốn ĐẶT LẠI toàn bộ thống kê tiêu thụ token về 0 không?\n\nThao tác này sẽ làm sạch số liệu tích lũy của toàn bộ các API Key (thường thực hiện vào đầu tháng hoặc khi thay mới dàn Key).')) return;
    setResettingStats(true);
    try {
      const res = await apiRequest('/api/admin/ai-settings/reset-token-stats', { method: 'POST' });
      alert(res.message);
      if (res.config) {
        if (res.config.tokenStats) setTokenStats(res.config.tokenStats);
        if (res.config.keyPool) setKeyPool(res.config.keyPool);
      } else {
        loadAiSettings();
      }
    } catch (err: any) {
      alert(err.message || 'Không thể đặt lại thống kê token.');
    } finally {
      setResettingStats(false);
    }
  };

  const formatDateTime = (iso?: string | null) => {
    if (!iso) return 'Chưa có lượt gọi';
    try {
      const d = new Date(iso);
      return d.toLocaleString('vi-VN', {
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
        day: '2-digit',
        month: '2-digit',
        year: 'numeric',
      });
    } catch {
      return iso;
    }
  };

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      {/* Tabs */}
      <div className="flex flex-wrap gap-2 mb-6 border-b border-[#e8e2d5] pb-3">
        {[
          { id: 'teachers', label: 'Quản lý Giáo viên', icon: Users },
          { id: 'classes', label: 'Quản lý Lớp & Học sinh', icon: GraduationCap },
          { id: 'ai', label: 'Quản lý AI & Gemini Model', icon: Sparkles },
          { id: 'system', label: 'Hạn mức & Công tắc khẩn cấp', icon: Settings },
          { id: 'logs', label: 'Nhật ký kiểm toán', icon: History },
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
            <h3 className="text-base font-bold text-[#0f2942] flex items-center gap-2">
              <Users className="w-5 h-5 text-amber-600" />
              Tạo tài khoản giáo viên
            </h3>
            <p className="text-xs text-slate-500">
              Giáo viên là cấp quản lý thứ 2, có quyền quản lý học sinh và tài liệu văn học của các lớp được phân công.
            </p>
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
                Tạo tài khoản giáo viên
              </button>
            </form>
          </div>

          {/* Teacher list */}
          <div className="lg:col-span-2 bg-white p-5 rounded-2xl border border-[#e8e2d5] shadow-2xs space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-base font-bold text-[#0f2942]">Danh sách giáo viên hệ thống</h3>
              <span className="text-xs text-slate-500 font-semibold">{teachers.length} giáo viên</span>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead>
                  <tr className="border-b border-[#e8e2d5] text-slate-400 font-semibold">
                    <th className="py-2.5">Tên đăng nhập</th>
                    <th className="py-2.5">Họ tên</th>
                    <th className="py-2.5">Lớp phụ trách</th>
                    <th className="py-2.5">Quyền Test</th>
                    <th className="py-2.5 text-right">Thao tác</th>
                  </tr>
                </thead>
                <tbody>
                  {teachers.map((t) => (
                    <tr key={t.id} className="border-b border-slate-100 last:border-none hover:bg-slate-50">
                      <td className="py-2.5 font-mono font-semibold text-[#0f2942]">@{t.username}</td>
                      <td className="py-2.5 font-medium">{t.full_name}</td>
                      <td className="py-2.5 text-slate-600">
                        {t.assignedClasses && t.assignedClasses.length > 0 ? (
                          <div className="flex flex-wrap gap-1">
                            {t.assignedClasses.map((c: any) => (
                              <span key={c.id} className="px-2 py-0.5 rounded-md bg-amber-50 text-amber-900 border border-amber-200 text-[10px] font-semibold">
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
                      <td className="py-2.5 text-right space-x-1.5 whitespace-nowrap">
                        <button
                          onClick={() => handleOpenAssignModal(t)}
                          title="Phân công lớp phụ trách"
                          className="px-2 py-1 rounded-lg text-[11px] font-semibold bg-sky-50 text-sky-800 hover:bg-sky-100 border border-sky-200 inline-flex items-center gap-1"
                        >
                          <BookOpen className="w-3 h-3" />
                          Phân lớp
                        </button>
                        <button
                          onClick={() => handleToggleTestRole(t.id, t.is_test_teacher)}
                          className={`px-2 py-1 rounded-lg text-[11px] font-semibold transition-all ${
                            t.is_test_teacher
                              ? 'bg-amber-100 text-amber-900 hover:bg-amber-200'
                              : 'bg-emerald-50 text-emerald-800 hover:bg-emerald-100 border border-emerald-200'
                          }`}
                        >
                          {t.is_test_teacher ? 'Thu hồi Test' : 'Cấp Test'}
                        </button>
                        <button
                          onClick={() => handleDeleteTeacher(t.id, t.full_name, t.username)}
                          title="Xóa giáo viên này khỏi hệ thống"
                          className="p-1 rounded-lg hover:bg-red-100 text-red-600 transition-all inline-flex items-center"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </td>
                    </tr>
                  ))}
                  {teachers.length === 0 && (
                    <tr>
                      <td colSpan={5} className="py-8 text-center text-slate-400">
                        Chưa có giáo viên nào trong hệ thống.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* TAB 2: CLASSES & STUDENTS (Admin Supreme Management) */}
      {activeTab === 'classes' && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Class list and creator */}
          <div className="bg-white p-5 rounded-2xl border border-[#e8e2d5] shadow-2xs space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-base font-bold text-[#0f2942] flex items-center gap-2">
                <GraduationCap className="w-5 h-5 text-amber-600" />
                Danh sách lớp học toàn trường
              </h3>
              <span className="text-xs text-slate-500 font-semibold">{classes.length} lớp</span>
            </div>

            <div className="space-y-1.5 max-h-[380px] overflow-y-auto pr-1">
              {classes.map((c) => (
                <div
                  key={c.id}
                  onClick={() => {
                    setSelectedClassId(c.id);
                    loadClassStudents(c.id);
                  }}
                  className={`w-full text-left p-3 rounded-xl border text-xs cursor-pointer transition-all flex items-center justify-between ${
                    selectedClassId === c.id
                      ? 'bg-amber-50 border-amber-300 font-bold text-[#0f2942] shadow-2xs'
                      : 'bg-white hover:bg-slate-50 border-[#e8e2d5] text-slate-700'
                  }`}
                >
                  <div>
                    <span className="text-xs font-bold text-[#0f2942]">{c.name}</span>
                    <span className="text-[11px] text-slate-500 ml-1.5">(Khối {c.grade})</span>
                    <div className="text-[10px] text-slate-400 mt-0.5">
                      {c.teacher_count || 0} GV phụ trách
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-[11px] px-2 py-0.5 rounded-full bg-slate-100 text-slate-600 font-semibold">
                      {c.student_count ?? 0} HS
                    </span>
                    {Number(c.student_count) === 0 && (
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          handleDeleteClass(c.id, c.name);
                        }}
                        title="Xóa lớp rỗng này"
                        className="p-1 rounded hover:bg-red-100 text-slate-400 hover:text-red-600"
                      >
                        <Trash2 className="w-3 h-3" />
                      </button>
                    )}
                  </div>
                </div>
              ))}
              {classes.length === 0 && (
                <p className="text-xs text-slate-400 py-4 text-center">Chưa có lớp nào được tạo.</p>
              )}
            </div>

            <form onSubmit={handleCreateClass} className="pt-4 border-t border-[#e8e2d5] space-y-2">
              <span className="text-xs font-semibold text-slate-700 block">Tạo lớp học mới:</span>
              <input
                type="text"
                placeholder="Ví dụ: Lớp 10A1, Lớp 12D..."
                value={newClassName}
                onChange={(e) => setNewClassName(e.target.value)}
                className="w-full text-xs p-2 rounded-xl border border-[#e8e2d5] bg-[#fbf9f4]"
                required
              />
              <div className="flex gap-2">
                <select
                  value={newClassGrade}
                  onChange={(e) => setNewClassGrade(Number(e.target.value))}
                  className="w-1/2 text-xs p-2 rounded-xl border border-[#e8e2d5] bg-[#fbf9f4]"
                >
                  {[6, 7, 8, 9, 10, 11, 12].map((g) => (
                    <option key={g} value={g}>Khối {g}</option>
                  ))}
                </select>
                <button
                  type="submit"
                  className="w-1/2 text-xs font-semibold bg-[#0f2942] text-white rounded-xl py-2 hover:bg-[#1e3a5f] flex items-center justify-center gap-1"
                >
                  <Plus className="w-3.5 h-3.5" />
                  Thêm lớp
                </button>
              </div>
            </form>
          </div>

          {/* Student roster in chosen class */}
          <div className="lg:col-span-2 bg-white p-5 rounded-2xl border border-[#e8e2d5] shadow-2xs space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-base font-bold text-[#0f2942]">
                  Danh sách học sinh:{' '}
                  <span className="text-amber-800">
                    {classes.find((c) => c.id === selectedClassId)?.name || 'Chưa chọn lớp'}
                  </span>
                </h3>
                <p className="text-[11px] text-slate-500 mt-0.5">
                  Là Quản trị viên tối cao, bạn có quyền xóa học sinh, đặt lại mật khẩu và khóa tài khoản học sinh ở bất kỳ lớp nào.
                </p>
              </div>
              <span className="text-xs text-slate-500 font-semibold shrink-0">
                {classStudents.length} học sinh
              </span>
            </div>

            {loadingClassStudents ? (
              <div className="py-12 flex justify-center items-center text-slate-400 gap-2">
                <Loader2 className="w-5 h-5 animate-spin text-[#0f2942]" />
                <span className="text-xs">Đang tải danh sách học sinh...</span>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead>
                    <tr className="border-b border-[#e8e2d5] text-slate-400 font-semibold">
                      <th className="py-2.5">Mã HS</th>
                      <th className="py-2.5">Họ và tên</th>
                      <th className="py-2.5">Tên đăng nhập</th>
                      <th className="py-2.5">Trạng thái</th>
                      <th className="py-2.5">Mật khẩu</th>
                      <th className="py-2.5 text-right">Thao tác</th>
                    </tr>
                  </thead>
                  <tbody>
                    {classStudents.map((s) => (
                      <tr key={s.id} className="border-b border-slate-100 last:border-none hover:bg-slate-50">
                        <td className="py-2.5 font-bold font-mono text-[#0f2942]">{s.student_code}</td>
                        <td className="py-2.5 font-medium">{s.full_name}</td>
                        <td className="py-2.5 font-mono text-slate-600">@{s.username}</td>
                        <td className="py-2.5">
                          <span
                            className={`px-2 py-0.5 rounded-full text-[10px] font-semibold ${
                              s.is_active ? 'bg-emerald-100 text-emerald-800' : 'bg-red-100 text-red-800'
                            }`}
                          >
                            {s.is_active ? 'Hoạt động' : 'Đã khóa'}
                          </span>
                        </td>
                        <td className="py-2.5">
                          {s.must_change_password ? (
                            <span className="px-2 py-0.5 rounded-full text-[10px] font-medium bg-amber-100 text-amber-800 border border-amber-200">
                              Chưa đổi MK đầu
                            </span>
                          ) : (
                            <span className="px-2 py-0.5 rounded-full text-[10px] font-medium bg-slate-100 text-slate-700">
                              Đã đổi riêng
                            </span>
                          )}
                        </td>
                        <td className="py-2.5 text-right space-x-1 whitespace-nowrap">
                          <button
                            onClick={() => handleResetStudentPassword(s.id)}
                            title="Đặt lại mật khẩu tạm thời"
                            className="p-1 rounded hover:bg-slate-200 text-slate-700 transition-all"
                          >
                            <KeyRound className="w-3.5 h-3.5" />
                          </button>
                          <button
                            onClick={() => handleToggleStudentLock(s.id, s.is_active)}
                            title={s.is_active ? 'Khóa tài khoản' : 'Mở khóa tài khoản'}
                            className={`p-1 rounded transition-all ${
                              s.is_active ? 'hover:bg-amber-100 text-amber-600' : 'hover:bg-emerald-100 text-emerald-600'
                            }`}
                          >
                            {s.is_active ? <Lock className="w-3.5 h-3.5" /> : <Unlock className="w-3.5 h-3.5" />}
                          </button>
                          <button
                            onClick={() => handleDeleteStudent(s.id, s.full_name)}
                            title="XÓA học sinh này khỏi lớp và hệ thống"
                            className="p-1 rounded hover:bg-red-100 text-red-600 transition-all"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </td>
                      </tr>
                    ))}
                    {classStudents.length === 0 && (
                      <tr>
                        <td colSpan={6} className="py-8 text-center text-slate-400">
                          Chưa có học sinh nào trong lớp này. Giáo viên phụ trách có thể thêm học sinh hoặc nhập bằng file CSV.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      )}

      {/* TEACHER CLASS ASSIGNMENT MODAL */}
      {assignModalTeacher && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-xs p-4">
          <div className="bg-white rounded-3xl p-6 sm:p-7 max-w-lg w-full shadow-2xl border border-[#e8e2d5] relative animate-in fade-in zoom-in-95">
            <button
              onClick={() => setAssignModalTeacher(null)}
              className="absolute top-5 right-5 text-slate-400 hover:text-slate-600 p-1 rounded-lg"
            >
              <X className="w-5 h-5" />
            </button>

            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 rounded-xl bg-amber-100 flex items-center justify-center text-amber-900 shrink-0">
                <BookOpen className="w-5 h-5 text-amber-800" />
              </div>
              <div>
                <h3 className="text-base font-bold text-[#0f2942]">
                  Phân công lớp cho giáo viên
                </h3>
                <p className="text-xs text-slate-500">
                  {assignModalTeacher.full_name} (@{assignModalTeacher.username})
                </p>
              </div>
            </div>

            <p className="text-xs text-slate-600 mb-3">
              Tích chọn các lớp mà giáo viên này có quyền giảng dạy và quản lý học sinh:
            </p>

            <div className="space-y-2 max-h-[260px] overflow-y-auto border border-[#e8e2d5] rounded-xl p-3 bg-[#fbf9f4]">
              {classes.map((c) => {
                const isAssigned = selectedAssignClassIds.includes(c.id);
                return (
                  <label
                    key={c.id}
                    onClick={() => handleToggleAssignClass(c.id)}
                    className={`p-2.5 rounded-lg border cursor-pointer transition-all flex items-center justify-between text-xs ${
                      isAssigned
                        ? 'bg-white border-[#0f2942] ring-1 ring-[#0f2942] font-semibold text-[#0f2942]'
                        : 'bg-white/60 border-slate-200 text-slate-700 hover:bg-white'
                    }`}
                  >
                    <div className="flex items-center gap-2.5">
                      <input
                        type="checkbox"
                        checked={isAssigned}
                        onChange={() => {}} // Controlled by label click
                        className="rounded text-[#0f2942]"
                      />
                      <span>{c.name} (Khối {c.grade})</span>
                    </div>
                    <span className="text-[10px] text-slate-400 font-normal">
                      {c.student_count || 0} HS
                    </span>
                  </label>
                );
              })}
              {classes.length === 0 && (
                <p className="text-xs text-slate-400 text-center py-4">Chưa có lớp học nào trong hệ thống.</p>
              )}
            </div>

            <div className="flex items-center justify-end gap-2 pt-4 mt-2 border-t border-[#e8e2d5]">
              <button
                type="button"
                onClick={() => setAssignModalTeacher(null)}
                className="px-4 py-2 rounded-xl border border-slate-200 text-xs font-semibold text-slate-600 hover:bg-slate-50"
              >
                Hủy bỏ
              </button>
              <button
                type="button"
                onClick={handleSaveAssignments}
                disabled={savingAssignments}
                className="px-5 py-2 rounded-xl bg-[#0f2942] text-white text-xs font-semibold hover:bg-[#1e3a5f] flex items-center gap-1.5"
              >
                {savingAssignments && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                Lưu phân công
              </button>
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

          {/* Token Consumption & API Performance Dashboard */}
          <div className="rounded-2xl border border-slate-200/80 bg-linear-to-br from-slate-50 via-white to-sky-50/30 p-5 space-y-4 shadow-2xs">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-xl bg-indigo-50 border border-indigo-200/80 flex items-center justify-center text-indigo-700 shadow-2xs">
                  <BarChart3 className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="text-xs font-bold text-slate-900 tracking-wide uppercase flex items-center gap-2">
                    Thống Kê Tiêu Thụ Token & Tải Hệ Thống
                  </h3>
                  <p className="text-[11px] text-slate-500">
                    Theo dõi lượng token tiêu thụ theo thời gian thực của từng API Key và toàn bộ hệ thống
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-2 shrink-0">
                <button
                  type="button"
                  onClick={handleRefreshAiSettings}
                  disabled={refreshingStats}
                  className="px-2.5 py-1.5 text-xs font-semibold text-slate-700 bg-white hover:bg-slate-100 rounded-xl border border-slate-200 transition-colors flex items-center gap-1.5 shadow-2xs cursor-pointer disabled:opacity-60"
                  title="Tải lại số liệu thống kê mới nhất"
                >
                  <RefreshCw className={`w-3.5 h-3.5 ${refreshingStats ? 'animate-spin text-indigo-600' : 'text-slate-500'}`} />
                  <span>{refreshingStats ? 'Đang tải...' : 'Làm mới'}</span>
                </button>
                <button
                  type="button"
                  onClick={handleResetTokenStats}
                  disabled={resettingStats}
                  className="px-2.5 py-1.5 text-xs font-semibold text-red-700 bg-red-50 hover:bg-red-100/80 rounded-xl border border-red-200/80 transition-colors flex items-center gap-1.5 shadow-2xs cursor-pointer disabled:opacity-60"
                  title="Đặt lại bộ đếm token về 0"
                >
                  <RotateCcw className={`w-3.5 h-3.5 ${resettingStats ? 'animate-spin' : ''}`} />
                  <span>{resettingStats ? 'Đang xóa...' : 'Đặt lại thống kê'}</span>
                </button>
              </div>
            </div>

            {/* 4 Summary KPI Cards */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
              {/* Total Tokens */}
              <div className="p-3.5 bg-white rounded-xl border border-slate-200/80 shadow-2xs space-y-1.5">
                <div className="flex items-center justify-between text-slate-500">
                  <span className="text-[11px] font-medium">Tổng Token Đã Dùng</span>
                  <div className="w-6 h-6 rounded-lg bg-indigo-50 text-indigo-600 flex items-center justify-center">
                    <Coins className="w-3.5 h-3.5" />
                  </div>
                </div>
                <div className="text-xl font-extrabold text-slate-900 font-mono tracking-tight">
                  {(tokenStats?.totalTokens ?? 0).toLocaleString('vi-VN')}
                </div>
                <div className="text-[10px] text-slate-500 flex items-center justify-between pt-1 border-t border-slate-100">
                  <span title="Prompt (Đầu vào)">In: {(tokenStats?.totalPromptTokens ?? 0).toLocaleString('vi-VN')}</span>
                  <span className="text-slate-300">•</span>
                  <span title="Output (Đầu ra)">Out: {(tokenStats?.totalOutputTokens ?? 0).toLocaleString('vi-VN')}</span>
                </div>
              </div>

              {/* Total Requests */}
              <div className="p-3.5 bg-white rounded-xl border border-slate-200/80 shadow-2xs space-y-1.5">
                <div className="flex items-center justify-between text-slate-500">
                  <span className="text-[11px] font-medium">Lượt Yêu Cầu Phục Vụ</span>
                  <div className="w-6 h-6 rounded-lg bg-emerald-50 text-emerald-600 flex items-center justify-center">
                    <Activity className="w-3.5 h-3.5" />
                  </div>
                </div>
                <div className="text-xl font-extrabold text-emerald-900 font-mono tracking-tight">
                  {(tokenStats?.totalRequests ?? 0).toLocaleString('vi-VN')}
                </div>
                <div className="text-[10px] text-slate-500 flex items-center justify-between pt-1 border-t border-slate-100">
                  <span className="text-emerald-700 font-medium">✓ {(tokenStats?.totalSuccessRequests ?? 0).toLocaleString('vi-VN')} thành công</span>
                  {tokenStats?.totalErrorRequests ? (
                    <span className="text-red-600 font-medium">⚠ {tokenStats.totalErrorRequests} lỗi</span>
                  ) : (
                    <span className="text-slate-400">0 lỗi</span>
                  )}
                </div>
              </div>

              {/* Average Tokens per request */}
              <div className="p-3.5 bg-white rounded-xl border border-slate-200/80 shadow-2xs space-y-1.5">
                <div className="flex items-center justify-between text-slate-500">
                  <span className="text-[11px] font-medium">Token TB / Lượt Hỏi</span>
                  <div className="w-6 h-6 rounded-lg bg-sky-50 text-sky-600 flex items-center justify-center">
                    <TrendingUp className="w-3.5 h-3.5" />
                  </div>
                </div>
                <div className="text-xl font-extrabold text-sky-900 font-mono tracking-tight">
                  {(tokenStats?.avgTokensPerRequest ?? 0).toLocaleString('vi-VN')}
                </div>
                <div className="text-[10px] text-slate-500 pt-1 border-t border-slate-100 truncate">
                  ~{Math.round((tokenStats?.avgTokensPerRequest ?? 0) * 0.75)} từ ngữ tiếng Việt
                </div>
              </div>

              {/* Pool Health */}
              <div className="p-3.5 bg-white rounded-xl border border-slate-200/80 shadow-2xs space-y-1.5">
                <div className="flex items-center justify-between text-slate-500">
                  <span className="text-[11px] font-medium">Trạng Thái API Keys</span>
                  <div className="w-6 h-6 rounded-lg bg-teal-50 text-teal-600 flex items-center justify-center">
                    <Layers className="w-3.5 h-3.5" />
                  </div>
                </div>
                <div className="text-xl font-extrabold text-teal-900 font-mono tracking-tight">
                  {activeKeyCount} <span className="text-xs font-normal text-slate-500">/ {keyCount} sẵn sàng</span>
                </div>
                <div className="text-[10px] text-slate-500 pt-1 border-t border-slate-100">
                  {isLiveAiConfigured ? 'Hoạt động liên tục (Failover)' : 'Chế độ giả lập (Mock)'}
                </div>
              </div>
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

          {/* Provider Mode Selection Switcher */}
          <div className="p-1.5 bg-slate-100/90 rounded-2xl border border-slate-200/80 flex flex-col sm:flex-row gap-1.5">
            <button
              type="button"
              onClick={() => setProviderType('google_official')}
              className={`flex-1 py-2.5 px-4 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-2 cursor-pointer ${
                providerType === 'google_official'
                  ? 'bg-white text-[#0f2942] shadow-xs border border-slate-200/80 ring-1 ring-amber-500/20'
                  : 'text-slate-600 hover:text-slate-900 hover:bg-white/50'
              }`}
            >
              <Sparkles className="w-4 h-4 text-amber-600 shrink-0" />
              <span>1. Google Gemini Chính Thống (AI Studio)</span>
              {providerType === 'google_official' && (
                <span className="w-2 h-2 rounded-full bg-amber-500 shrink-0" />
              )}
            </button>
            <button
              type="button"
              onClick={() => setProviderType('third_party')}
              className={`flex-1 py-2.5 px-4 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-2 cursor-pointer ${
                providerType === 'third_party'
                  ? 'bg-white text-indigo-950 shadow-xs border border-indigo-200 ring-1 ring-indigo-500/30'
                  : 'text-slate-600 hover:text-indigo-900 hover:bg-white/50'
              }`}
            >
              <Globe className="w-4 h-4 text-indigo-600 shrink-0" />
              <span>2. Cổng API Bên Thứ 3 (RouteAPI / OpenRouter)</span>
              {providerType === 'third_party' && (
                <span className="w-2 h-2 rounded-full bg-indigo-600 shrink-0" />
              )}
            </button>
          </div>

          <form onSubmit={handleSaveAiSettings} className="space-y-5">
            {/* BRANCH A: THIRD-PARTY GATEWAY PROVIDER (RouteAPI, OpenRouter, DeepSeek, etc.) */}
            {providerType === 'third_party' ? (
              <div className="space-y-5">
                {/* Third-Party Gateway Info Banner with RouteAPI link */}
                <div className="p-4 bg-indigo-50/80 border border-indigo-200/90 rounded-2xl flex items-start gap-3 shadow-2xs">
                  <Globe className="w-5 h-5 text-indigo-700 shrink-0 mt-0.5" />
                  <div className="text-xs text-indigo-950 space-y-1.5 leading-relaxed">
                    <div className="font-bold flex items-center gap-1.5 text-indigo-900">
                      <span>Tích hợp Cổng API Bên Thứ Ba (RouteAPI / OpenRouter / DeepSeek):</span>
                    </div>
                    <p className="text-[11px] text-indigo-900/90">
                      Hỗ trợ chuẩn <strong>OpenAI-compatible (/chat/completions)</strong>. Quý thầy cô có thể sử dụng các nhà cung cấp như{' '}
                      <a
                        href="https://www.routeapi.ai/docs/en/api-reference/overview/"
                        target="_blank"
                        rel="noreferrer"
                        className="font-bold underline text-indigo-800 hover:text-indigo-950 inline-flex items-center gap-0.5"
                      >
                        RouteAPI.ai <ExternalLink className="w-3 h-3" />
                      </a>
                      , OpenRouter, DeepSeek hoặc proxy trung gian (OneAPI, NewAPI) để tận dụng hạ tầng ổn định, không lo giới hạn hạn ngạch Free Tier cá nhân.
                    </p>
                    <div className="text-[10px] text-indigo-700 font-medium flex flex-wrap items-center gap-2 pt-1 border-t border-indigo-200/60">
                      <span className="bg-white/80 px-2 py-0.5 rounded-md border border-indigo-200">✅ Chuẩn OpenAI Chat Completions</span>
                      <span className="bg-white/80 px-2 py-0.5 rounded-md border border-indigo-200">✅ Bảo lưu 100% Kiểm chứng Trích dẫn RAG</span>
                      <span className="bg-white/80 px-2 py-0.5 rounded-md border border-indigo-200">✅ Hỗ trợ nhiều Bearer Token (Key Pool)</span>
                    </div>
                  </div>
                </div>

                {/* Quick Presets Selection */}
                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-slate-700 flex items-center gap-1.5">
                    <Server className="w-4 h-4 text-slate-500" />
                    Chọn nhanh Nhà cung cấp (Preset Cấu hình):
                  </label>
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                    {thirdPartyPresets.map((p) => {
                      const isSelected = selectedPresetId === p.id || customBaseUrl === p.baseUrl;
                      return (
                        <button
                          key={p.id}
                          type="button"
                          onClick={() => handleSelectPreset(p)}
                          className={`p-2.5 rounded-xl border text-left transition-all cursor-pointer ${
                            isSelected
                              ? 'bg-indigo-50 border-indigo-500 text-indigo-950 font-bold ring-1 ring-indigo-500/30 shadow-2xs'
                              : 'bg-white border-slate-200/80 text-slate-700 hover:border-slate-300 hover:bg-slate-50'
                          }`}
                        >
                          <div className="text-xs font-bold flex items-center justify-between">
                            <span>{p.name}</span>
                            {isSelected && <span className="w-2 h-2 rounded-full bg-indigo-600" />}
                          </div>
                          <div className="text-[10px] text-slate-400 truncate mt-0.5 font-mono">
                            {p.baseUrl}
                          </div>
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* Saved Third-Party Key Pool Card */}
                {hasCustomApiKey && (
                  <div className="p-4 bg-indigo-50/70 border border-indigo-200 rounded-2xl space-y-3 shadow-2xs">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2.5">
                        <div className="w-8 h-8 rounded-lg bg-indigo-100 flex items-center justify-center text-indigo-700 shrink-0">
                          <Network className="w-5 h-5" />
                        </div>
                        <div>
                          <div className="text-xs font-bold text-indigo-950 flex items-center gap-2">
                            Nhóm Token Bên Thứ 3 đang hoạt động ({customKeyCount} Tokens)
                          </div>
                          <div className="text-[11px] text-indigo-700 mt-0.5">
                            Đang kết nối: <code className="font-mono font-semibold">{customBaseUrl}</code>
                          </div>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <button
                          type="button"
                          onClick={() => handleClearAllKeys('third_party')}
                          className="px-2.5 py-1 text-[10px] font-bold text-red-700 bg-red-100/80 hover:bg-red-200 rounded-lg transition-colors flex items-center gap-1 border border-red-200 shadow-2xs cursor-pointer"
                          title="Xóa toàn bộ các Token bên thứ 3 trong pool"
                        >
                          <Trash2 className="w-3 h-3" />
                          <span>Xóa tất cả</span>
                        </button>
                        <span className="px-2.5 py-1 bg-indigo-600 text-white rounded-full text-[10px] font-bold tracking-wide uppercase flex items-center gap-1 shadow-2xs">
                          <span className="w-1.5 h-1.5 rounded-full bg-white animate-pulse" />
                          Gateway Active
                        </span>
                      </div>
                    </div>

                    {/* Custom Key Pool List */}
                    {customKeyPool.length > 0 && (
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2 border-t border-indigo-200/60">
                        {customKeyPool.map((k) => (
                          <div
                            key={k.index}
                            className="p-3.5 rounded-2xl bg-white/95 border border-indigo-200/90 text-xs shadow-2xs space-y-2.5 transition-all hover:border-indigo-300 hover:shadow-xs"
                          >
                            <div className="flex items-center justify-between gap-2">
                              <div className="flex items-center gap-2 min-w-0">
                                <span className="w-5 h-5 rounded-lg bg-indigo-100 text-indigo-800 text-[10px] font-bold flex items-center justify-center shrink-0">
                                  #{k.index}
                                </span>
                                <span className="font-mono text-indigo-950 font-bold truncate text-[11px] bg-slate-50 px-2 py-0.5 rounded-md border border-slate-200/80">
                                  {k.maskedKey}
                                </span>
                              </div>
                              <div className="flex items-center gap-1.5 shrink-0">
                                {k.isCooldown ? (
                                  <span className="text-[10px] bg-amber-100 text-amber-800 px-2 py-0.5 rounded-full font-medium flex items-center gap-1 shrink-0">
                                    <RefreshCw className="w-2.5 h-2.5 animate-spin" /> Làm mát ({k.cooldownSecondsLeft}s)
                                  </span>
                                ) : (
                                  <span className="text-[10px] bg-indigo-100 text-indigo-800 px-2 py-0.5 rounded-full font-bold shrink-0">
                                    Sẵn sàng
                                  </span>
                                )}
                                <button
                                  type="button"
                                  onClick={() => handleDeleteKey(k.index, k.maskedKey, 'third_party')}
                                  title={`Xóa Token #${k.index}`}
                                  className="p-1 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-md transition-colors cursor-pointer"
                                >
                                  <Trash2 className="w-3.5 h-3.5" />
                                </button>
                              </div>
                            </div>

                            {/* Token Consumption */}
                            <div className="grid grid-cols-2 gap-2 pt-1 border-t border-slate-100 text-[11px]">
                              <div className="bg-slate-50/80 rounded-xl p-2 border border-slate-100 space-y-0.5">
                                <div className="text-[10px] text-slate-500 font-medium flex items-center gap-1">
                                  <Coins className="w-3 h-3 text-indigo-500" />
                                  Token Tiêu Thụ
                                </div>
                                <div className="font-mono font-bold text-slate-900 text-xs">
                                  {(k.totalTokens ?? 0).toLocaleString('vi-VN')}
                                </div>
                                <div className="text-[9px] text-slate-400 flex items-center gap-1">
                                  <span>In: {(k.promptTokens ?? 0).toLocaleString('vi-VN')}</span>
                                  <span>•</span>
                                  <span>Out: {(k.outputTokens ?? 0).toLocaleString('vi-VN')}</span>
                                </div>
                              </div>

                              <div className="bg-slate-50/80 rounded-xl p-2 border border-slate-100 space-y-0.5">
                                <div className="text-[10px] text-slate-500 font-medium flex items-center gap-1">
                                  <Activity className="w-3 h-3 text-emerald-500" />
                                  Số Lượt Yêu Cầu
                                </div>
                                <div className="font-mono font-bold text-slate-900 text-xs">
                                  {k.requestCount ?? 0} <span className="text-[10px] font-normal text-slate-500">lượt</span>
                                </div>
                                <div className="text-[9px] text-slate-400 flex items-center gap-1">
                                  <span className="text-emerald-600 font-medium">{k.successCount ?? 0} ok</span>
                                  {k.errorCount ? <span className="text-red-500 font-medium">• {k.errorCount} lỗi</span> : null}
                                </div>
                              </div>
                            </div>

                            <div className="space-y-1 pt-1">
                              <div className="flex items-center justify-between text-[10px] text-slate-500 font-medium">
                                <span>Tỷ lệ tiêu thụ: <strong className="text-indigo-700">{k.percentShare ?? 0}%</strong></span>
                                <span className="flex items-center gap-1 text-[10px] text-slate-400">
                                  <Clock className="w-2.5 h-2.5" />
                                  {formatDateTime(k.lastUsedAt)}
                                </span>
                              </div>
                              <div className="w-full bg-slate-100 rounded-full h-1.5 overflow-hidden">
                                <div
                                  className="bg-linear-to-r from-indigo-500 to-purple-600 h-1.5 rounded-full transition-all duration-500"
                                  style={{ width: `${Math.min(100, Math.max(0, k.percentShare ?? 0))}%` }}
                                />
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )}

                {/* Custom Base URL Field */}
                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-slate-700 flex items-center gap-1.5">
                    <Globe className="w-4 h-4 text-slate-500" />
                    Base URL của Cổng API (OpenAI Compatible Endpoint):
                  </label>
                  <input
                    type="text"
                    placeholder="https://api.routeapi.ai/v1 hoặc https://openrouter.ai/api/v1"
                    value={customBaseUrl}
                    onChange={(e) => setCustomBaseUrl(e.target.value.trim())}
                    className="w-full text-xs p-3 rounded-xl border border-[#e8e2d5] bg-[#fbf9f4] font-mono focus:ring-2 focus:ring-[#0f2942]/20 focus:outline-none"
                  />
                  <p className="text-[11px] text-slate-500">
                    Hệ thống sẽ tự động gọi tới <code className="font-mono font-semibold text-slate-700">{customBaseUrl.replace(/\/+$/, '')}/chat/completions</code>.
                  </p>
                </div>

                {/* Custom API Key / Token input area */}
                <div className="space-y-1.5">
                  <div className="flex items-center justify-between">
                    <label className="text-xs font-bold text-slate-700 flex items-center gap-1.5">
                      <Layers className="w-4 h-4 text-slate-500" />
                      {hasCustomApiKey
                        ? 'Thêm / Thay thế danh sách Token Bên Thứ Ba:'
                        : 'Nhập danh sách Token Bên Thứ Ba:'}
                    </label>
                    <div className="flex items-center gap-2">
                      {customApiKeyInput.trim() && (
                        <span className="text-[11px] font-semibold text-indigo-700 bg-indigo-50 px-2 py-0.5 rounded-md border border-indigo-200">
                          Nhận diện: {customApiKeyInput.split(/[\n,;\r]+/).filter((k) => k.trim().length > 0).length} tokens
                        </span>
                      )}
                      <button
                        type="button"
                        onClick={() => setShowCustomApiKey(!showCustomApiKey)}
                        className="text-[11px] text-slate-500 hover:text-slate-700 flex items-center gap-1 cursor-pointer"
                      >
                        {showCustomApiKey ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                        {showCustomApiKey ? 'Ẩn ký tự' : 'Hiện ký tự'}
                      </button>
                    </div>
                  </div>

                  <div className="relative">
                    <textarea
                      rows={3}
                      placeholder={`Dán một hoặc nhiều API Key / Bearer Token tại đây (Mỗi token một dòng):\nsk-route-xxxx...\nsk-route-yyyy...\nsk-or-v1-zzzz...`}
                      value={customApiKeyInput}
                      onChange={(e) => setCustomApiKeyInput(e.target.value)}
                      className={`w-full text-xs p-3 rounded-xl border border-[#e8e2d5] bg-[#fbf9f4] font-mono focus:ring-2 focus:ring-[#0f2942]/20 focus:outline-none resize-y ${
                        !showCustomApiKey && customApiKeyInput ? 'filter blur-[1.5px] hover:blur-none transition-all' : ''
                      }`}
                    />
                  </div>

                  <p className="text-[11px] text-slate-500">
                    Token được bảo vệ an toàn trên hệ thống và tự động phân bổ tải xoay vòng nếu bạn nhập nhiều token.
                  </p>
                </div>

                {/* Custom Model Selection */}
                <div className="space-y-2">
                  <label className="text-xs font-bold text-slate-700 block">
                    Tên Mô hình Mục tiêu (Target Model ID):
                  </label>

                  {/* Suggested Models Pills for Current Preset */}
                  {(() => {
                    const activePreset = thirdPartyPresets.find(
                      (p) => p.id === selectedPresetId || p.baseUrl === customBaseUrl
                    );
                    const modelsToShow = activePreset?.suggestedModels?.length
                      ? activePreset.suggestedModels.map((m) => ({ id: m.id, label: m.name }))
                      : [
                          { id: 'gemini-3.6-flash', label: 'Gemini 3.6 Flash' },
                          { id: 'gemini-3.5-flash', label: 'Gemini 3.5 Flash' },
                          { id: 'gemini-2.5-flash', label: 'Gemini 2.5 Flash' },
                          { id: 'google/gemini-2.5-flash', label: 'Google/Gemini 2.5' },
                          { id: 'openai/gpt-4o-mini', label: 'GPT-4o Mini' },
                          { id: 'claude-3-5-sonnet', label: 'Claude 3.5 Sonnet' },
                          { id: 'deepseek/deepseek-chat', label: 'DeepSeek Chat' },
                        ];
                    return (
                      <div className="flex flex-wrap gap-2">
                        {modelsToShow.map((sm) => (
                          <button
                            key={sm.id}
                            type="button"
                            onClick={() => setCustomModelName(sm.id)}
                            className={`px-3 py-1.5 rounded-xl text-xs font-mono transition-all cursor-pointer border ${
                              customModelName === sm.id
                                ? 'bg-indigo-600 text-white border-indigo-700 font-bold shadow-2xs'
                                : 'bg-white text-slate-700 border-slate-200 hover:border-indigo-300'
                            }`}
                          >
                            {sm.label} <span className="opacity-70 text-[10px]">({sm.id})</span>
                          </button>
                        ))}
                      </div>
                    );
                  })()}

                  <div className="pt-1">
                    <input
                      type="text"
                      placeholder="Hoặc nhập định danh mô hình tùy ý (vd: google/gemini-2.5-flash, deepseek/deepseek-chat...)"
                      value={customModelName}
                      onChange={(e) => setCustomModelName(e.target.value.trim())}
                      className="w-full text-xs p-3 rounded-xl border border-[#e8e2d5] bg-[#fbf9f4] font-mono focus:ring-2 focus:ring-[#0f2942]/20 focus:outline-none"
                    />
                  </div>
                </div>
              </div>
            ) : (
              /* BRANCH B: GOOGLE OFFICIAL AI STUDIO (Original) */
              <div className="space-y-5">
                {/* Prominent Active Saved Key Pool Card */}
                {hasSavedKey && (
                  <div className="p-4 bg-emerald-50/80 border border-emerald-200 rounded-2xl space-y-3 shadow-2xs">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2.5">
                        <div className="w-8 h-8 rounded-lg bg-emerald-100 flex items-center justify-center text-emerald-700 shrink-0">
                          <CheckCircle2 className="w-5 h-5" />
                        </div>
                        <div>
                          <div className="text-xs font-bold text-emerald-950 flex items-center gap-2">
                            Nhóm Gemini API Key đang hoạt động ({keyCount} Keys)
                          </div>
                          <div className="text-[11px] text-emerald-700 mt-0.5">
                            {activeKeyCount}/{keyCount} key đang sẵn sàng phân bổ tải & dự phòng tự động
                          </div>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <button
                          type="button"
                          onClick={() => handleClearAllKeys('google_official')}
                          className="px-2.5 py-1 text-[10px] font-bold text-red-700 bg-red-100/80 hover:bg-red-200 rounded-lg transition-colors flex items-center gap-1 border border-red-200 shadow-2xs cursor-pointer"
                          title="Xóa toàn bộ các API Key trong pool"
                        >
                          <Trash2 className="w-3 h-3" />
                          <span>Xóa tất cả</span>
                        </button>
                        <span className="px-2.5 py-1 bg-emerald-600 text-white rounded-full text-[10px] font-bold tracking-wide uppercase flex items-center gap-1 shadow-2xs">
                          <span className="w-1.5 h-1.5 rounded-full bg-white animate-pulse" />
                          Pool Active
                        </span>
                      </div>
                    </div>

                    {/* Key Pool List with Per-Key Token Consumption */}
                    {keyPool.length > 0 && (
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2 border-t border-emerald-200/60">
                        {keyPool.map((k) => (
                          <div
                            key={k.index}
                            className="p-3.5 rounded-2xl bg-white/95 border border-emerald-200/90 text-xs shadow-2xs space-y-2.5 transition-all hover:border-emerald-300 hover:shadow-xs"
                          >
                            {/* Header: Index, Masked Key, Status, Delete */}
                            <div className="flex items-center justify-between gap-2">
                              <div className="flex items-center gap-2 min-w-0">
                                <span className="w-5 h-5 rounded-lg bg-emerald-100 text-emerald-800 text-[10px] font-bold flex items-center justify-center shrink-0">
                                  #{k.index}
                                </span>
                                <span className="font-mono text-emerald-950 font-bold truncate text-[11px] bg-slate-50 px-2 py-0.5 rounded-md border border-slate-200/80">
                                  {k.maskedKey}
                                </span>
                              </div>
                              <div className="flex items-center gap-1.5 shrink-0">
                                {k.isCooldown ? (
                                  <span className="text-[10px] bg-amber-100 text-amber-800 px-2 py-0.5 rounded-full font-medium flex items-center gap-1 shrink-0">
                                    <RefreshCw className="w-2.5 h-2.5 animate-spin" /> Làm mát ({k.cooldownSecondsLeft}s)
                                  </span>
                                ) : (
                                  <span className="text-[10px] bg-emerald-100 text-emerald-800 px-2 py-0.5 rounded-full font-bold shrink-0">
                                    Sẵn sàng
                                  </span>
                                )}
                                <button
                                  type="button"
                                  onClick={() => handleDeleteKey(k.index, k.maskedKey, 'google_official')}
                                  title={`Xóa API Key #${k.index}`}
                                  className="p-1 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-md transition-colors cursor-pointer"
                                >
                                  <Trash2 className="w-3.5 h-3.5" />
                                </button>
                              </div>
                            </div>

                            {/* Token Consumption & Usage Stats for this Key */}
                            <div className="grid grid-cols-2 gap-2 pt-1 border-t border-slate-100 text-[11px]">
                              <div className="bg-slate-50/80 rounded-xl p-2 border border-slate-100 space-y-0.5">
                                <div className="text-[10px] text-slate-500 font-medium flex items-center gap-1">
                                  <Coins className="w-3 h-3 text-indigo-500" />
                                  Token Tiêu Thụ
                                </div>
                                <div className="font-mono font-bold text-slate-900 text-xs">
                                  {(k.totalTokens ?? 0).toLocaleString('vi-VN')}
                                </div>
                                <div className="text-[9px] text-slate-400 flex items-center gap-1">
                                  <span>In: {(k.promptTokens ?? 0).toLocaleString('vi-VN')}</span>
                                  <span>•</span>
                                  <span>Out: {(k.outputTokens ?? 0).toLocaleString('vi-VN')}</span>
                                </div>
                              </div>

                              <div className="bg-slate-50/80 rounded-xl p-2 border border-slate-100 space-y-0.5">
                                <div className="text-[10px] text-slate-500 font-medium flex items-center gap-1">
                                  <Activity className="w-3 h-3 text-emerald-500" />
                                  Số Lượt Yêu Cầu
                                </div>
                                <div className="font-mono font-bold text-slate-900 text-xs">
                                  {k.requestCount ?? 0} <span className="text-[10px] font-normal text-slate-500">lượt</span>
                                </div>
                                <div className="text-[9px] text-slate-400 flex items-center gap-1">
                                  <span className="text-emerald-600 font-medium">{k.successCount ?? 0} ok</span>
                                  {k.errorCount ? <span className="text-red-500 font-medium">• {k.errorCount} lỗi</span> : null}
                                </div>
                              </div>
                            </div>

                            {/* Load share percentage & Last used at */}
                            <div className="space-y-1 pt-1">
                              <div className="flex items-center justify-between text-[10px] text-slate-500 font-medium">
                                <span>Tỷ lệ tiêu thụ: <strong className="text-emerald-700">{k.percentShare ?? 0}%</strong></span>
                                <span className="flex items-center gap-1 text-[10px] text-slate-400">
                                  <Clock className="w-2.5 h-2.5" />
                                  {formatDateTime(k.lastUsedAt)}
                                </span>
                              </div>
                              <div className="w-full bg-slate-100 rounded-full h-1.5 overflow-hidden">
                                <div
                                  className="bg-linear-to-r from-emerald-500 to-teal-600 h-1.5 rounded-full transition-all duration-500"
                                  style={{ width: `${Math.min(100, Math.max(0, k.percentShare ?? 0))}%` }}
                                />
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )}

                {/* Google ToS & Architecture Best Practices Section */}
                <div className="space-y-3">
                  <div className="p-4 bg-amber-50/90 border border-amber-200/90 rounded-2xl flex items-start gap-3 shadow-2xs">
                    <ShieldAlert className="w-5 h-5 text-amber-700 shrink-0 mt-0.5" />
                    <div className="text-xs text-amber-950 space-y-1 leading-relaxed">
                      <div className="font-bold flex items-center gap-1.5 text-amber-900">
                        Lưu ý về Chính sách Google (ToS Compliance) & Khuyến nghị vận hành chuẩn:
                      </div>
                      <p className="text-[11px] text-amber-900/90">
                        Việc tạo nhiều tài khoản Google khác nhau để thu thập API Key miễn phí (Free Tier) vi phạm điều khoản dịch vụ của Google về hành vi lách hạn ngạch (<em>circumvent usage limits</em>). Hệ thống bảo vệ của Google có thể giám sát dải IP, thiết bị và lưu lượng truy cập để khóa đồng loạt quyền truy cập API (lỗi 403 ToS disabled).
                      </p>
                      <p className="text-[11px] text-amber-900 font-semibold pt-1">
                        👉 <strong>Giải pháp chuẩn (Best Practice):</strong> Sử dụng 1 tài khoản Google chính thống kích hoạt thanh toán Pay-as-you-go HOẶC chuyển sang dùng Cổng API Bên Thứ 3 (RouteAPI / OpenRouter) ở tab bên cạnh để đảm bảo ổn định lâu dài.
                      </p>
                    </div>
                  </div>

                  {/* Architecture 2-Pillars Cards: Model Fallback + Backoff Queue */}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    {/* Pillar 1: Model Fallback Cascade */}
                    <div className="p-3.5 bg-sky-50/80 border border-sky-200/80 rounded-2xl text-xs space-y-2 shadow-2xs">
                      <div className="flex items-center gap-2 text-sky-950 font-bold">
                        <Zap className="w-4 h-4 text-sky-600" />
                        <span>A. Luân chuyển Cấp độ Mô hình (Model Fallback)</span>
                      </div>
                      <p className="text-[11px] text-sky-900/85 leading-relaxed">
                        Mỗi mô hình trên Google AI Studio có hạn mức RPM/TPM độc lập. Khi mô hình phân tích chuyên sâu gặp lỗi quá tải (429/503), hệ thống tự động hạ cấp tầng mô hình nhẹ hơn trên cùng API Key:
                      </p>
                      <div className="flex flex-wrap items-center gap-1.5 pt-1 text-[10px] font-mono font-bold text-sky-950">
                        <span className="bg-white px-2 py-0.5 rounded-md border border-sky-200 shadow-2xs">gemini-3.8-flash</span>
                        <ArrowRight className="w-3 h-3 text-sky-400" />
                        <span className="bg-white px-2 py-0.5 rounded-md border border-sky-200 shadow-2xs">gemini-3.6-flash</span>
                        <ArrowRight className="w-3 h-3 text-sky-400" />
                        <span className="bg-white px-2 py-0.5 rounded-md border border-sky-200 shadow-2xs">gemini-2.5-flash</span>
                        <ArrowRight className="w-3 h-3 text-sky-400" />
                        <span className="bg-white px-2 py-0.5 rounded-md border border-sky-200 shadow-2xs text-emerald-800">2.5-flash-lite</span>
                      </div>
                    </div>

                    {/* Pillar 2: Adaptive Backoff & Queue Throttling */}
                    <div className="p-3.5 bg-teal-50/80 border border-teal-200/80 rounded-2xl text-xs space-y-2 shadow-2xs">
                      <div className="flex items-center gap-2 text-teal-950 font-bold">
                        <Clock className="w-4 h-4 text-teal-600" />
                        <span>B. Hàng đợi Điều tiết & Thử lại (Backoff & Queue)</span>
                      </div>
                      <p className="text-[11px] text-teal-900/85 leading-relaxed">
                        Hạn mức Free Tier của Google phục hồi liên tục theo từng phút (15 RPM). Hệ thống tích hợp hàng đợi giãn cách tối thiểu 350ms và tự động thử lại sau 2–2.8 giây (kèm Jitter ngẫu nhiên) khi chạm ngưỡng phút, giúp học sinh không bao giờ bị đứt gãy câu hỏi.
                      </p>
                      <div className="flex items-center gap-2 pt-1 text-[10px] text-teal-800 font-medium">
                        <span className="bg-white px-2 py-0.5 rounded-md border border-teal-200 shadow-2xs">Giãn cách: 350ms</span>
                        <span>•</span>
                        <span className="bg-white px-2 py-0.5 rounded-md border border-teal-200 shadow-2xs">Thử lại: 2.0s - 2.8s Backoff</span>
                        <span>•</span>
                        <span className="bg-white px-2 py-0.5 rounded-md border border-teal-200 shadow-2xs">Chuyển Key: 60s làm mát</span>
                      </div>
                    </div>
                  </div>
                </div>

                {/* API Key input area */}
                <div className="space-y-1.5">
                  <div className="flex items-center justify-between">
                    <label className="text-xs font-bold text-slate-700 flex items-center gap-1.5">
                      <Layers className="w-4 h-4 text-slate-500" />
                      {hasSavedKey
                        ? 'Thêm / Thay thế danh sách Google Gemini API Keys:'
                        : 'Nhập danh sách Google Gemini API Keys:'}
                    </label>
                    <div className="flex items-center gap-2">
                      {apiKeyInput.trim() && (
                        <span className="text-[11px] font-semibold text-amber-700 bg-amber-50 px-2 py-0.5 rounded-md border border-amber-200">
                          Nhận diện: {apiKeyInput.split(/[\n,;\r]+/).filter((k) => k.trim().length > 0).length} keys
                        </span>
                      )}
                      <button
                        type="button"
                        onClick={() => setShowApiKey(!showApiKey)}
                        className="text-[11px] text-slate-500 hover:text-slate-700 flex items-center gap-1 cursor-pointer"
                      >
                        {showApiKey ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                        {showApiKey ? 'Ẩn ký tự' : 'Hiện ký tự'}
                      </button>
                    </div>
                  </div>

                  <div className="relative">
                    <textarea
                      rows={3}
                      placeholder={`Dán một hoặc nhiều API Key tại đây (Mỗi key một dòng hoặc cách nhau bởi dấu phẩy):\nAIzaSyA...\nAIzaSyB...\nAIzaSyC...`}
                      value={apiKeyInput}
                      onChange={(e) => setApiKeyInput(e.target.value)}
                      className={`w-full text-xs p-3 rounded-xl border border-[#e8e2d5] bg-[#fbf9f4] font-mono focus:ring-2 focus:ring-[#0f2942]/20 focus:outline-none resize-y ${
                        !showApiKey && apiKeyInput ? 'filter blur-[1.5px] hover:blur-none transition-all' : ''
                      }`}
                    />
                  </div>

                  <p className="text-[11px] text-slate-500">
                    Gợi ý: Quý thầy cô có thể tạo API Key từ các tài khoản Google tại{' '}
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
                                  <span
                                    className={`text-[10px] px-2 py-0.2 rounded-full font-semibold ${
                                      m.badge === 'Khuyên dùng'
                                        ? 'bg-amber-100 text-amber-800 border border-amber-200'
                                        : 'bg-indigo-100 text-indigo-800 border border-indigo-200'
                                    }`}
                                  >
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
              </div>
            )}

            {/* Test Connection Results Card with Per-Key Diagnostics */}
            {testResult && (
              <div
                className={`p-4 rounded-2xl text-xs border space-y-3 shadow-2xs ${
                  testResult.success
                    ? 'bg-emerald-50/70 border-emerald-200 text-emerald-950'
                    : 'bg-red-50/70 border-red-200 text-red-900'
                }`}
              >
                <div className="flex items-center justify-between font-bold">
                  <span className="flex items-center gap-2">
                    {testResult.success ? (
                      <CheckCircle2 className="w-5 h-5 text-emerald-700 shrink-0" />
                    ) : (
                      <AlertCircle className="w-5 h-5 text-red-600 shrink-0" />
                    )}
                    <span>
                      {testResult.success ? 'Kiểm tra kết nối thành công!' : 'Kiểm tra kết nối thất bại!'}
                    </span>
                  </span>
                  {testResult.responseTimeMs && (
                    <span className="font-mono text-[10px] text-slate-600 bg-white/80 px-2 py-0.5 rounded-md border border-slate-200">
                      Độ trễ TB: {testResult.responseTimeMs}ms
                    </span>
                  )}
                </div>

                <p className="text-[12px] leading-relaxed">{testResult.message}</p>

                {/* Per-Key Test Diagnostic Breakdown */}
                {testResult.results && testResult.results.length > 0 && (
                  <div className="space-y-1.5 pt-2 border-t border-emerald-200/60">
                    <div className="text-[11px] font-bold text-slate-700 mb-1">
                      Chi tiết trạng thái từng API Key ({testResult.workingKeys}/{testResult.totalKeys} sẵn sàng):
                    </div>
                    {testResult.results.map((r) => (
                      <div
                        key={r.index}
                        className={`p-2 rounded-xl flex items-center justify-between text-xs border ${
                          r.success
                            ? 'bg-white border-emerald-200 text-slate-800'
                            : 'bg-red-50 border-red-200 text-red-800'
                        }`}
                      >
                        <div className="flex items-center gap-2 min-w-0">
                          <span
                            className={`w-5 h-5 rounded-full text-[10px] font-bold flex items-center justify-center shrink-0 ${
                              r.success ? 'bg-emerald-100 text-emerald-800' : 'bg-red-100 text-red-800'
                            }`}
                          >
                            #{r.index}
                          </span>
                          <span className="font-mono font-semibold text-[11px]">{r.maskedKey}</span>
                          <span className="text-[11px] text-slate-500 truncate hidden sm:inline">
                            - {r.message}
                          </span>
                        </div>
                        <div className="flex items-center gap-2 shrink-0">
                          {r.responseTimeMs && (
                            <span className="font-mono text-[10px] text-slate-500">
                              {r.responseTimeMs}ms
                            </span>
                          )}
                          <span
                            className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                              r.status === 'ready'
                                ? 'bg-emerald-100 text-emerald-800'
                                : r.status === 'quota_exceeded'
                                ? 'bg-amber-100 text-amber-800'
                                : 'bg-red-100 text-red-800'
                            }`}
                          >
                            {r.status === 'ready'
                              ? 'Sẵn sàng'
                              : r.status === 'quota_exceeded'
                              ? 'Hết Quota (429)'
                              : 'Lỗi'}
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* Action buttons */}
            <div className="flex items-center justify-between pt-3 border-t border-[#e8e2d5]">
              <button
                type="button"
                onClick={handleTestAiConnection}
                disabled={testResult?.loading}
                className="px-4 py-2.5 rounded-xl border border-[#0f2942] text-[#0f2942] hover:bg-slate-50 text-xs font-semibold flex items-center gap-1.5 disabled:opacity-50 cursor-pointer"
              >
                {testResult?.loading ? (
                  <>
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    {providerType === 'third_party' ? 'Đang ping RouteAPI / Cổng thứ 3...' : 'Đang ping kiểm tra các API Key...'}
                  </>
                ) : (
                  <>
                    {providerType === 'third_party' ? (
                      <Globe className="w-3.5 h-3.5 text-indigo-600" />
                    ) : (
                      <Sparkles className="w-3.5 h-3.5 text-amber-600" />
                    )}
                    {providerType === 'third_party' ? 'Kiểm tra kết nối Cổng Thứ 3' : 'Kiểm tra kết nối toàn bộ Keys'}
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
