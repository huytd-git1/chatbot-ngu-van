import React, { useState, useEffect } from 'react';
import {
  Power, Settings, History, Sparkles,
  CheckCircle2, AlertCircle, Eye, EyeOff, Loader2, Cpu,
  Layers, RefreshCw, Zap, ShieldCheck,
  Trash2, Users, GraduationCap, Plus, BookOpen, Lock, Unlock, KeyRound, X, Award
} from 'lucide-react';
import { apiRequest } from '../api/client.js';

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
  const [apiKeyInput, setApiKeyInput] = useState('');
  const [showApiKey, setShowApiKey] = useState(false);
  const [maskedApiKey, setMaskedApiKey] = useState('');
  const [hasSavedKey, setHasSavedKey] = useState(false);
  const [keyCount, setKeyCount] = useState(0);
  const [activeKeyCount, setActiveKeyCount] = useState(0);
  const [keyPool, setKeyPool] = useState<Array<{
    index: number;
    maskedKey: string;
    isCooldown: boolean;
    cooldownSecondsLeft: number;
  }>>([]);
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
      setMaskedApiKey(data.maskedApiKey || '');
      setHasSavedKey(!!data.hasApiKey);
      setKeyCount(data.keyCount || 0);
      setActiveKeyCount(data.activeKeyCount || 0);
      setKeyPool(data.keyPool || []);
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
        message: err.message || 'Không thể kết nối tới Google Gemini API.',
      });
    }
  };

  const handleDeleteKey = async (index: number, maskedKey: string) => {
    if (!confirm(`Bạn có chắc chắn muốn xóa API Key #${index} (${maskedKey}) khỏi hệ thống không?`)) return;
    try {
      const res = await apiRequest(`/api/admin/ai-settings/keys/${index}`, { method: 'DELETE' });
      alert(res.message);
      loadAiSettings();
      loadSettings();
    } catch (err: any) {
      alert(err.message);
    }
  };

  const handleClearAllKeys = async () => {
    if (!confirm('Bạn có chắc chắn muốn XÓA TOÀN BỘ Google Gemini API Keys không?\n\nHệ thống sẽ chuyển về chế độ Giả lập kiểm thử (Mock Mode) cho đến khi có Key mới.')) return;
    try {
      const res = await apiRequest('/api/admin/ai-settings/keys', { method: 'DELETE' });
      alert(res.message);
      loadAiSettings();
      loadSettings();
    } catch (err: any) {
      alert(err.message);
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
                      onClick={handleClearAllKeys}
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

                {/* Key Pool List Badges */}
                {keyPool.length > 0 && (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 pt-1 border-t border-emerald-200/60">
                    {keyPool.map((k) => (
                      <div
                        key={k.index}
                        className="flex items-center justify-between p-2 rounded-xl bg-white/90 border border-emerald-200/80 text-xs shadow-2xs gap-2"
                      >
                        <div className="flex items-center gap-2 min-w-0">
                          <span className="w-5 h-5 rounded-full bg-emerald-100 text-emerald-800 text-[10px] font-bold flex items-center justify-center shrink-0">
                            #{k.index}
                          </span>
                          <span className="font-mono text-emerald-950 font-semibold truncate text-[11px]">
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
                            onClick={() => handleDeleteKey(k.index, k.maskedKey)}
                            title={`Xóa API Key #${k.index}`}
                            className="p-1 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-md transition-colors cursor-pointer"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* Smart Failover Explanation Banner */}
            <div className="p-3.5 bg-sky-50 border border-sky-200/80 rounded-xl flex items-start gap-3">
              <Zap className="w-4 h-4 text-sky-600 shrink-0 mt-0.5" />
              <div className="text-[11px] text-sky-900 leading-relaxed">
                <span className="font-bold">Cơ chế Tự động Dự phòng & Cân bằng tải (Failover Pool):</span> Hệ thống tự động phân bổ lượt hỏi đáp xoay vòng (Round-Robin) giữa các API Key. Khi một Key bất kỳ bị cạn Quota (lỗi 429) hoặc máy chủ Google bị quá tải/trễ mạng (lỗi 503), hệ thống tự động tạm dừng key đó trong 60 giây và ngay lập tức chuyển sang Key dự phòng kế tiếp để học sinh không bao giờ bị gián đoạn.
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
                    className="text-[11px] text-slate-500 hover:text-slate-700 flex items-center gap-1"
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
                Gợi ý: Quý thầy cô có thể tạo nhiều API Key miễn phí từ các tài khoản Google khác nhau tại{' '}
                <a
                  href="https://aistudio.google.com/app/apikey"
                  target="_blank"
                  rel="noreferrer"
                  className="text-amber-700 underline font-semibold"
                >
                  Google AI Studio
                </a>{' '}
                và dán tất cả vào đây để tăng hạn mức hỏi đáp lên gấp nhiều lần.
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
                className="px-4 py-2.5 rounded-xl border border-[#0f2942] text-[#0f2942] hover:bg-slate-50 text-xs font-semibold flex items-center gap-1.5 disabled:opacity-50"
              >
                {testResult?.loading ? (
                  <>
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    Đang ping kiểm tra các API Key...
                  </>
                ) : (
                  <>
                    <Sparkles className="w-3.5 h-3.5 text-amber-600" />
                    Kiểm tra kết nối toàn bộ Keys
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
