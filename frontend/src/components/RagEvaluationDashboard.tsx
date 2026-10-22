import React, { useState, useEffect } from 'react';
import {
  Activity, BarChart3, Search, Play, FileText, CheckCircle2, AlertCircle,
  HelpCircle, Eye, ArrowRight, RefreshCw, Star, Layers, Cpu, Clock,
  Filter, Award, Sliders, ChevronRight, X, ExternalLink, ShieldCheck,
  Check, AlertTriangle, BookOpen, Sparkles, Send, Database, FileCode
} from 'lucide-react';
import { apiRequest } from '../api/client.js';
import type { Work, DocumentItem } from '../types.js';

export const RagEvaluationDashboard: React.FC = () => {
  const [activeSubTab, setActiveSubTab] = useState<'overview' | 'chunks' | 'playground' | 'traces' | 'benchmarks'>('overview');

  // Common Works list
  const [works, setWorks] = useState<Work[]>([]);
  const [loadingWorks, setLoadingWorks] = useState(false);

  // 1. OVERVIEW STATE
  const [overviewStats, setOverviewStats] = useState<any>(null);
  const [loadingOverview, setLoadingOverview] = useState(false);

  // 2. CHUNKS INSPECTOR STATE
  const [selectedWorkIdForChunks, setSelectedWorkIdForChunks] = useState<string>('');
  const [docsForChunks, setDocsForChunks] = useState<DocumentItem[]>([]);
  const [selectedDocIdForChunks, setSelectedDocIdForChunks] = useState<string>('');
  const [chunksData, setChunksData] = useState<{
    document: any;
    chunks: any[];
    sourceContent: string;
  } | null>(null);
  const [loadingChunks, setLoadingChunks] = useState(false);
  const [highlightedChunkId, setHighlightedChunkId] = useState<string | null>(null);

  // 3. PLAYGROUND STATE
  const [playgroundWorkId, setPlaygroundWorkId] = useState('');
  const [playgroundMode, setPlaygroundMode] = useState<'cau_hoi_ngan' | 'dan_y' | 'nghe_thuat' | 'luyen_viet'>('cau_hoi_ngan');
  const [playgroundQuestion, setPlaygroundQuestion] = useState('');
  const [runningPlayground, setRunningPlayground] = useState(false);
  const [playgroundResult, setPlaygroundResult] = useState<any>(null);
  const [playgroundActiveTab, setPlaygroundActiveTab] = useState<'response' | 'retrieval' | 'prompt' | 'verification' | 'cost'>('response');

  // 4. TRACES STATE
  const [traces, setTraces] = useState<any[]>([]);
  const [tracesTotal, setTracesTotal] = useState(0);
  const [tracesPage, setTracesPage] = useState(1);
  const [tracesLimit] = useState(15);
  const [tracesFilterMethod, setTracesFilterMethod] = useState('');
  const [tracesFilterSource, setTracesFilterSource] = useState('');
  const [tracesSearch, setTracesSearch] = useState('');
  const [loadingTraces, setLoadingTraces] = useState(false);
  const [selectedTraceId, setSelectedTraceId] = useState<string | null>(null);
  const [traceDetail, setTraceDetail] = useState<any>(null);
  const [loadingTraceDetail, setLoadingTraceDetail] = useState(false);

  // Manual Evaluation state
  const [evalRetrievalRating, setEvalRetrievalRating] = useState(5);
  const [evalEvidenceMissing, setEvalEvidenceMissing] = useState(false);
  const [evalQuoteAccuracy, setEvalQuoteAccuracy] = useState<'exact' | 'altered' | 'hallucinated' | 'no_quote'>('exact');
  const [evalAnalysisGrounded, setEvalAnalysisGrounded] = useState<'fully_grounded' | 'partially_grounded' | 'unsupported'>('fully_grounded');
  const [evalModeFit, setEvalModeFit] = useState(true);
  const [evalNotes, setEvalNotes] = useState('');
  const [submittingEval, setSubmittingEval] = useState(false);

  // 5. BENCHMARK STATE
  const [testSets, setTestSets] = useState<any[]>([]);
  const [runs, setRuns] = useState<any[]>([]);
  const [loadingTestSets, setLoadingTestSets] = useState(false);
  const [selectedTestSetId, setSelectedTestSetId] = useState<string>('');
  const [newTestSetName, setNewTestSetName] = useState('');
  const [newTestSetDesc, setNewTestSetDesc] = useState('');
  const [runningBenchmark, setRunningBenchmark] = useState(false);
  const [showAddTestCaseModal, setShowAddTestCaseModal] = useState(false);
  const [tcQuestion, setTcQuestion] = useState('');
  const [tcWorkId, setTcWorkId] = useState('');
  const [tcMode, setTcMode] = useState('cau_hoi_ngan');
  const [tcEvidence, setTcEvidence] = useState('');
  const [tcPoints, setTcPoints] = useState('');
  const [tcShouldRefuse, setTcShouldRefuse] = useState(false);
  const [creatingTestCase, setCreatingTestCase] = useState(false);

  // Initial loads
  useEffect(() => {
    loadWorks();
    loadOverview();
  }, []);

  const loadWorks = async () => {
    try {
      setLoadingWorks(true);
      const res = await apiRequest<{ works: Work[] }>('/api/teacher/works');
      setWorks(res.works || []);
      if (res.works && res.works.length > 0) {
        const firstWorkId = res.works[0].id;
        if (!selectedWorkIdForChunks) {
          setSelectedWorkIdForChunks(firstWorkId);
          loadDocsForWork(firstWorkId);
        }
        if (!playgroundWorkId) setPlaygroundWorkId(firstWorkId);
        if (!tcWorkId) setTcWorkId(firstWorkId);
      }
    } catch {
    } finally {
      setLoadingWorks(false);
    }
  };

  const loadOverview = async () => {
    try {
      setLoadingOverview(true);
      const data = await apiRequest('/api/admin/rag-eval/overview');
      setOverviewStats(data);
    } catch {
    } finally {
      setLoadingOverview(false);
    }
  };

  // Chunks Inspector triggers
  useEffect(() => {
    if (selectedWorkIdForChunks) {
      loadDocsForWork(selectedWorkIdForChunks);
    }
  }, [selectedWorkIdForChunks]);

  const loadDocsForWork = async (wId: string) => {
    try {
      const res = await apiRequest<{ documents: DocumentItem[] }>(`/api/teacher/works/${wId}/documents`);
      const docs = res.documents || [];
      setDocsForChunks(docs);
      if (docs.length > 0) {
        setSelectedDocIdForChunks(docs[0].id);
        loadChunks(docs[0].id);
      } else {
        setSelectedDocIdForChunks('');
        setChunksData(null);
      }
    } catch (err: any) {
      console.warn('[RagEvaluationDashboard] Lỗi tải tài liệu:', err);
      setDocsForChunks([]);
      setSelectedDocIdForChunks('');
      setChunksData(null);
    }
  };

  useEffect(() => {
    if (selectedDocIdForChunks) {
      loadChunks(selectedDocIdForChunks);
    }
  }, [selectedDocIdForChunks]);

  const loadChunks = async (docId: string) => {
    try {
      setLoadingChunks(true);
      setHighlightedChunkId(null);
      const data = await apiRequest(`/api/admin/rag-eval/documents/${docId}/chunks`);
      setChunksData(data);
    } catch {
    } finally {
      setLoadingChunks(false);
    }
  };

  // Traces list loader
  useEffect(() => {
    if (activeSubTab === 'traces') {
      loadTraces();
    }
  }, [activeSubTab, tracesPage, tracesFilterMethod, tracesFilterSource]);

  const loadTraces = async () => {
    try {
      setLoadingTraces(true);
      const q = new URLSearchParams({
        page: String(tracesPage),
        limit: String(tracesLimit),
      });
      if (tracesFilterMethod) q.set('method', tracesFilterMethod);
      if (tracesFilterSource) q.set('source', tracesFilterSource);
      if (tracesSearch) q.set('search', tracesSearch);

      const res = await apiRequest(`/api/admin/rag-eval/traces?${q.toString()}`);
      setTraces(res.traces || []);
      setTracesTotal(res.total || 0);
    } catch {
    } finally {
      setLoadingTraces(false);
    }
  };

  const loadTraceDetail = async (tId: string) => {
    try {
      setLoadingTraceDetail(true);
      setSelectedTraceId(tId);
      const res = await apiRequest(`/api/admin/rag-eval/traces/${tId}`);
      setTraceDetail(res);
      // Pre-fill manual eval if exists
      if (res.manualEvaluation) {
        setEvalRetrievalRating(res.manualEvaluation.retrieval_rating || 5);
        setEvalEvidenceMissing(!!res.manualEvaluation.evidence_missing);
        setEvalQuoteAccuracy(res.manualEvaluation.quote_accuracy || 'exact');
        setEvalAnalysisGrounded(res.manualEvaluation.analysis_grounded || 'fully_grounded');
        setEvalModeFit(res.manualEvaluation.mode_fit !== false);
        setEvalNotes(res.manualEvaluation.notes || '');
      } else {
        setEvalRetrievalRating(5);
        setEvalEvidenceMissing(false);
        setEvalQuoteAccuracy('exact');
        setEvalAnalysisGrounded('fully_grounded');
        setEvalModeFit(true);
        setEvalNotes('');
      }
    } catch (err: any) {
      alert(err.message);
    } finally {
      setLoadingTraceDetail(false);
    }
  };

  const handleSaveEvaluation = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedTraceId) return;
    try {
      setSubmittingEval(true);
      await apiRequest(`/api/admin/rag-eval/traces/${selectedTraceId}/evaluate`, {
        method: 'POST',
        body: JSON.stringify({
          retrievalRating: evalRetrievalRating,
          evidenceMissing: evalEvidenceMissing,
          quoteAccuracy: evalQuoteAccuracy,
          analysisGrounded: evalAnalysisGrounded,
          modeFit: evalModeFit,
          notes: evalNotes,
        }),
      });
      alert('Đã lưu kết quả đánh giá thủ công.');
      loadTraceDetail(selectedTraceId);
      loadOverview();
    } catch (err: any) {
      alert(err.message);
    } finally {
      setSubmittingEval(false);
    }
  };

  // Run Playground
  const handleRunPlayground = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!playgroundWorkId || !playgroundQuestion.trim()) return;
    try {
      setRunningPlayground(true);
      setPlaygroundResult(null);
      const res = await apiRequest('/api/admin/rag-eval/playground', {
        method: 'POST',
        body: JSON.stringify({
          workId: playgroundWorkId,
          mode: playgroundMode,
          question: playgroundQuestion.trim(),
        }),
      });
      setPlaygroundResult(res);
      setPlaygroundActiveTab('response');
    } catch (err: any) {
      alert(err.message);
    } finally {
      setRunningPlayground(false);
    }
  };

  // Benchmark loaders
  useEffect(() => {
    if (activeSubTab === 'benchmarks') {
      loadTestSets();
      loadRuns();
    }
  }, [activeSubTab]);

  const loadTestSets = async () => {
    try {
      setLoadingTestSets(true);
      const res = await apiRequest('/api/admin/rag-eval/testsets');
      setTestSets(res.testSets || []);
      if (res.testSets && res.testSets.length > 0 && !selectedTestSetId) {
        setSelectedTestSetId(res.testSets[0].id);
      }
    } catch {
    } finally {
      setLoadingTestSets(false);
    }
  };

  const loadRuns = async () => {
    try {
      const res = await apiRequest('/api/admin/rag-eval/runs');
      setRuns(res.runs || []);
    } catch {}
  };

  const handleCreateTestSet = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTestSetName.trim()) return;
    try {
      await apiRequest('/api/admin/rag-eval/testsets', {
        method: 'POST',
        body: JSON.stringify({
          name: newTestSetName.trim(),
          description: newTestSetDesc.trim(),
        }),
      });
      setNewTestSetName('');
      setNewTestSetDesc('');
      loadTestSets();
      alert('Đã tạo bộ câu hỏi chuẩn.');
    } catch (err: any) {
      alert(err.message);
    }
  };

  const handleAddTestCase = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedTestSetId || !tcQuestion.trim() || !tcWorkId) return;
    try {
      setCreatingTestCase(true);
      await apiRequest(`/api/admin/rag-eval/testsets/${selectedTestSetId}/cases`, {
        method: 'POST',
        body: JSON.stringify({
          workId: tcWorkId,
          mode: tcMode,
          question: tcQuestion.trim(),
          expectedEvidence: tcEvidence.split('\n').filter((x) => x.trim()),
          expectedPoints: tcPoints.split('\n').filter((x) => x.trim()),
          shouldRefuse: tcShouldRefuse,
        }),
      });
      setTcQuestion('');
      setTcEvidence('');
      setTcPoints('');
      setShowAddTestCaseModal(false);
      loadTestSets();
      alert('Đã thêm ca kiểm thử.');
    } catch (err: any) {
      alert(err.message);
    } finally {
      setCreatingTestCase(false);
    }
  };

  const handleRunBenchmark = async (tsId: string) => {
    if (!confirm('Chạy đánh giá hàng loạt trên bộ đề này? Hệ thống sẽ kiểm tra từng ca hỏi đáp theo ngân sách cấu hình.')) return;
    try {
      setRunningBenchmark(true);
      const res = await apiRequest(`/api/admin/rag-eval/testsets/${tsId}/run`, {
        method: 'POST',
      });
      alert(`Đã hoàn thành đánh giá benchmark! ${res.completedCases}/${res.totalCases} ca kiểm thử thành công.`);
      loadRuns();
    } catch (err: any) {
      alert(err.message);
    } finally {
      setRunningBenchmark(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Sub-header navigation */}
      <div className="bg-white p-2 rounded-2xl border border-[#e8e2d5] shadow-2xs flex flex-wrap gap-1.5">
        {[
          { id: 'overview', label: '1. Tổng quan & Chỉ số', icon: BarChart3 },
          { id: 'chunks', label: '2. Đoạn & Vị trí nguồn', icon: FileCode },
          { id: 'playground', label: '3. Phòng thử nghiệm RAG', icon: Play },
          { id: 'traces', label: '4. Nhật ký Trace & Đánh giá', icon: Activity },
          { id: 'benchmarks', label: '5. Bộ đề chuẩn & Benchmark', icon: Award },
        ].map((tab) => {
          const Icon = tab.icon;
          const isActive = activeSubTab === tab.id;
          return (
            <button
              key={tab.id}
              onClick={() => setActiveSubTab(tab.id as any)}
              className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-semibold transition-all cursor-pointer ${
                isActive
                  ? 'bg-[#0f2942] text-white shadow-xs'
                  : 'text-slate-700 hover:bg-[#fbf9f4] hover:text-[#0f2942]'
              }`}
            >
              <Icon className={`w-4 h-4 ${isActive ? 'text-amber-400' : 'text-slate-500'}`} />
              <span>{tab.label}</span>
            </button>
          );
        })}
      </div>

      {/* VIEW 1: OVERVIEW */}
      {activeSubTab === 'overview' && (
        <div className="space-y-6">
          {/* Top Metric Cards */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="bg-white p-5 rounded-2xl border border-[#e8e2d5] shadow-2xs">
              <span className="text-xs font-semibold text-slate-500 uppercase block">Tổng lượt gọi RAG</span>
              <p className="text-2xl font-bold text-[#0f2942] mt-1">
                {overviewStats?.totalTraces ?? 0}
              </p>
              <span className="text-[11px] text-slate-400 mt-1 block">
                Học sinh: {overviewStats?.studentTraces ?? 0} • Thử nghiệm: {overviewStats?.adminTraces ?? 0}
              </span>
            </div>

            <div className="bg-white p-5 rounded-2xl border border-[#e8e2d5] shadow-2xs">
              <span className="text-xs font-semibold text-slate-500 uppercase block">Token Input Trung bình</span>
              <p className="text-2xl font-bold text-amber-700 mt-1">
                {Math.round(overviewStats?.avgPromptTokens ?? 0).toLocaleString()} <span className="text-xs font-normal text-slate-500">tokens</span>
              </p>
              <span className="text-[11px] text-emerald-700 font-medium mt-1 block">
                Ngân sách mục tiêu: 9k - 12k tokens
              </span>
            </div>

            <div className="bg-white p-5 rounded-2xl border border-[#e8e2d5] shadow-2xs">
              <span className="text-xs font-semibold text-slate-500 uppercase block">Độ trễ phản hồi (p50 / p95)</span>
              <p className="text-2xl font-bold text-[#0f2942] mt-1">
                {overviewStats?.p50LatencyMs ? (overviewStats.p50LatencyMs / 1000).toFixed(2) : '0'}s /{' '}
                <span className="text-slate-500 text-lg">
                  {overviewStats?.p95LatencyMs ? (overviewStats.p95LatencyMs / 1000).toFixed(2) : '0'}s
                </span>
              </p>
              <span className="text-[11px] text-slate-400 mt-1 block">Thời gian xử lý luồng</span>
            </div>

            <div className="bg-white p-5 rounded-2xl border border-[#e8e2d5] shadow-2xs">
              <span className="text-xs font-semibold text-slate-500 uppercase block">Đánh giá thủ công</span>
              <p className="text-2xl font-bold text-indigo-700 mt-1">
                {overviewStats?.manualEvaluationsCount ?? 0} <span className="text-xs font-normal text-slate-500">lượt</span>
              </p>
              <span className="text-[11px] text-slate-500 mt-1 block">
                Điểm truy xuất TB: <strong>{overviewStats?.avgRetrievalRating ? Number(overviewStats.avgRetrievalRating).toFixed(1) : 'N/A'}/5</strong>
              </span>
            </div>
          </div>

          {/* Breakdown cards: Method breakdown & Quality rates */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Method Breakdown */}
            <div className="bg-white p-5 rounded-2xl border border-[#e8e2d5] shadow-2xs space-y-4">
              <h3 className="text-sm font-bold text-[#0f2942] flex items-center justify-between">
                <span>Phân bố theo phương thức xử lý</span>
                <span className="text-xs text-slate-400 font-normal">Dữ liệu ghi nhận thực tế</span>
              </h3>
              <div className="space-y-3">
                {[
                  {
                    key: 'direct_context',
                    label: 'Truy xuất nội bộ + Dựng ngữ cảnh (Pre-retrieval)',
                    count: overviewStats?.methods?.direct_context ?? 0,
                    color: 'bg-emerald-500',
                    desc: 'Chọn đoạn tham khảo + đoạn nguyên tác theo ngân sách',
                  },
                  {
                    key: 'google_file_search',
                    label: 'Google File Search (Tool bên ngoài)',
                    count: overviewStats?.methods?.google_file_search ?? 0,
                    color: 'bg-blue-500',
                    desc: 'Chỉ gắn cờ khi thực sự gọi tool của Gemini API',
                  },
                  {
                    key: 'mock_fallback',
                    label: 'Dự phòng Offline / Giả lập (Mock Fallback)',
                    count: overviewStats?.methods?.mock_fallback ?? 0,
                    color: 'bg-red-400',
                    desc: 'Không trừ hạn mức hỏi của học sinh',
                  },
                  {
                    key: 'cache',
                    label: 'Truy xuất bộ nhớ Cache',
                    count: overviewStats?.methods?.cache ?? 0,
                    color: 'bg-amber-400',
                    desc: 'Tái sử dụng câu trả lời đã kiểm chứng',
                  },
                ].map((m) => {
                  const total = overviewStats?.totalTraces || 1;
                  const pct = Math.round((m.count / total) * 100);
                  return (
                    <div key={m.key} className="space-y-1">
                      <div className="flex justify-between text-xs">
                        <span className="font-semibold text-slate-800">{m.label}</span>
                        <span className="text-slate-500 font-mono">
                          {m.count} ({pct}%)
                        </span>
                      </div>
                      <div className="w-full bg-slate-100 h-2 rounded-full overflow-hidden">
                        <div className={`h-full ${m.color}`} style={{ width: `${pct}%` }} />
                      </div>
                      <p className="text-[11px] text-slate-400">{m.desc}</p>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Quality and Verification Metrics */}
            <div className="bg-white p-5 rounded-2xl border border-[#e8e2d5] shadow-2xs space-y-4">
              <h3 className="text-sm font-bold text-[#0f2942] flex items-center justify-between">
                <span>Chỉ số chất lượng & Kiểm chứng câu trích</span>
                <span className="text-xs text-slate-400 font-normal">Đo lường an toàn nội dung</span>
              </h3>
              <div className="grid grid-cols-2 gap-3 text-xs">
                <div className="p-3.5 rounded-xl bg-amber-50/70 border border-amber-200">
                  <span className="text-[11px] text-amber-800 font-semibold block">Tỷ lệ thiếu nguồn</span>
                  <p className="text-2xl font-bold text-amber-900 mt-1">
                    {overviewStats?.noSourceRate !== undefined ? `${overviewStats.noSourceRate}%` : '0%'}
                  </p>
                  <p className="text-[11px] text-amber-700 mt-1">
                    Hệ thống nói rõ chưa có nguồn, không bịa đặt kiến thức
                  </p>
                </div>

                <div className="p-3.5 rounded-xl bg-emerald-50/70 border border-emerald-200">
                  <span className="text-[11px] text-emerald-800 font-semibold block">Tỷ lệ câu trích khớp nguyên bản</span>
                  <p className="text-2xl font-bold text-emerald-900 mt-1">
                    {overviewStats?.quoteMatchRate !== undefined ? `${overviewStats.quoteMatchRate}%` : 'N/A'}
                  </p>
                  <p className="text-[11px] text-emerald-700 mt-1">
                    Dẫn chứng văn bản khớp từng chữ với tác phẩm gốc
                  </p>
                </div>

                <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200">
                  <span className="text-[11px] text-slate-500 font-semibold block">Số lần Thử lại / Fallback</span>
                  <p className="text-2xl font-bold text-slate-800 mt-1">
                    {overviewStats?.fallbackCount ?? 0}
                  </p>
                  <p className="text-[11px] text-slate-500 mt-1">
                    Tự động chuyển khóa API hoặc khôi phục lỗi mạng
                  </p>
                </div>

                <div className="p-3.5 rounded-xl bg-blue-50 border border-blue-200">
                  <span className="text-[11px] text-blue-800 font-semibold block">Ghi chú quan trọng</span>
                  <p className="text-[11px] text-blue-900 mt-1 leading-relaxed">
                    <strong>Lưu ý:</strong> "Có citations" <em>không mặc định là câu trả lời đúng</em>. Hệ thống phân biệt rõ trích đúng nguyên tác với lập luận được bằng chứng hỗ trợ.
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* VIEW 2: CHUNKS INSPECTOR */}
      {activeSubTab === 'chunks' && (
        <div className="space-y-4">
          {/* Selectors */}
          <div className="bg-white p-4 rounded-2xl border border-[#e8e2d5] shadow-2xs flex flex-wrap items-center gap-3">
            <div className="flex items-center gap-2">
              <span className="text-xs font-semibold text-slate-700">Tác phẩm:</span>
              <select
                value={selectedWorkIdForChunks}
                onChange={(e) => {
                  const newWId = e.target.value;
                  setSelectedWorkIdForChunks(newWId);
                  setSelectedDocIdForChunks('');
                  setChunksData(null);
                  loadDocsForWork(newWId);
                }}
                className="text-xs p-2 rounded-xl border border-[#e8e2d5] bg-[#fbf9f4] font-medium"
              >
                {works.map((w) => (
                  <option key={w.id} value={w.id}>
                    {w.title} ({w.author})
                  </option>
                ))}
              </select>
            </div>

            <div className="flex items-center gap-2">
              <span className="text-xs font-semibold text-slate-700">Tài liệu:</span>
              <select
                value={selectedDocIdForChunks}
                onChange={(e) => {
                  setSelectedDocIdForChunks(e.target.value);
                  if (e.target.value) loadChunks(e.target.value);
                }}
                className="text-xs p-2 rounded-xl border border-[#e8e2d5] bg-[#fbf9f4] font-medium"
              >
                {docsForChunks.length === 0 ? (
                  <option value="">(Tác phẩm chưa có tài liệu)</option>
                ) : (
                  docsForChunks.map((d) => (
                    <option key={d.id} value={d.id}>
                      [{d.document_role === 'primary' ? 'Bản gốc' : 'Tham khảo'}] {d.title} (v{d.version})
                    </option>
                  ))
                )}
              </select>
            </div>

            <button
              onClick={() => selectedDocIdForChunks && loadChunks(selectedDocIdForChunks)}
              className="ml-auto text-xs px-3 py-1.5 rounded-xl border border-slate-300 bg-white hover:bg-slate-50 flex items-center gap-1 cursor-pointer font-medium"
            >
              <RefreshCw className="w-3.5 h-3.5 text-slate-600" />
              <span>Tải lại</span>
            </button>
          </div>

          {loadingChunks ? (
            <div className="py-20 text-center text-xs text-slate-500">Đang đọc tài liệu và phân đoạn...</div>
          ) : !chunksData ? (
            <div className="py-20 text-center text-xs text-slate-400 italic">Vui lòng chọn tác phẩm và tài liệu để kiểm tra các chunk.</div>
          ) : (
            (() => {
              const sourceText = chunksData?.sourceContent || chunksData?.document?.rawContent || '';
              const chunksList = Array.isArray(chunksData?.chunks) ? chunksData.chunks : [];

              return (
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                  {/* Left Column: Source Text with Highlight */}
                  <div className="bg-white p-4 rounded-2xl border border-[#e8e2d5] shadow-2xs flex flex-col h-[650px]">
                    <div className="flex items-center justify-between pb-2 border-b border-[#e8e2d5] mb-2">
                      <div className="flex items-center gap-2">
                        <BookOpen className="w-4 h-4 text-emerald-700" />
                        <span className="text-xs font-bold text-[#0f2942]">Văn bản nguồn (Tô sáng vị trí chunk đã chọn)</span>
                      </div>
                      <span className="text-[11px] text-slate-400 font-mono">
                        {sourceText.length} ký tự
                      </span>
                    </div>
                    <div className="flex-1 overflow-y-auto text-xs font-serif leading-relaxed p-3 bg-[#fbf9f4] rounded-xl border border-[#e8e2d5] whitespace-pre-wrap select-text">
                      {(() => {
                        if (!sourceText) {
                          return (
                            <span className="text-slate-400 italic font-sans">
                              Tài liệu này chưa có nội dung văn bản thô trong cơ sở dữ liệu.
                            </span>
                          );
                        }
                        const selChunk = chunksList.find((c: any) => c.id === highlightedChunkId);
                        if (!selChunk || selChunk.start_offset === undefined || selChunk.end_offset === undefined) {
                          return sourceText;
                        }
                        const start = Math.max(0, selChunk.start_offset);
                        const end = Math.min(sourceText.length, selChunk.end_offset);
                        const before = sourceText.slice(0, start);
                        const highlighted = sourceText.slice(start, end);
                        const after = sourceText.slice(end);
                        return (
                          <>
                            <span>{before}</span>
                            <mark className="bg-amber-300 text-amber-950 font-sans font-semibold px-1 py-0.5 rounded shadow-2xs">
                              {highlighted}
                            </mark>
                            <span>{after}</span>
                          </>
                        );
                      })()}
                    </div>
                  </div>

                  {/* Right Column: Chunks List */}
                  <div className="bg-white p-4 rounded-2xl border border-[#e8e2d5] shadow-2xs flex flex-col h-[650px]">
                    <div className="flex items-center justify-between pb-2 border-b border-[#e8e2d5] mb-2">
                      <div className="flex items-center gap-2">
                        <Layers className="w-4 h-4 text-blue-700" />
                        <span className="text-xs font-bold text-[#0f2942]">
                          Danh sách các Chunk đã cắt ({chunksList.length} đoạn)
                        </span>
                      </div>
                      <span className="text-[11px] text-slate-500">Bấm vào đoạn để xem vị trí nguồn</span>
                    </div>
                    <div className="flex-1 overflow-y-auto space-y-2 pr-1">
                      {chunksList.length === 0 ? (
                        <div className="py-12 text-center text-xs text-slate-400 italic">
                          Chưa có đoạn nào được phân tách cho tài liệu này.
                        </div>
                      ) : (
                        chunksList.map((c: any, idx: number) => {
                          const isSelected = highlightedChunkId === c.id;
                          return (
                            <div
                              key={c.id || idx}
                              onClick={() => setHighlightedChunkId(isSelected ? null : c.id)}
                              className={`p-3 rounded-xl border text-xs cursor-pointer transition-all ${
                                isSelected
                                  ? 'bg-amber-50 border-amber-400 shadow-xs ring-2 ring-amber-300'
                                  : 'bg-white hover:bg-slate-50 border-[#e8e2d5]'
                              }`}
                            >
                              <div className="flex items-center justify-between mb-1.5">
                                <span className="font-bold text-[#0f2942] flex items-center gap-1.5">
                                  <span className="px-1.5 py-0.5 rounded bg-slate-100 text-[10px] text-slate-700 font-mono">
                                    #{c.chunk_order ?? idx + 1}
                                  </span>
                                  {c.section_title || `Đoạn ${idx + 1}`}
                                </span>
                                <div className="flex items-center gap-2">
                                  <span className="text-[10px] text-slate-500 font-mono">
                                    ~{c.token_estimate} tokens
                                  </span>
                                  <span className="text-[10px] px-1.5 py-0.5 rounded bg-blue-50 text-blue-700 font-semibold border border-blue-200">
                                    {c.document_role === 'primary' ? 'Nguyên tác [P]' : 'Tham khảo [R]'}
                                  </span>
                                </div>
                              </div>
                              <p className="text-slate-700 line-clamp-3 leading-relaxed font-sans">{c.content}</p>
                              <div className="mt-2 pt-1 border-t border-slate-100 flex items-center justify-between text-[10px] text-slate-400 font-mono">
                                <span>Offset: {c.start_offset} - {c.end_offset}</span>
                                <span>Hash: {c.content_hash ? c.content_hash.slice(0, 8) : 'N/A'}</span>
                              </div>
                            </div>
                          );
                        })
                      )}
                    </div>
                  </div>
                </div>
              );
            })()
          )}
        </div>
      )}

      {/* VIEW 3: PLAYGROUND */}
      {activeSubTab === 'playground' && (
        <div className="space-y-6">
          {/* Query Input Box */}
          <form onSubmit={handleRunPlayground} className="bg-white p-5 rounded-2xl border border-[#e8e2d5] shadow-2xs space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <h3 className="text-sm font-bold text-[#0f2942] flex items-center gap-2">
                <Play className="w-4 h-4 text-emerald-600 fill-emerald-600" />
                Phòng thử nghiệm RAG trực tiếp (Playground)
              </h3>
              <span className="text-[11px] text-emerald-800 bg-emerald-50 px-2.5 py-0.5 rounded-lg border border-emerald-200 font-medium">
                Thử nghiệm không trừ hạn mức học sinh • Có áp dụng ngân sách token
              </span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div>
                <label className="text-xs font-semibold text-slate-700 block mb-1">Tác phẩm:</label>
                <select
                  value={playgroundWorkId}
                  onChange={(e) => setPlaygroundWorkId(e.target.value)}
                  className="w-full text-xs p-2.5 rounded-xl border border-[#e8e2d5] bg-[#fbf9f4]"
                >
                  {works.map((w) => (
                    <option key={w.id} value={w.id}>
                      {w.title} ({w.author} - Lớp {w.grade})
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="text-xs font-semibold text-slate-700 block mb-1">Chế độ học:</label>
                <select
                  value={playgroundMode}
                  onChange={(e) => setPlaygroundMode(e.target.value as any)}
                  className="w-full text-xs p-2.5 rounded-xl border border-[#e8e2d5] bg-[#fbf9f4]"
                >
                  <option value="cau_hoi_ngan">1. Hỏi đáp nhanh & Ý nghĩa chi tiết</option>
                  <option value="dan_y">2. Lập dàn ý & Luận điểm phân tích</option>
                  <option value="nghe_thuat">3. Phân tích chi tiết nghệ thuật</option>
                  <option value="luyen_viet">4. Luyện viết đoạn văn / Mở - Kết</option>
                </select>
              </div>

              <div className="flex items-end">
                <button
                  type="submit"
                  disabled={runningPlayground || !playgroundQuestion.trim()}
                  className="w-full py-2.5 rounded-xl bg-[#0f2942] text-white text-xs font-semibold hover:bg-[#1e3a5f] disabled:opacity-50 flex items-center justify-center gap-1.5 cursor-pointer shadow-2xs"
                >
                  {runningPlayground ? (
                    <>
                      <RefreshCw className="w-4 h-4 animate-spin text-amber-400" />
                      <span>Đang truy xuất & gọi mô hình...</span>
                    </>
                  ) : (
                    <>
                      <Send className="w-4 h-4 text-amber-400" />
                      <span>Chạy thử nghiệm RAG</span>
                    </>
                  )}
                </button>
              </div>
            </div>

            <div>
              <label className="text-xs font-semibold text-slate-700 block mb-1">Câu hỏi của người học:</label>
              <textarea
                rows={3}
                placeholder="Ví dụ: Phân tích tâm trạng của nhân vật Tràng khi gặp người đàn bà dắt díu về nhà..."
                value={playgroundQuestion}
                onChange={(e) => setPlaygroundQuestion(e.target.value)}
                className="w-full text-xs p-3 rounded-xl border border-[#e8e2d5] bg-[#fbf9f4]"
                required
              />
            </div>
          </form>

          {/* Playground Results */}
          {playgroundResult && (
            <div className="bg-white rounded-2xl border border-[#e8e2d5] shadow-2xs overflow-hidden">
              {/* Tab Header */}
              <div className="bg-[#fbf9f4] border-b border-[#e8e2d5] p-3 flex flex-wrap gap-2 items-center justify-between">
                <div className="flex gap-1.5">
                  {[
                    { id: 'response', label: '1. Câu trả lời & Kiểm chứng' },
                    { id: 'retrieval', label: `2. Đoạn truy xuất (${playgroundResult.retrieval?.retrievedChunks?.length ?? 0})` },
                    { id: 'prompt', label: '3. Ngữ cảnh đã gửi vào LLM' },
                    { id: 'cost', label: '4. Token & Độ trễ' },
                  ].map((sub) => (
                    <button
                      key={sub.id}
                      onClick={() => setPlaygroundActiveTab(sub.id as any)}
                      className={`px-3 py-1.5 rounded-xl text-xs font-semibold transition-all cursor-pointer ${
                        playgroundActiveTab === sub.id
                          ? 'bg-[#0f2942] text-white'
                          : 'bg-white hover:bg-slate-100 text-slate-700 border border-[#e8e2d5]'
                      }`}
                    >
                      {sub.label}
                    </button>
                  ))}
                </div>

                <div className="flex items-center gap-2 text-xs">
                  <span className="font-mono text-slate-500">Trace ID: #{playgroundResult.traceId ? playgroundResult.traceId.slice(0, 8) : 'N/A'}</span>
                  <span className="px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800 text-[10px] font-bold">
                    {playgroundResult.status}
                  </span>
                </div>
              </div>

              {/* Sub-tab 1: Response */}
              {playgroundActiveTab === 'response' && (
                <div className="p-5 space-y-4 text-xs">
                  {/* Verified Citations Badge */}
                  <div className="flex flex-wrap items-center gap-2 p-3 bg-slate-50 rounded-xl border border-slate-200">
                    <span className="font-semibold text-slate-700">Nguồn trích dẫn ghi nhận:</span>
                    {playgroundResult.citations && playgroundResult.citations.length > 0 ? (
                      playgroundResult.citations.map((c: any, i: number) => (
                        <span key={i} className="px-2 py-1 rounded bg-white border border-slate-300 text-slate-800 text-[11px] font-medium">
                          [{c.code || `N${i+1}`}] {c.title} (v{c.version})
                        </span>
                      ))
                    ) : (
                      <span className="text-slate-400 italic">Không có nguồn tài liệu tham khảo nào được trích dẫn trực tiếp.</span>
                    )}
                  </div>

                  {/* Primary text quote verification badge */}
                  {playgroundResult.quoteVerification && (
                    <div className="p-3 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-950 space-y-1">
                      <div className="flex items-center gap-1.5 font-bold">
                        <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                        <span>Kiểm chứng câu trích nguyên tác: {playgroundResult.quoteVerification.status}</span>
                      </div>
                      <p className="text-[11px] text-emerald-800">
                        {playgroundResult.quoteVerification.notes || 'Các câu trích nguyên văn đã được so khớp với bản gốc đang hiệu lực.'}
                      </p>
                    </div>
                  )}

                  {/* Final answer render */}
                  <div className="p-4 rounded-xl bg-[#fbf9f4] border border-[#e8e2d5] font-serif leading-relaxed whitespace-pre-wrap text-sm text-slate-900">
                    {playgroundResult.answer}
                  </div>
                </div>
              )}

              {/* Sub-tab 2: Retrieval breakdown */}
              {playgroundActiveTab === 'retrieval' && (
                <div className="p-5 space-y-4 text-xs">
                  <div className="flex items-center justify-between">
                    <h4 className="font-bold text-[#0f2942]">Các đoạn được chọn lọc & Ngân sách</h4>
                    <span className="text-slate-500 font-mono">
                      Tham khảo: {playgroundResult.retrieval?.refCount ?? 0} • Nguyên tác: {playgroundResult.retrieval?.primaryCount ?? 0}
                    </span>
                  </div>

                  <div className="space-y-2">
                    {playgroundResult.retrieval?.retrievedChunks?.map((chunk: any, i: number) => (
                      <div key={i} className="p-3 rounded-xl border border-slate-200 bg-white space-y-1 shadow-2xs">
                        <div className="flex items-center justify-between">
                          <span className="font-bold text-slate-800 flex items-center gap-1.5">
                            <span className="px-1.5 py-0.5 rounded bg-amber-100 text-amber-900 font-mono text-[10px]">
                              [{chunk.sourceCode}]
                            </span>
                            {chunk.docTitle}
                          </span>
                          <span className="text-[10px] text-slate-500 font-mono">
                            Điểm phù hợp: {chunk.score?.toFixed(2) ?? 'N/A'} • ~{chunk.tokenEstimate} tok
                          </span>
                        </div>
                        <p className="text-slate-700 leading-relaxed font-sans">{chunk.content}</p>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Sub-tab 3: Prompt context */}
              {playgroundActiveTab === 'prompt' && (
                <div className="p-5 space-y-3 text-xs">
                  <div className="flex items-center justify-between">
                    <span className="font-bold text-slate-700">Ngữ cảnh prompt hoàn chỉnh gửi vào API:</span>
                    <span className="text-slate-500 font-mono">
                      Ước lượng: ~{playgroundResult.tokenStats?.estimatedPromptTokens ?? 0} tokens
                    </span>
                  </div>
                  <pre className="p-3 bg-slate-900 text-slate-100 rounded-xl overflow-x-auto text-[11px] font-mono whitespace-pre-wrap max-h-96">
                    {playgroundResult.promptContext || 'N/A'}
                  </pre>
                </div>
              )}

              {/* Sub-tab 4: Cost & Latency */}
              {playgroundActiveTab === 'cost' && (
                <div className="p-5 grid grid-cols-1 sm:grid-cols-3 gap-4 text-xs">
                  <div className="p-4 rounded-xl bg-slate-50 border border-slate-200">
                    <span className="text-slate-500 uppercase font-semibold text-[11px] block">Mô hình AI sử dụng</span>
                    <p className="text-base font-bold text-slate-900 mt-1">{playgroundResult.modelUsed || 'Gemini'}</p>
                    <span className="text-[11px] text-slate-400 mt-1 block">Provider: {playgroundResult.provider || 'Google Official'}</span>
                  </div>

                  <div className="p-4 rounded-xl bg-slate-50 border border-slate-200">
                    <span className="text-slate-500 uppercase font-semibold text-[11px] block">Tokens tiêu thụ</span>
                    <p className="text-base font-bold text-slate-900 mt-1">
                      Input: {playgroundResult.tokenStats?.promptTokens ?? 0} | Output: {playgroundResult.tokenStats?.completionTokens ?? 0}
                    </p>
                    <span className="text-[11px] text-slate-400 mt-1 block">
                      Tổng: {playgroundResult.tokenStats?.totalTokens ?? 0} tokens
                    </span>
                  </div>

                  <div className="p-4 rounded-xl bg-slate-50 border border-slate-200">
                    <span className="text-slate-500 uppercase font-semibold text-[11px] block">Thời gian xử lý</span>
                    <p className="text-base font-bold text-slate-900 mt-1">
                      {playgroundResult.responseTimeMs ? (playgroundResult.responseTimeMs / 1000).toFixed(2) : '0'} giây
                    </p>
                    <span className="text-[11px] text-emerald-700 mt-1 block">Không có lỗi retry</span>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* VIEW 4: TRACES LIST & DETAIL */}
      {activeSubTab === 'traces' && (
        <div className="space-y-4">
          {/* Filters */}
          <div className="bg-white p-4 rounded-2xl border border-[#e8e2d5] shadow-2xs flex flex-wrap items-center gap-3 text-xs">
            <div className="flex items-center gap-2">
              <span className="font-semibold text-slate-700">Phương thức:</span>
              <select
                value={tracesFilterMethod}
                onChange={(e) => setTracesFilterMethod(e.target.value)}
                className="p-2 rounded-xl border border-[#e8e2d5] bg-[#fbf9f4]"
              >
                <option value="">Tất cả phương thức</option>
                <option value="direct_context">Nội bộ (Pre-retrieval)</option>
                <option value="google_file_search">Google File Search Tool</option>
                <option value="mock_fallback">Dự phòng Offline (Mock)</option>
                <option value="cache">Cache</option>
              </select>
            </div>

            <div className="flex items-center gap-2">
              <span className="font-semibold text-slate-700">Nguồn gọi:</span>
              <select
                value={tracesFilterSource}
                onChange={(e) => setTracesFilterSource(e.target.value)}
                className="p-2 rounded-xl border border-[#e8e2d5] bg-[#fbf9f4]"
              >
                <option value="">Tất cả nguồn</option>
                <option value="student">Học sinh hỏi bài</option>
                <option value="admin_test">Thử nghiệm quản trị</option>
              </select>
            </div>

            <div className="flex-1 max-w-sm ml-auto">
              <div className="relative">
                <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-2.5" />
                <input
                  type="text"
                  placeholder="Tìm theo nội dung câu hỏi..."
                  value={tracesSearch}
                  onChange={(e) => setTracesSearch(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && loadTraces()}
                  className="w-full pl-8 pr-3 py-2 rounded-xl border border-[#e8e2d5] bg-[#fbf9f4] text-xs"
                />
              </div>
            </div>

            <button
              onClick={loadTraces}
              className="p-2 rounded-xl border border-slate-300 bg-white hover:bg-slate-50 cursor-pointer"
            >
              <RefreshCw className="w-3.5 h-3.5 text-slate-600" />
            </button>
          </div>

          {/* Trace Table */}
          <div className="bg-white rounded-2xl border border-[#e8e2d5] shadow-2xs overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead>
                  <tr className="border-b border-[#e8e2d5] bg-[#fbf9f4] text-slate-600 font-semibold">
                    <th className="py-3 px-4">Thời gian</th>
                    <th className="py-3 px-4">Nguồn</th>
                    <th className="py-3 px-4">Tác phẩm & Câu hỏi</th>
                    <th className="py-3 px-4">Phương thức</th>
                    <th className="py-3 px-4">Tokens (In / Out)</th>
                    <th className="py-3 px-4">Độ trễ</th>
                    <th className="py-3 px-4">Đánh giá</th>
                    <th className="py-3 px-4 text-right">Chi tiết</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {loadingTraces ? (
                    <tr>
                      <td colSpan={8} className="py-12 text-center text-slate-500">Đang tải danh sách trace...</td>
                    </tr>
                  ) : traces.length === 0 ? (
                    <tr>
                      <td colSpan={8} className="py-12 text-center text-slate-400 italic">Chưa có trace nào phù hợp bộ lọc.</td>
                    </tr>
                  ) : (
                    traces.map((t) => (
                      <tr key={t.id} className="hover:bg-slate-50/60 transition-colors">
                        <td className="py-3 px-4 text-slate-500 whitespace-nowrap">
                          {new Date(t.created_at).toLocaleString('vi-VN')}
                        </td>
                        <td className="py-3 px-4 whitespace-nowrap">
                          <span className={`px-2 py-0.5 rounded-full text-[10px] font-semibold ${
                            t.trace_source === 'student'
                              ? 'bg-blue-50 text-blue-800 border border-blue-200'
                              : 'bg-purple-50 text-purple-800 border border-purple-200'
                          }`}>
                            {t.trace_source === 'student' ? 'Học sinh' : 'Admin Test'}
                          </span>
                        </td>
                        <td className="py-3 px-4 max-w-xs">
                          <span className="font-bold text-[#0f2942] block truncate">{t.work_title || 'N/A'}</span>
                          <span className="text-[11px] text-slate-500 truncate block">{t.question}</span>
                        </td>
                        <td className="py-3 px-4 whitespace-nowrap">
                          <span className="px-2 py-0.5 rounded bg-slate-100 text-slate-800 font-mono text-[10px]">
                            {t.processing_method}
                          </span>
                        </td>
                        <td className="py-3 px-4 whitespace-nowrap font-mono text-slate-700">
                          {t.prompt_tokens ?? '0'} / {t.completion_tokens ?? '0'}
                        </td>
                        <td className="py-3 px-4 whitespace-nowrap text-slate-600">
                          {t.response_time_ms ? `${(t.response_time_ms / 1000).toFixed(2)}s` : 'N/A'}
                        </td>
                        <td className="py-3 px-4 whitespace-nowrap">
                          {t.has_evaluation ? (
                            <span className="text-emerald-700 font-semibold flex items-center gap-1">
                              <Star className="w-3.5 h-3.5 fill-emerald-500 text-emerald-500" />
                              <span>Đã chấm</span>
                            </span>
                          ) : (
                            <span className="text-slate-400">Chưa chấm</span>
                          )}
                        </td>
                        <td className="py-3 px-4 text-right whitespace-nowrap">
                          <button
                            onClick={() => loadTraceDetail(t.id)}
                            className="px-2.5 py-1 rounded-lg bg-[#0f2942] hover:bg-[#1e3a5f] text-white text-[11px] font-semibold cursor-pointer"
                          >
                            Xem chi tiết
                          </button>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>

          {/* Trace Detail Modal */}
          {selectedTraceId && traceDetail && (
            <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-3 sm:p-4 backdrop-blur-xs animate-in fade-in">
              <div className="max-w-4xl w-full max-h-[90vh] bg-white rounded-2xl shadow-2xl flex flex-col overflow-hidden border border-[#e8e2d5]">
                {/* Modal Header */}
                <div className="p-4 border-b border-[#e8e2d5] flex items-center justify-between bg-[#fbf9f4]">
                  <div>
                    <h3 className="text-sm font-bold text-[#0f2942] flex items-center gap-2">
                      <Activity className="w-4 h-4 text-amber-600" />
                      Chi tiết Trace #{traceDetail.trace?.id?.slice(0, 8)}
                    </h3>
                    <p className="text-xs text-slate-500 mt-0.5">
                      Thời gian: {new Date(traceDetail.trace?.created_at).toLocaleString('vi-VN')} • Nguồn: {traceDetail.trace?.trace_source}
                    </p>
                  </div>
                  <button
                    onClick={() => {
                      setSelectedTraceId(null);
                      setTraceDetail(null);
                    }}
                    className="p-1 rounded-lg text-slate-400 hover:text-slate-700 cursor-pointer"
                  >
                    <X className="w-5 h-5" />
                  </button>
                </div>

                {/* Modal Body */}
                <div className="p-4 flex-1 overflow-y-auto space-y-4 text-xs">
                  {/* Meta summary card */}
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                    <div className="p-3 bg-slate-50 rounded-xl border border-slate-200">
                      <span className="text-slate-500 uppercase font-semibold text-[10px] block">Mô hình</span>
                      <span className="font-bold text-slate-900 block mt-0.5">{traceDetail.trace?.model_used || 'Gemini'}</span>
                    </div>
                    <div className="p-3 bg-slate-50 rounded-xl border border-slate-200">
                      <span className="text-slate-500 uppercase font-semibold text-[10px] block">Phương thức</span>
                      <span className="font-bold text-slate-900 block mt-0.5">{traceDetail.trace?.processing_method}</span>
                    </div>
                    <div className="p-3 bg-slate-50 rounded-xl border border-slate-200">
                      <span className="text-slate-500 uppercase font-semibold text-[10px] block">Token Input / Output</span>
                      <span className="font-bold text-slate-900 block mt-0.5 font-mono">
                        {traceDetail.trace?.prompt_tokens} / {traceDetail.trace?.completion_tokens}
                      </span>
                    </div>
                    <div className="p-3 bg-slate-50 rounded-xl border border-slate-200">
                      <span className="text-slate-500 uppercase font-semibold text-[10px] block">Độ trễ</span>
                      <span className="font-bold text-slate-900 block mt-0.5">
                        {traceDetail.trace?.response_time_ms ? `${(traceDetail.trace.response_time_ms / 1000).toFixed(2)}s` : 'N/A'}
                      </span>
                    </div>
                  </div>

                  {/* Question */}
                  <div className="space-y-1">
                    <span className="font-bold text-slate-700">Câu hỏi người học:</span>
                    <p className="p-3 bg-[#fbf9f4] rounded-xl border border-[#e8e2d5] font-serif text-slate-800">
                      {traceDetail.trace?.question}
                    </p>
                  </div>

                  {/* Answer */}
                  <div className="space-y-1">
                    <span className="font-bold text-slate-700">Câu trả lời xuất ra:</span>
                    <div className="p-3 bg-[#fbf9f4] rounded-xl border border-[#e8e2d5] font-serif leading-relaxed whitespace-pre-wrap text-slate-800">
                      {traceDetail.trace?.final_answer || 'Không có câu trả lời lưu trong trace.'}
                    </div>
                  </div>

                  {/* Manual Evaluation Rubric Form */}
                  <form onSubmit={handleSaveEvaluation} className="p-4 rounded-xl bg-amber-50/60 border border-amber-300 space-y-3">
                    <h4 className="font-bold text-[#0f2942] flex items-center gap-1.5 text-xs">
                      <Award className="w-4 h-4 text-amber-700" />
                      Biểu mẫu đánh giá chất lượng thủ công (Admin Rubric)
                    </h4>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      <div>
                        <label className="font-semibold text-slate-700 block mb-1">Điểm truy xuất thông tin (1 - 5 sao):</label>
                        <select
                          value={evalRetrievalRating}
                          onChange={(e) => setEvalRetrievalRating(Number(e.target.value))}
                          className="w-full p-2 rounded-lg border border-amber-200 bg-white"
                        >
                          <option value={5}>5 sao - Đúng trọng tâm, đầy đủ ý</option>
                          <option value={4}>4 sao - Tương đối đầy đủ</option>
                          <option value={3}>3 sao - Thiếu một số ý quan trọng</option>
                          <option value={2}>2 sao - Trích sai ngữ cảnh</option>
                          <option value={1}>1 sao - Hoàn toàn không liên quan</option>
                        </select>
                      </div>

                      <div>
                        <label className="font-semibold text-slate-700 block mb-1">Kiểm chứng câu trích nguyên tác:</label>
                        <select
                          value={evalQuoteAccuracy}
                          onChange={(e) => setEvalQuoteAccuracy(e.target.value as any)}
                          className="w-full p-2 rounded-lg border border-amber-200 bg-white"
                        >
                          <option value="exact">Trích đúng từng chữ (Khớp bản gốc)</option>
                          <option value="altered">Bị sửa từ / sai dấu câu / đảo trật tự</option>
                          <option value="hallucinated">Tự bịa câu trích (Không có trong bản gốc)</option>
                          <option value="no_quote">Không có câu trích trong câu trả lời</option>
                        </select>
                      </div>

                      <div>
                        <label className="font-semibold text-slate-700 block mb-1">Cơ sở phân tích từ tài liệu tham khảo:</label>
                        <select
                          value={evalAnalysisGrounded}
                          onChange={(e) => setEvalAnalysisGrounded(e.target.value as any)}
                          className="w-full p-2 rounded-lg border border-amber-200 bg-white"
                        >
                          <option value="fully_grounded">Được tài liệu hỗ trợ hoàn toàn</option>
                          <option value="partially_grounded">Được hỗ trợ một phần</option>
                          <option value="unsupported">Không có căn cứ / Suy diễn ngoài luồng</option>
                        </select>
                      </div>

                      <div className="flex items-center gap-4 pt-6">
                        <label className="flex items-center gap-1.5 cursor-pointer">
                          <input
                            type="checkbox"
                            checked={evalEvidenceMissing}
                            onChange={(e) => setEvalEvidenceMissing(e.target.checked)}
                            className="rounded text-[#0f2942]"
                          />
                          <span className="font-medium text-slate-700">Thiếu bằng chứng</span>
                        </label>

                        <label className="flex items-center gap-1.5 cursor-pointer">
                          <input
                            type="checkbox"
                            checked={evalModeFit}
                            onChange={(e) => setEvalModeFit(e.target.checked)}
                            className="rounded text-[#0f2942]"
                          />
                          <span className="font-medium text-slate-700">Đúng định dạng chế độ</span>
                        </label>
                      </div>
                    </div>

                    <div>
                      <label className="font-semibold text-slate-700 block mb-1">Ghi chú nhận xét của quản trị viên:</label>
                      <textarea
                        rows={2}
                        placeholder="Nhận xét chi tiết về câu trả lời..."
                        value={evalNotes}
                        onChange={(e) => setEvalNotes(e.target.value)}
                        className="w-full p-2 rounded-lg border border-amber-200 bg-white"
                      />
                    </div>

                    <div className="flex justify-end">
                      <button
                        type="submit"
                        disabled={submittingEval}
                        className="px-4 py-2 rounded-xl bg-[#0f2942] text-white text-xs font-semibold hover:bg-[#1e3a5f] disabled:opacity-50 cursor-pointer"
                      >
                        {submittingEval ? 'Đang lưu...' : 'Lưu đánh giá thủ công'}
                      </button>
                    </div>
                  </form>
                </div>

                {/* Modal Footer */}
                <div className="p-3 border-t border-[#e8e2d5] bg-[#fbf9f4] flex justify-end">
                  <button
                    onClick={() => {
                      setSelectedTraceId(null);
                      setTraceDetail(null);
                    }}
                    className="px-4 py-2 rounded-xl bg-slate-200 hover:bg-slate-300 text-slate-800 text-xs font-semibold cursor-pointer"
                  >
                    Đóng
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* VIEW 5: BENCHMARKS */}
      {activeSubTab === 'benchmarks' && (
        <div className="space-y-6">
          {/* Test sets selector and creator */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Create test set */}
            <div className="bg-white p-5 rounded-2xl border border-[#e8e2d5] shadow-2xs space-y-4">
              <h3 className="text-sm font-bold text-[#0f2942] flex items-center gap-2">
                <Award className="w-4 h-4 text-amber-600" />
                Tạo bộ câu hỏi chuẩn (Golden Test Set)
              </h3>
              <form onSubmit={handleCreateTestSet} className="space-y-3 text-xs">
                <div>
                  <label className="font-semibold text-slate-700 block mb-1">Tên bộ đề:</label>
                  <input
                    type="text"
                    placeholder="Ví dụ: Đề chuẩn Vợ nhặt - Học kỳ 2"
                    value={newTestSetName}
                    onChange={(e) => setNewTestSetName(e.target.value)}
                    className="w-full p-2.5 rounded-xl border border-[#e8e2d5] bg-[#fbf9f4]"
                    required
                  />
                </div>
                <div>
                  <label className="font-semibold text-slate-700 block mb-1">Mô tả mục tiêu:</label>
                  <textarea
                    rows={2}
                    placeholder="Mục tiêu đánh giá độ chính xác và khả năng từ chối khi thiếu nguồn..."
                    value={newTestSetDesc}
                    onChange={(e) => setNewTestSetDesc(e.target.value)}
                    className="w-full p-2.5 rounded-xl border border-[#e8e2d5] bg-[#fbf9f4]"
                  />
                </div>
                <button
                  type="submit"
                  className="w-full py-2.5 rounded-xl bg-[#0f2942] text-white font-semibold hover:bg-[#1e3a5f]"
                >
                  + Thêm bộ đề
                </button>
              </form>
            </div>

            {/* Test set list */}
            <div className="lg:col-span-2 bg-white p-5 rounded-2xl border border-[#e8e2d5] shadow-2xs space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-bold text-[#0f2942]">Danh sách bộ đề chuẩn</h3>
                <span className="text-xs text-slate-500 font-semibold">{testSets.length} bộ đề</span>
              </div>

              <div className="space-y-2">
                {testSets.map((ts) => (
                  <div
                    key={ts.id}
                    className={`p-3.5 rounded-xl border text-xs flex flex-col sm:flex-row sm:items-center justify-between gap-3 ${
                      selectedTestSetId === ts.id
                        ? 'bg-amber-50/70 border-amber-300'
                        : 'bg-white border-[#e8e2d5]'
                    }`}
                  >
                    <div>
                      <span className="font-bold text-[#0f2942] text-sm block">{ts.name}</span>
                      <p className="text-slate-500 text-[11px] mt-0.5">{ts.description || 'Không có mô tả'}</p>
                      <span className="text-[10px] text-slate-400 mt-1 block">
                        Số ca kiểm thử: <strong>{ts.case_count ?? 0} ca</strong>
                      </span>
                    </div>

                    <div className="flex items-center gap-2 shrink-0">
                      <button
                        onClick={() => {
                          setSelectedTestSetId(ts.id);
                          setShowAddTestCaseModal(true);
                        }}
                        className="px-3 py-1.5 rounded-xl border border-slate-300 bg-white hover:bg-slate-50 text-slate-700 font-semibold cursor-pointer"
                      >
                        + Thêm ca hỏi
                      </button>
                      <button
                        onClick={() => handleRunBenchmark(ts.id)}
                        disabled={runningBenchmark}
                        className="px-3.5 py-1.5 rounded-xl bg-emerald-700 hover:bg-emerald-800 text-white font-semibold flex items-center gap-1 cursor-pointer disabled:opacity-50"
                      >
                        {runningBenchmark ? (
                          <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                        ) : (
                          <Play className="w-3.5 h-3.5 fill-white" />
                        )}
                        <span>Chạy Benchmark</span>
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Benchmark Runs Table */}
          <div className="bg-white p-5 rounded-2xl border border-[#e8e2d5] shadow-2xs space-y-4">
            <h3 className="text-sm font-bold text-[#0f2942] flex items-center gap-2">
              <BarChart3 className="w-4 h-4 text-amber-600" />
              Lịch sử các lần chạy Benchmark & So sánh
            </h3>
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead>
                  <tr className="border-b border-[#e8e2d5] bg-[#fbf9f4] text-slate-600 font-semibold">
                    <th className="py-2.5 px-3">Thời gian</th>
                    <th className="py-2.5 px-3">Bộ đề</th>
                    <th className="py-2.5 px-3">Cấu hình Mô hình</th>
                    <th className="py-2.5 px-3">Số ca hoàn thành</th>
                    <th className="py-2.5 px-3">Tỷ lệ chính xác</th>
                    <th className="py-2.5 px-3">Token TB</th>
                    <th className="py-2.5 px-3">Độ trễ TB</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {runs.length === 0 ? (
                    <tr>
                      <td colSpan={7} className="py-8 text-center text-slate-400 italic">
                        Chưa có lượt chạy benchmark nào. Hãy chọn bộ đề và bấm "Chạy Benchmark".
                      </td>
                    </tr>
                  ) : (
                    runs.map((r) => (
                      <tr key={r.id} className="hover:bg-slate-50/60">
                        <td className="py-2.5 px-3 text-slate-500 whitespace-nowrap">
                          {new Date(r.created_at).toLocaleString('vi-VN')}
                        </td>
                        <td className="py-2.5 px-3 font-semibold text-[#0f2942]">{r.testset_name || 'N/A'}</td>
                        <td className="py-2.5 px-3 font-mono text-slate-600">{r.model_used || 'Gemini'}</td>
                        <td className="py-2.5 px-3">
                          {r.completed_cases} / {r.total_cases}
                        </td>
                        <td className="py-2.5 px-3 font-bold text-emerald-700">
                          {r.accuracy_rate !== null ? `${r.accuracy_rate}%` : 'N/A'}
                        </td>
                        <td className="py-2.5 px-3 font-mono text-slate-600">
                          {r.avg_prompt_tokens ? Math.round(r.avg_prompt_tokens) : 'N/A'}
                        </td>
                        <td className="py-2.5 px-3 text-slate-600">
                          {r.avg_latency_ms ? `${(r.avg_latency_ms / 1000).toFixed(2)}s` : 'N/A'}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>

          {/* Add Test Case Modal */}
          {showAddTestCaseModal && (
            <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-3 sm:p-4 backdrop-blur-xs">
              <div className="max-w-xl w-full bg-white rounded-2xl shadow-2xl flex flex-col overflow-hidden border border-[#e8e2d5]">
                <div className="p-4 border-b border-[#e8e2d5] flex items-center justify-between bg-[#fbf9f4]">
                  <h3 className="text-sm font-bold text-[#0f2942]">Thêm ca kiểm thử vào bộ đề</h3>
                  <button onClick={() => setShowAddTestCaseModal(false)} className="text-slate-400 hover:text-slate-700">
                    <X className="w-5 h-5" />
                  </button>
                </div>
                <form onSubmit={handleAddTestCase} className="p-4 space-y-3 text-xs">
                  <div>
                    <label className="font-semibold text-slate-700 block mb-1">Tác phẩm:</label>
                    <select
                      value={tcWorkId}
                      onChange={(e) => setTcWorkId(e.target.value)}
                      className="w-full p-2.5 rounded-xl border border-[#e8e2d5] bg-[#fbf9f4]"
                    >
                      {works.map((w) => (
                        <option key={w.id} value={w.id}>
                          {w.title} ({w.author})
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="font-semibold text-slate-700 block mb-1">Câu hỏi mẫu:</label>
                    <textarea
                      rows={2}
                      placeholder="Câu hỏi cần kiểm tra..."
                      value={tcQuestion}
                      onChange={(e) => setTcQuestion(e.target.value)}
                      className="w-full p-2.5 rounded-xl border border-[#e8e2d5] bg-[#fbf9f4]"
                      required
                    />
                  </div>

                  <div>
                    <label className="font-semibold text-slate-700 block mb-1">Các đoạn bằng chứng chấp nhận (mỗi dòng 1 đoạn):</label>
                    <textarea
                      rows={2}
                      placeholder="Dẫn chứng nguyên tác mong đợi..."
                      value={tcEvidence}
                      onChange={(e) => setTcEvidence(e.target.value)}
                      className="w-full p-2.5 rounded-xl border border-[#e8e2d5] bg-[#fbf9f4]"
                    />
                  </div>

                  <div>
                    <label className="font-semibold text-slate-700 block mb-1">Luận điểm cần có (mỗi dòng 1 ý):</label>
                    <textarea
                      rows={2}
                      placeholder="Ý phân tích cần có..."
                      value={tcPoints}
                      onChange={(e) => setTcPoints(e.target.value)}
                      className="w-full p-2.5 rounded-xl border border-[#e8e2d5] bg-[#fbf9f4]"
                    />
                  </div>

                  <div className="flex items-center gap-2 pt-1">
                    <input
                      type="checkbox"
                      id="tcRefuse"
                      checked={tcShouldRefuse}
                      onChange={(e) => setTcShouldRefuse(e.target.checked)}
                      className="rounded text-[#0f2942]"
                    />
                    <label htmlFor="tcRefuse" className="font-semibold text-slate-700 cursor-pointer">
                      Ca này kỳ vọng hệ thống <strong>Từ chối / Báo thiếu nguồn</strong>
                    </label>
                  </div>

                  <div className="pt-2 flex justify-end gap-2">
                    <button
                      type="button"
                      onClick={() => setShowAddTestCaseModal(false)}
                      className="px-4 py-2 rounded-xl border border-slate-300 text-slate-700"
                    >
                      Hủy
                    </button>
                    <button
                      type="submit"
                      disabled={creatingTestCase}
                      className="px-4 py-2 rounded-xl bg-[#0f2942] text-white font-semibold hover:bg-[#1e3a5f]"
                    >
                      {creatingTestCase ? 'Đang thêm...' : 'Lưu ca kiểm thử'}
                    </button>
                  </div>
                </form>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
};
