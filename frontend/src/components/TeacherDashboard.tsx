import React, { useState, useEffect } from 'react';
import {
  Download, RefreshCw, Lock, Unlock,
  KeyRound, Shield, FileText, CheckCircle2, AlertCircle, Trash2, Award, Calendar
} from 'lucide-react';
import type { ClassItem, StudentItem, Work, DocumentItem } from '../types.js';
import { apiRequest } from '../api/client.js';

export const TeacherDashboard: React.FC = () => {
  const [activeTab, setActiveTab] = useState<'overview' | 'classes' | 'csv' | 'works' | 'settings'>('overview');

  // Overview stats
  const [stats, setStats] = useState<any>(null);

  // Classes & Students
  const [classes, setClasses] = useState<ClassItem[]>([]);
  const [selectedClassId, setSelectedClassId] = useState<string>('');
  const [students, setStudents] = useState<StudentItem[]>([]);
  const [newClassName, setNewClassName] = useState('');
  const [newClassGrade, setNewClassGrade] = useState(9);

  // Single student creation
  const [newStudentCode, setNewStudentCode] = useState('');
  const [newStudentName, setNewStudentName] = useState('');
  const [newStudentPass, setNewStudentPass] = useState('MatKhau123');

  // CSV
  const [csvFile, setCsvFile] = useState<File | null>(null);
  const [csvPreview, setCsvPreview] = useState<any>(null);
  const [csvLoading, setCsvLoading] = useState(false);

  // Works & Documents
  const [works, setWorks] = useState<Work[]>([]);
  const [selectedWorkId, setSelectedWorkId] = useState<string>('');
  const [documents, setDocuments] = useState<DocumentItem[]>([]);
  const [newWorkTitle, setNewWorkTitle] = useState('');
  const [newWorkAuthor, setNewWorkAuthor] = useState('');
  const [newWorkGrade, setNewWorkGrade] = useState(9);
  const [newWorkDesc, setNewWorkDesc] = useState('');

  // Doc upload
  const [docTitle, setDocTitle] = useState('');
  const [docType, setDocType] = useState<'text_primary' | 'analysis' | 'lesson_plan' | 'qa_guide'>('analysis');
  const [docFile, setDocFile] = useState<File | null>(null);
  const [isUploadingDoc, setIsUploadingDoc] = useState(false);

  // TOTP 2FA
  const [totpQr, setTotpQr] = useState<string | null>(null);
  const [totpSecret, setTotpSecret] = useState<string | null>(null);
  const [totpRecoveryCodes, setTotpRecoveryCodes] = useState<string[]>([]);
  const [totpConfirmCode, setTotpConfirmCode] = useState('');

  // Initial load
  useEffect(() => {
    loadOverview();
    loadClasses();
    loadWorks();
  }, []);

  useEffect(() => {
    if (selectedClassId) {
      loadStudents(selectedClassId);
    }
  }, [selectedClassId]);

  useEffect(() => {
    if (selectedWorkId) {
      loadDocuments(selectedWorkId);
    }
  }, [selectedWorkId]);

  const loadOverview = async () => {
    try {
      const data = await apiRequest('/api/teacher/overview');
      setStats(data);
    } catch {}
  };

  const loadClasses = async () => {
    try {
      const data = await apiRequest<{ classes: ClassItem[] }>('/api/teacher/classes');
      setClasses(data.classes || []);
      if (data.classes && data.classes.length > 0 && !selectedClassId) {
        setSelectedClassId(data.classes[0].id);
      }
    } catch {}
  };

  const loadStudents = async (cId: string) => {
    try {
      const data = await apiRequest<{ students: StudentItem[] }>(`/api/teacher/classes/${cId}/students`);
      setStudents(data.students || []);
    } catch {}
  };

  const loadWorks = async () => {
    try {
      const data = await apiRequest<{ works: Work[] }>('/api/teacher/works');
      setWorks(data.works || []);
      if (data.works && data.works.length > 0 && !selectedWorkId) {
        setSelectedWorkId(data.works[0].id);
      }
    } catch {}
  };

  const loadDocuments = async (wId: string) => {
    try {
      const data = await apiRequest<{ documents: DocumentItem[] }>(`/api/teacher/works/${wId}/documents`);
      setDocuments(data.documents || []);
    } catch {}
  };

  const handleCreateClass = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newClassName.trim()) return;
    try {
      await apiRequest('/api/teacher/classes', {
        method: 'POST',
        body: JSON.stringify({ name: newClassName, grade: newClassGrade }),
      });
      setNewClassName('');
      loadClasses();
      alert('Đã tạo lớp học thành công.');
    } catch (err: any) {
      alert(err.message);
    }
  };

  const handleCreateStudent = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedClassId || !newStudentCode.trim() || !newStudentName.trim()) return;
    try {
      await apiRequest(`/api/teacher/classes/${selectedClassId}/import-csv`, {
        method: 'POST',
        body: JSON.stringify({
          rows: [
            {
              lineNumber: 1,
              studentCode: newStudentCode.trim(),
              fullName: newStudentName.trim(),
              password: newStudentPass.trim() || 'MatKhau123',
              isValid: true,
              errors: [],
            },
          ],
        }),
      });
      setNewStudentCode('');
      setNewStudentName('');
      loadStudents(selectedClassId);
      alert('Thêm học sinh thành công.');
    } catch (err: any) {
      alert(err.message);
    }
  };

  const handleToggleLock = async (studentId: string, currentActive: boolean) => {
    try {
      await apiRequest(`/api/teacher/students/${studentId}/lock`, {
        method: 'PUT',
        body: JSON.stringify({ isActive: !currentActive }),
      });
      loadStudents(selectedClassId);
    } catch (err: any) {
      alert(err.message);
    }
  };

  const handleResetPassword = async (studentId: string) => {
    const tempPass = prompt('Nhập mật khẩu tạm thời mới cho học sinh (tối thiểu 6 ký tự):', 'MatKhauMoi123');
    if (!tempPass) return;
    try {
      const res = await apiRequest(`/api/teacher/students/${studentId}/reset-password`, {
        method: 'POST',
        body: JSON.stringify({ tempPassword: tempPass }),
      });
      alert(res.message);
      loadStudents(selectedClassId);
    } catch (err: any) {
      alert(err.message);
    }
  };

  const handleGrantQuota = async (studentId: string) => {
    const countStr = prompt('Nhập số lượt hỏi muốn cấp thêm cho học sinh hôm nay:', '5');
    if (!countStr) return;
    const count = parseInt(countStr, 10);
    if (isNaN(count) || count <= 0) return;
    try {
      const res = await apiRequest(`/api/teacher/students/${studentId}/grant-quota`, {
        method: 'POST',
        body: JSON.stringify({ extraCount: count }),
      });
      alert(res.message);
      loadStudents(selectedClassId);
    } catch (err: any) {
      alert(err.message);
    }
  };

  const handleCsvPreview = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!csvFile || !selectedClassId) return;
    setCsvLoading(true);
    try {
      const formData = new FormData();
      formData.append('file', csvFile);
      const res = await apiRequest(`/api/teacher/classes/${selectedClassId}/preview-csv`, {
        method: 'POST',
        body: formData,
      });
      setCsvPreview(res);
    } catch (err: any) {
      alert(err.message);
    } finally {
      setCsvLoading(false);
    }
  };

  const handleExecuteCsv = async () => {
    if (!csvPreview || !selectedClassId) return;
    try {
      const res = await apiRequest(`/api/teacher/classes/${selectedClassId}/import-csv`, {
        method: 'POST',
        body: JSON.stringify({ rows: csvPreview.rows }),
      });
      alert(res.message);
      setCsvFile(null);
      setCsvPreview(null);
      loadStudents(selectedClassId);
      setActiveTab('classes');
    } catch (err: any) {
      alert(err.message);
    }
  };

  const handleCreateWork = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newWorkTitle.trim() || !newWorkAuthor.trim()) return;
    try {
      await apiRequest('/api/teacher/works', {
        method: 'POST',
        body: JSON.stringify({
          title: newWorkTitle,
          author: newWorkAuthor,
          grade: newWorkGrade,
          description: newWorkDesc,
          assignedClassIds: [selectedClassId].filter(Boolean),
        }),
      });
      setNewWorkTitle('');
      setNewWorkAuthor('');
      setNewWorkDesc('');
      loadWorks();
      alert('Tạo tác phẩm thành công.');
    } catch (err: any) {
      alert(err.message);
    }
  };

  const handleUploadDoc = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedWorkId || !docFile || !docTitle.trim()) return;
    setIsUploadingDoc(true);
    try {
      const formData = new FormData();
      formData.append('title', docTitle);
      formData.append('docType', docType);
      formData.append('file', docFile);

      const res = await apiRequest(`/api/teacher/works/${selectedWorkId}/documents`, {
        method: 'POST',
        body: formData,
      });
      alert(res.message);
      setDocTitle('');
      setDocFile(null);
      loadDocuments(selectedWorkId);
    } catch (err: any) {
      alert(err.message);
    } finally {
      setIsUploadingDoc(false);
    }
  };

  const handleDeleteDoc = async (docId: string) => {
    if (!confirm('Bạn có chắc chắn muốn xóa tài liệu này khỏi kho RAG?')) return;
    try {
      await apiRequest(`/api/teacher/documents/${docId}`, { method: 'DELETE' });
      loadDocuments(selectedWorkId);
    } catch (err: any) {
      alert(err.message);
    }
  };

  const handleStartTotp = async () => {
    try {
      const data = await apiRequest('/api/auth/totp/setup', { method: 'POST' });
      setTotpQr(data.qrDataUrl);
      setTotpSecret(data.secret);
      setTotpRecoveryCodes(data.recoveryCodes);
    } catch (err: any) {
      alert(err.message);
    }
  };

  const handleConfirmTotp = async () => {
    if (!totpConfirmCode.trim()) return;
    try {
      const res = await apiRequest('/api/auth/totp/confirm', {
        method: 'POST',
        body: JSON.stringify({
          token: totpConfirmCode.trim(),
          recoveryCodes: totpRecoveryCodes,
        }),
      });
      alert(res.message);
      setTotpQr(null);
      setTotpConfirmCode('');
    } catch (err: any) {
      alert(err.message);
    }
  };

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      {/* Tab Navigation */}
      <div className="flex flex-wrap gap-2 mb-6 border-b border-[#e8e2d5] pb-3">
        {[
          { id: 'overview', label: 'Tổng quan' },
          { id: 'classes', label: 'Lớp học & Học sinh' },
          { id: 'csv', label: 'Nhập học sinh CSV' },
          { id: 'works', label: 'Tác phẩm & Tài liệu RAG' },
          { id: 'settings', label: 'Bảo mật & 2FA' },
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

      {/* TAB 1: OVERVIEW */}
      {activeTab === 'overview' && (
        <div className="space-y-6">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="bg-white p-5 rounded-2xl border border-[#e8e2d5] shadow-2xs">
              <span className="text-xs font-semibold text-slate-500 uppercase">Lớp quản lý</span>
              <p className="text-2xl font-bold text-[#0f2942] mt-1">{stats?.totalClasses ?? 0}</p>
            </div>
            <div className="bg-white p-5 rounded-2xl border border-[#e8e2d5] shadow-2xs">
              <span className="text-xs font-semibold text-slate-500 uppercase">Học sinh</span>
              <p className="text-2xl font-bold text-[#0f2942] mt-1">{stats?.totalStudents ?? 0}</p>
            </div>
            <div className="bg-white p-5 rounded-2xl border border-[#e8e2d5] shadow-2xs">
              <span className="text-xs font-semibold text-slate-500 uppercase">Tài liệu sẵn sàng</span>
              <p className="text-2xl font-bold text-emerald-700 mt-1">{stats?.readyDocsCount ?? 0}</p>
            </div>
            <div className="bg-white p-5 rounded-2xl border border-[#e8e2d5] shadow-2xs">
              <span className="text-xs font-semibold text-slate-500 uppercase">Lượt hỏi hôm nay</span>
              <p className="text-2xl font-bold text-amber-700 mt-1">{stats?.todayQuestionsCount ?? 0}</p>
            </div>
          </div>

          {/* 7-day stats */}
          <div className="bg-white p-6 rounded-2xl border border-[#e8e2d5] shadow-2xs">
            <h3 className="text-base font-bold text-[#0f2942] mb-4 flex items-center gap-2">
              <Calendar className="w-5 h-5 text-amber-600" />
              Thống kê lượt hỏi 7 ngày gần nhất
            </h3>
            {stats?.sevenDayStats && stats.sevenDayStats.length > 0 ? (
              <div className="space-y-3">
                {stats.sevenDayStats.map((s: any, idx: number) => (
                  <div key={idx} className="flex items-center justify-between text-xs py-2 border-b border-slate-100 last:border-none">
                    <span className="font-semibold text-slate-700">{s.date_vn}</span>
                    <div className="flex items-center gap-4">
                      <span className="text-emerald-700 font-medium">Thành công: <strong>{s.success_count}</strong></span>
                      <span className="text-amber-700 font-medium">Thiếu nguồn: <strong>{s.no_source_count}</strong></span>
                      <span className="text-red-600 font-medium">Thất bại: <strong>{s.failed_count}</strong></span>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-sm text-slate-400 py-4 text-center">Chưa có dữ liệu thống kê tuần này.</p>
            )}
          </div>
        </div>
      )}

      {/* TAB 2: CLASSES & STUDENTS */}
      {activeTab === 'classes' && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Class list and creator */}
          <div className="bg-white p-5 rounded-2xl border border-[#e8e2d5] shadow-2xs space-y-4">
            <h3 className="text-base font-bold text-[#0f2942]">Danh sách lớp học</h3>
            <div className="space-y-1.5">
              {classes.map((c) => (
                <button
                  key={c.id}
                  onClick={() => setSelectedClassId(c.id)}
                  className={`w-full text-left p-3 rounded-xl border text-sm transition-all flex items-center justify-between ${
                    selectedClassId === c.id
                      ? 'bg-amber-50 border-amber-300 font-bold text-[#0f2942]'
                      : 'bg-white hover:bg-slate-50 border-[#e8e2d5] text-slate-700'
                  }`}
                >
                  <span>{c.name} (Khối {c.grade})</span>
                  <span className="text-xs px-2 py-0.5 rounded-full bg-slate-100 text-slate-600">
                    {c.student_count ?? 0} HS
                  </span>
                </button>
              ))}
            </div>

            <form onSubmit={handleCreateClass} className="pt-4 border-t border-[#e8e2d5] space-y-2">
              <span className="text-xs font-semibold text-slate-600">Tạo lớp mới:</span>
              <input
                type="text"
                placeholder="Tên lớp (e.g. Lớp 9A2)"
                value={newClassName}
                onChange={(e) => setNewClassName(e.target.value)}
                className="w-full text-xs p-2 rounded-lg border border-[#e8e2d5] bg-[#fbf9f4]"
              />
              <div className="flex gap-2">
                <select
                  value={newClassGrade}
                  onChange={(e) => setNewClassGrade(Number(e.target.value))}
                  className="w-1/2 text-xs p-2 rounded-lg border border-[#e8e2d5] bg-[#fbf9f4]"
                >
                  {[6, 7, 8, 9, 10, 11, 12].map((g) => (
                    <option key={g} value={g}>Khối {g}</option>
                  ))}
                </select>
                <button
                  type="submit"
                  className="w-1/2 text-xs font-semibold bg-[#0f2942] text-white rounded-lg py-2 hover:bg-[#1e3a5f]"
                >
                  + Thêm lớp
                </button>
              </div>
            </form>
          </div>

          {/* Student roster */}
          <div className="lg:col-span-2 bg-white p-5 rounded-2xl border border-[#e8e2d5] shadow-2xs space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-base font-bold text-[#0f2942]">
                Học sinh: {classes.find((c) => c.id === selectedClassId)?.name || 'Chưa chọn lớp'}
              </h3>
              <span className="text-xs text-slate-500">{students.length} học sinh</span>
            </div>

            {/* Quick add student */}
            <form onSubmit={handleCreateStudent} className="p-3 rounded-xl bg-[#fbf9f4] border border-[#e8e2d5] grid grid-cols-1 sm:grid-cols-4 gap-2">
              <input
                type="text"
                placeholder="Mã học sinh"
                value={newStudentCode}
                onChange={(e) => setNewStudentCode(e.target.value)}
                className="text-xs p-2 rounded-lg border border-[#e8e2d5] bg-white"
              />
              <input
                type="text"
                placeholder="Họ và tên"
                value={newStudentName}
                onChange={(e) => setNewStudentName(e.target.value)}
                className="text-xs p-2 rounded-lg border border-[#e8e2d5] bg-white"
              />
              <input
                type="text"
                placeholder="Mật khẩu ban đầu"
                value={newStudentPass}
                onChange={(e) => setNewStudentPass(e.target.value)}
                className="text-xs p-2 rounded-lg border border-[#e8e2d5] bg-white"
              />
              <button
                type="submit"
                className="text-xs font-semibold bg-[#0f2942] text-white rounded-lg py-2 hover:bg-[#1e3a5f]"
              >
                + Thêm học sinh
              </button>
            </form>

            {/* Table */}
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead>
                  <tr className="border-b border-[#e8e2d5] text-slate-400 font-semibold">
                    <th className="py-2">Mã HS</th>
                    <th className="py-2">Họ và tên</th>
                    <th className="py-2">Trạng thái</th>
                    <th className="py-2">Hỏi hôm nay</th>
                    <th className="py-2 text-right">Thao tác</th>
                  </tr>
                </thead>
                <tbody>
                  {students.map((s) => (
                    <tr key={s.id} className="border-b border-slate-100 last:border-none hover:bg-slate-50">
                      <td className="py-2.5 font-bold text-[#0f2942]">{s.student_code}</td>
                      <td className="py-2.5">{s.full_name}</td>
                      <td className="py-2.5">
                        <span className={`px-2 py-0.5 rounded-full text-[10px] font-semibold ${
                          s.is_active ? 'bg-emerald-100 text-emerald-800' : 'bg-red-100 text-red-800'
                        }`}>
                          {s.is_active ? 'Hoạt động' : 'Đã khóa'}
                        </span>
                      </td>
                      <td className="py-2.5 font-medium">
                        {s.today_used} lượt {s.today_extra > 0 && <span className="text-amber-700">(+{s.today_extra})</span>}
                      </td>
                      <td className="py-2.5 text-right space-x-1">
                        <button
                          onClick={() => handleGrantQuota(s.id)}
                          title="Cấp thêm lượt hôm nay"
                          className="p-1 rounded hover:bg-amber-100 text-amber-700"
                        >
                          <Award className="w-3.5 h-3.5" />
                        </button>
                        <button
                          onClick={() => handleResetPassword(s.id)}
                          title="Đặt lại mật khẩu tạm"
                          className="p-1 rounded hover:bg-slate-200 text-slate-700"
                        >
                          <KeyRound className="w-3.5 h-3.5" />
                        </button>
                        <button
                          onClick={() => handleToggleLock(s.id, s.is_active)}
                          title={s.is_active ? 'Khóa tài khoản' : 'Mở khóa tài khoản'}
                          className={`p-1 rounded ${s.is_active ? 'hover:bg-red-100 text-red-600' : 'hover:bg-emerald-100 text-emerald-600'}`}
                        >
                          {s.is_active ? <Lock className="w-3.5 h-3.5" /> : <Unlock className="w-3.5 h-3.5" />}
                        </button>
                      </td>
                    </tr>
                  ))}
                  {students.length === 0 && (
                    <tr>
                      <td colSpan={5} className="py-6 text-center text-slate-400">
                        Chưa có học sinh nào trong lớp này. Em hãy thêm học sinh hoặc nhập bằng file CSV.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* TAB 3: CSV IMPORT */}
      {activeTab === 'csv' && (
        <div className="bg-white p-6 rounded-2xl border border-[#e8e2d5] shadow-2xs space-y-6">
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 border-b border-[#e8e2d5] pb-4">
            <div>
              <h3 className="text-base font-bold text-[#0f2942]">Nhập học sinh bằng file CSV</h3>
              <p className="text-xs text-slate-500 mt-0.5">
                Tải file mẫu chuẩn UTF-8, điền danh sách, xem trước lỗi trùng lặp trước khi lưu.
              </p>
            </div>
            <a
              href="/api/teacher/csv-sample"
              download
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold bg-amber-50 text-amber-900 border border-amber-200 hover:bg-amber-100"
            >
              <Download className="w-3.5 h-3.5" />
              Tải file mẫu CSV
            </a>
          </div>

          <form onSubmit={handleCsvPreview} className="flex flex-col sm:flex-row items-center gap-3">
            <select
              value={selectedClassId}
              onChange={(e) => setSelectedClassId(e.target.value)}
              className="text-xs p-2.5 rounded-xl border border-[#e8e2d5] bg-[#fbf9f4] w-full sm:w-60 font-semibold"
            >
              {classes.map((c) => (
                <option key={c.id} value={c.id}>{c.name} (Khối {c.grade})</option>
              ))}
            </select>

            <input
              type="file"
              accept=".csv"
              onChange={(e) => setCsvFile(e.target.files?.[0] || null)}
              className="text-xs file:mr-2 file:py-2 file:px-3 file:rounded-xl file:border-0 file:text-xs file:font-semibold file:bg-amber-100 file:text-amber-900 hover:file:bg-amber-200"
            />

            <button
              type="submit"
              disabled={csvLoading || !csvFile}
              className="px-4 py-2 rounded-xl text-xs font-semibold bg-[#0f2942] text-white hover:bg-[#1e3a5f] disabled:opacity-40"
            >
              {csvLoading ? 'Đang đọc...' : 'Xem trước danh sách'}
            </button>
          </form>

          {/* Preview Table */}
          {csvPreview && (
            <div className="space-y-4 pt-4 border-t border-[#e8e2d5]">
              <div className="flex items-center justify-between text-xs">
                <span>
                  Tổng số dòng: <strong>{csvPreview.totalRows}</strong> | Hợp lệ: <strong className="text-emerald-700">{csvPreview.validRowsCount}</strong> | Lỗi: <strong className="text-red-600">{csvPreview.invalidRowsCount}</strong>
                </span>

                <button
                  onClick={handleExecuteCsv}
                  disabled={csvPreview.validRowsCount === 0}
                  className="px-4 py-2 rounded-xl text-xs font-semibold bg-emerald-700 text-white hover:bg-emerald-800 disabled:opacity-40 shadow-xs"
                >
                  Xác nhận nhập ({csvPreview.validRowsCount} học sinh hợp lệ)
                </button>
              </div>

              <div className="overflow-x-auto max-h-96">
                <table className="w-full text-left text-xs">
                  <thead>
                    <tr className="border-b border-[#e8e2d5] text-slate-400 font-semibold">
                      <th className="py-2">Dòng</th>
                      <th className="py-2">Mã HS</th>
                      <th className="py-2">Họ và tên</th>
                      <th className="py-2">Mật khẩu ban đầu</th>
                      <th className="py-2">Trạng thái & Lỗi</th>
                    </tr>
                  </thead>
                  <tbody>
                    {csvPreview.rows.map((r: any, idx: number) => (
                      <tr key={idx} className={`border-b border-slate-100 ${r.isValid ? 'bg-emerald-50/20' : 'bg-red-50/30'}`}>
                        <td className="py-2 font-mono">{r.lineNumber}</td>
                        <td className="py-2 font-bold">{r.studentCode}</td>
                        <td className="py-2">{r.fullName}</td>
                        <td className="py-2 font-mono">{r.password}</td>
                        <td className="py-2">
                          {r.isValid ? (
                            <span className="text-emerald-700 font-semibold flex items-center gap-1">
                              <CheckCircle2 className="w-3.5 h-3.5" /> Hợp lệ
                            </span>
                          ) : (
                            <span className="text-red-600 font-medium flex items-center gap-1">
                              <AlertCircle className="w-3.5 h-3.5" /> {r.errors.join('; ')}
                            </span>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      )}

      {/* TAB 4: WORKS & DOCUMENTS */}
      {activeTab === 'works' && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Work list & create */}
          <div className="bg-white p-5 rounded-2xl border border-[#e8e2d5] shadow-2xs space-y-4">
            <h3 className="text-base font-bold text-[#0f2942]">Tác phẩm văn học</h3>
            <div className="space-y-1.5">
              {works.map((w) => (
                <button
                  key={w.id}
                  onClick={() => setSelectedWorkId(w.id)}
                  className={`w-full text-left p-3 rounded-xl border text-sm transition-all flex items-center justify-between ${
                    selectedWorkId === w.id
                      ? 'bg-amber-50 border-amber-300 font-bold text-[#0f2942]'
                      : 'bg-white hover:bg-slate-50 border-[#e8e2d5] text-slate-700'
                  }`}
                >
                  <div>
                    <span className="block">{w.title}</span>
                    <span className="text-[11px] text-slate-400 font-normal">{w.author} - Lớp {w.grade}</span>
                  </div>
                  <span className="text-xs px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800">
                    {w.ready_docs ?? 0} file
                  </span>
                </button>
              ))}
            </div>

            <form onSubmit={handleCreateWork} className="pt-4 border-t border-[#e8e2d5] space-y-2">
              <span className="text-xs font-semibold text-slate-600">Thêm tác phẩm mới:</span>
              <input
                type="text"
                placeholder="Tên tác phẩm (e.g. Vợ nhặt)"
                value={newWorkTitle}
                onChange={(e) => setNewWorkTitle(e.target.value)}
                className="w-full text-xs p-2 rounded-lg border border-[#e8e2d5] bg-[#fbf9f4]"
              />
              <input
                type="text"
                placeholder="Tác giả (e.g. Kim Lân)"
                value={newWorkAuthor}
                onChange={(e) => setNewWorkAuthor(e.target.value)}
                className="w-full text-xs p-2 rounded-lg border border-[#e8e2d5] bg-[#fbf9f4]"
              />
              <select
                value={newWorkGrade}
                onChange={(e) => setNewWorkGrade(Number(e.target.value))}
                className="w-full text-xs p-2 rounded-lg border border-[#e8e2d5] bg-[#fbf9f4]"
              >
                {[6, 7, 8, 9, 10, 11, 12].map((g) => (
                  <option key={g} value={g}>Khối {g}</option>
                ))}
              </select>
              <textarea
                rows={2}
                placeholder="Mô tả tác phẩm"
                value={newWorkDesc}
                onChange={(e) => setNewWorkDesc(e.target.value)}
                className="w-full text-xs p-2 rounded-lg border border-[#e8e2d5] bg-[#fbf9f4]"
              />
              <button
                type="submit"
                className="w-full text-xs font-semibold bg-[#0f2942] text-white rounded-lg py-2 hover:bg-[#1e3a5f]"
              >
                + Thêm tác phẩm
              </button>
            </form>
          </div>

          {/* Document list & upload */}
          <div className="lg:col-span-2 bg-white p-5 rounded-2xl border border-[#e8e2d5] shadow-2xs space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-base font-bold text-[#0f2942]">
                Tài liệu RAG: {works.find((w) => w.id === selectedWorkId)?.title || 'Chưa chọn'}
              </h3>
              <button
                onClick={() => selectedWorkId && loadDocuments(selectedWorkId)}
                title="Làm mới trạng thái lập chỉ mục"
                className="p-1 rounded text-slate-500 hover:text-slate-800"
              >
                <RefreshCw className="w-4 h-4" />
              </button>
            </div>

            {/* Upload form */}
            <form onSubmit={handleUploadDoc} className="p-3.5 rounded-xl bg-[#fbf9f4] border border-[#e8e2d5] space-y-2.5">
              <span className="text-xs font-semibold text-[#0f2942]">Tải tài liệu vào Gemini File Search Store:</span>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                <input
                  type="text"
                  placeholder="Tiêu đề tài liệu"
                  value={docTitle}
                  onChange={(e) => setDocTitle(e.target.value)}
                  className="text-xs p-2 rounded-lg border border-[#e8e2d5] bg-white"
                />
                <select
                  value={docType}
                  onChange={(e) => setDocType(e.target.value as any)}
                  className="text-xs p-2 rounded-lg border border-[#e8e2d5] bg-white"
                >
                  <option value="analysis">Tài liệu phân tích chuyên sâu</option>
                  <option value="text_primary">Văn bản tác phẩm</option>
                  <option value="lesson_plan">Giáo án giảng dạy</option>
                  <option value="qa_guide">Câu hỏi và hướng dẫn trả lời</option>
                </select>
              </div>

              <div className="flex items-center gap-2">
                <input
                  type="file"
                  accept=".txt,.md,.pdf,.docx,.csv"
                  onChange={(e) => setDocFile(e.target.files?.[0] || null)}
                  className="text-xs file:mr-2 file:py-1.5 file:px-3 file:rounded-xl file:border-0 file:text-xs file:font-semibold file:bg-amber-100 file:text-amber-900"
                />
                <button
                  type="submit"
                  disabled={isUploadingDoc || !docFile || !docTitle.trim()}
                  className="px-4 py-2 rounded-xl text-xs font-semibold bg-[#0f2942] text-white hover:bg-[#1e3a5f] disabled:opacity-40 shrink-0"
                >
                  {isUploadingDoc ? 'Đang tải & Lập chỉ mục...' : 'Tải lên & Lập chỉ mục RAG'}
                </button>
              </div>
            </form>

            {/* Document list */}
            <div className="space-y-2">
              {documents.map((d) => (
                <div
                  key={d.id}
                  className="p-3 rounded-xl border border-[#e8e2d5] flex items-center justify-between text-xs hover:bg-slate-50/50"
                >
                  <div className="space-y-0.5">
                    <div className="flex items-center gap-2">
                      <FileText className="w-4 h-4 text-slate-500" />
                      <span className="font-bold text-[#0f2942]">{d.title}</span>
                      <span className="text-[10px] px-2 py-0.2 rounded-full bg-slate-100 text-slate-600">
                        {d.doc_type === 'analysis' ? 'Phân tích' : d.doc_type === 'text_primary' ? 'Văn bản gốc' : d.doc_type === 'lesson_plan' ? 'Giáo án' : 'Câu hỏi & đáp'}
                      </span>
                    </div>
                    <span className="text-[11px] text-slate-400">
                      {d.file_name} • {(d.file_size_bytes / 1024).toFixed(1)} KB • Gemini Store: {d.file_search_store_name.split('/').pop()}
                    </span>
                  </div>

                  <div className="flex items-center gap-3">
                    <span className={`px-2 py-0.5 rounded-full text-[10px] font-semibold ${
                      d.status === 'ready'
                        ? 'bg-emerald-100 text-emerald-800'
                        : d.status === 'indexing'
                        ? 'bg-amber-100 text-amber-800 animate-pulse'
                        : 'bg-red-100 text-red-800'
                    }`}>
                      {d.status === 'ready' ? 'Sẵn sàng RAG' : d.status === 'indexing' ? 'Đang index...' : 'Lỗi'}
                    </span>

                    <button
                      onClick={() => handleDeleteDoc(d.id)}
                      title="Xóa tài liệu"
                      className="p-1 rounded hover:bg-red-50 text-red-600"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              ))}
              {documents.length === 0 && (
                <p className="text-sm text-slate-400 py-6 text-center">Chưa có tài liệu nào cho tác phẩm này.</p>
              )}
            </div>
          </div>
        </div>
      )}

      {/* TAB 5: SECURITY & 2FA */}
      {activeTab === 'settings' && (
        <div className="max-w-2xl bg-white p-6 rounded-2xl border border-[#e8e2d5] shadow-2xs space-y-6">
          <div>
            <h3 className="text-base font-bold text-[#0f2942] flex items-center gap-2">
              <Shield className="w-5 h-5 text-amber-700" />
              Bảo mật tài khoản & Xác thực 2 bước (TOTP 2FA)
            </h3>
            <p className="text-xs text-slate-500 mt-1">
              Bảo vệ tài khoản giáo viên bằng Google Authenticator và mã khôi phục dự phòng.
            </p>
          </div>

          {!totpQr ? (
            <button
              onClick={handleStartTotp}
              className="px-4 py-2 rounded-xl text-xs font-semibold bg-[#0f2942] text-white hover:bg-[#1e3a5f]"
            >
              Kích hoạt xác thực 2 bước (TOTP)
            </button>
          ) : (
            <div className="space-y-4 p-4 rounded-xl bg-[#fbf9f4] border border-[#e8e2d5]">
              <span className="text-xs font-semibold text-[#0f2942]">1. Quét mã QR bằng ứng dụng Authenticator:</span>
              <img src={totpQr} alt="TOTP QR" className="w-48 h-48 border rounded-lg p-2 bg-white mx-auto" />
              {totpSecret && (
                <p className="text-center text-[11px] text-slate-500">
                  Hoặc nhập khóa bảo mật: <code className="bg-white px-1.5 py-0.5 rounded border font-mono text-amber-900 select-all">{totpSecret}</code>
                </p>
              )}

              <div>
                <span className="text-xs font-semibold text-[#0f2942]">2. Lưu mã khôi phục khẩn cấp:</span>
                <div className="grid grid-cols-2 gap-1.5 mt-1 bg-white p-2.5 rounded-lg border font-mono text-[11px]">
                  {totpRecoveryCodes.map((c, i) => (
                    <span key={i} className="text-slate-700">{c}</span>
                  ))}
                </div>
              </div>

              <div>
                <span className="text-xs font-semibold text-[#0f2942]">3. Nhập mã 6 số từ ứng dụng để xác nhận:</span>
                <div className="flex gap-2 mt-1">
                  <input
                    type="text"
                    placeholder="Mã 6 chữ số"
                    value={totpConfirmCode}
                    onChange={(e) => setTotpConfirmCode(e.target.value)}
                    className="text-xs p-2 rounded-lg border bg-white flex-1 font-mono"
                    maxLength={6}
                  />
                  <button
                    onClick={handleConfirmTotp}
                    className="px-4 py-2 rounded-lg text-xs font-semibold bg-emerald-700 text-white hover:bg-emerald-800"
                  >
                    Xác nhận kích hoạt
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
};
