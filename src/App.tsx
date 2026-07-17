import React, { useState, useEffect, useRef } from "react";
import {
  FileText,
  Upload,
  Trash2,
  Calendar,
  Award,
  CheckCircle,
  AlertCircle,
  Briefcase,
  User,
  Sparkles,
  ArrowLeft,
  Search,
  Loader2,
  Info,
  ExternalLink,
  RefreshCw,
  Eye,
  HelpCircle
} from "lucide-react";
import { Analysis, HistoryItem, Suggestion } from "./types";

export default function App() {
  // Views: 'dashboard', 'report'
  const [currentView, setCurrentView] = useState<"dashboard" | "report">("dashboard");
  
  // History lists
  const [history, setHistory] = useState<HistoryItem[]>([]);
  const [historyLoading, setHistoryLoading] = useState(true);
  const [historyError, setHistoryError] = useState("");

  // Search/Filter in history
  const [searchQuery, setSearchQuery] = useState("");

  // Analysis Inputs
  const [jobDescription, setJobDescription] = useState("");
  const [resumeText, setResumeText] = useState("");
  const [resumeFile, setResumeFile] = useState<File | null>(null);
  const [inputMode, setInputMode] = useState<"file" | "text">("file");
  const [dragOver, setDragOver] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Active / Selected Report
  const [selectedAnalysis, setSelectedAnalysis] = useState<Analysis | null>(null);
  const [analysisLoading, setAnalysisLoading] = useState(false);
  const [analysisStatus, setAnalysisStatus] = useState("");
  const [analysisError, setAnalysisError] = useState("");

  // Industry Trends Grounding state
  const [industryTrendsInput, setIndustryTrendsInput] = useState("");
  const [industryTrendsResult, setIndustryTrendsResult] = useState<{ text: string; sources: any[] } | null>(null);
  const [trendsLoading, setTrendsLoading] = useState(false);
  const [trendsError, setTrendsError] = useState("");

  // Selected Tab inside Report details
  const [reportTab, setReportTab] = useState<"breakdown" | "suggestions" | "trends" | "raw">("breakdown");

  // Load history list on startup
  useEffect(() => {
    fetchHistory();
  }, []);

  const fetchHistory = async () => {
    setHistoryLoading(true);
    setHistoryError("");
    try {
      const res = await fetch("/api/history");
      if (!res.ok) {
        throw new Error(`Failed to fetch history list. Status: ${res.status}`);
      }
      const data = await res.json();
      setHistory(data);
    } catch (err: any) {
      console.error(err);
      setHistoryError(err.message || "Could not load history list.");
    } finally {
      setHistoryLoading(false);
    }
  };

  const deleteHistoryItem = async (id: number, e: React.MouseEvent) => {
    e.stopPropagation(); // Avoid selecting item
    if (!confirm("Are you sure you want to remove this resume analysis from history?")) {
      return;
    }
    try {
      const res = await fetch(`/api/history/${id}`, { method: "DELETE" });
      if (!res.ok) {
        throw new Error("Failed to delete analysis record.");
      }
      setHistory(prev => prev.filter(item => item.id !== id));
      if (selectedAnalysis?.id === id) {
        setSelectedAnalysis(null);
        setCurrentView("dashboard");
      }
    } catch (err: any) {
      alert(err.message || "Could not delete history record.");
    }
  };

  const selectHistoryItem = async (id: number) => {
    setAnalysisLoading(true);
    setAnalysisError("");
    try {
      const res = await fetch(`/api/history/${id}`);
      if (!res.ok) {
        throw new Error(`Failed to load analysis detail. Status: ${res.status}`);
      }
      const data = await res.json();
      setSelectedAnalysis(data);
      // Auto-populate trends input
      setIndustryTrendsInput(data.jobTitle || "");
      setIndustryTrendsResult(null);
      setReportTab("breakdown");
      setCurrentView("report");
    } catch (err: any) {
      console.error(err);
      alert(err.message || "Failed to load detailed report.");
    } finally {
      setAnalysisLoading(false);
    }
  };

  // Drag and Drop handlers
  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(true);
  };

  const handleDragLeave = () => {
    setDragOver(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
    const files = e.dataTransfer.files;
    if (files && files.length > 0) {
      validateAndSetFile(files[0]);
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (files && files.length > 0) {
      validateAndSetFile(files[0]);
    }
  };

  const validateAndSetFile = (file: File) => {
    const ext = file.name.split(".").pop()?.toLowerCase();
    if (!["pdf", "docx", "doc", "txt"].includes(ext || "")) {
      alert("Unsupported file type. Please upload a .pdf, .docx, or .txt resume file.");
      return;
    }
    if (file.size > 10 * 1024 * 1024) {
      alert("File size exceeds 10MB limit.");
      return;
    }
    setResumeFile(file);
    setInputMode("file");
  };

  // Handle Submission / Analyzer
  const handleAnalyze = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!jobDescription.trim()) {
      alert("Please paste or type the job description first.");
      return;
    }
    if (inputMode === "file" && !resumeFile) {
      alert("Please upload a resume file (.pdf, .docx, .txt).");
      return;
    }
    if (inputMode === "text" && !resumeText.trim()) {
      alert("Please paste the resume text in the field.");
      return;
    }

    setAnalysisLoading(true);
    setAnalysisError("");
    
    // Status animation text sequences
    const statuses = [
      "Uploading resume content...",
      "Reading file and extracting raw text...",
      "Comparing text metrics to job requirements...",
      "Extracting resume skills & semantic keywords...",
      "Benchmarking candidate qualifications...",
      "Compiling tailored resume improvements...",
      "Finalizing ATS scoring metric..."
    ];
    
    let statusIndex = 0;
    setAnalysisStatus(statuses[statusIndex]);
    const statusInterval = setInterval(() => {
      if (statusIndex < statuses.length - 1) {
        statusIndex++;
        setAnalysisStatus(statuses[statusIndex]);
      }
    }, 1500);

    try {
      const formData = new FormData();
      formData.append("jobDescription", jobDescription);
      
      if (inputMode === "file" && resumeFile) {
        formData.append("resumeFile", resumeFile);
      } else {
        formData.append("resumeText", resumeText);
      }

      const res = await fetch("/api/analyze", {
        method: "POST",
        body: formData,
      });

      clearInterval(statusInterval);

      if (!res.ok) {
        let errMsg = "Analysis request failed.";
        try {
          const errData = await res.json();
          errMsg = errData.error || errMsg;
        } catch (parseErr) {
          const text = await res.text().catch(() => "");
          if (text.includes("<!doctype html>") || text.includes("<html")) {
            errMsg = `Server Error (${res.status}): Please check the server logs or try again.`;
          } else {
            errMsg = text || `Server Error (${res.status})`;
          }
        }
        throw new Error(errMsg);
      }

      const result: Analysis = await res.json();
      setSelectedAnalysis(result);
      setIndustryTrendsInput(result.jobTitle || "");
      setIndustryTrendsResult(null);
      setReportTab("breakdown");
      setCurrentView("report");
      
      // Refresh list
      fetchHistory();

      // Clear fields on successful analyze
      setResumeFile(null);
      setResumeText("");
      setJobDescription("");
    } catch (err: any) {
      clearInterval(statusInterval);
      console.error(err);
      setAnalysisError(err.message || "An error occurred during resume analysis.");
    } finally {
      setAnalysisLoading(false);
      setAnalysisStatus("");
    }
  };

  // Google Search grounded trends retrieval
  const handleFetchTrends = async () => {
    if (!industryTrendsInput.trim()) return;
    setTrendsLoading(true);
    setTrendsError("");
    try {
      const res = await fetch("/api/industry-trends", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ jobTitle: industryTrendsInput }),
      });
      if (!res.ok) {
        let errMsg = "Failed to retrieve trends.";
        try {
          const errData = await res.json();
          errMsg = errData.error || errMsg;
        } catch (parseErr) {
          const text = await res.text().catch(() => "");
          if (text.includes("<!doctype html>") || text.includes("<html")) {
            errMsg = `Server Error (${res.status}): Please check the server logs or try again.`;
          } else {
            errMsg = text || `Server Error (${res.status})`;
          }
        }
        throw new Error(errMsg);
      }
      const data = await res.json();
      setIndustryTrendsResult(data);
    } catch (err: any) {
      console.error(err);
      setTrendsError(err.message || "Could not retrieve trend intelligence.");
    } finally {
      setTrendsLoading(false);
    }
  };

  const filteredHistory = history.filter(item => {
    const searchLower = searchQuery.toLowerCase();
    return (
      item.filename.toLowerCase().includes(searchLower) ||
      (item.candidateName || "").toLowerCase().includes(searchLower) ||
      (item.jobTitle || "").toLowerCase().includes(searchLower)
    );
  });

  return (
    <div className="min-h-screen bg-[#0b0f19] text-gray-100 flex flex-col font-sans relative overflow-x-hidden selection:bg-brand-500 selection:text-[#0b0f19]">
      {/* Visual background accents */}
      <div className="absolute top-0 left-1/4 w-[500px] h-[500px] bg-brand-500/10 rounded-full blur-[120px] pointer-events-none -translate-y-1/2"></div>
      <div className="absolute bottom-1/4 right-1/4 w-[600px] h-[600px] bg-emerald-500/5 rounded-full blur-[150px] pointer-events-none"></div>

      {/* Main Header */}
      <header className="border-b border-gray-800 bg-[#0d1425]/80 backdrop-blur-md sticky top-0 z-40 transition-all duration-300">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-brand-500/10 border border-brand-500/30 flex items-center justify-center shadow-[0_0_15px_rgba(34,197,94,0.15)]">
              <Sparkles className="w-5 h-5 text-brand-400" />
            </div>
            <div>
              <h1 className="text-xl font-bold font-display tracking-tight bg-gradient-to-r from-white via-gray-100 to-brand-400 bg-clip-text text-transparent">
                AI Resume Analyzer
              </h1>
              <p className="text-xs text-gray-400 hidden sm:block">Intelligent ATS Compliance Scoring</p>
            </div>
          </div>

          <div className="flex items-center gap-4">
            <div className="text-right hidden md:block">
              <p className="text-xs text-gray-400">Logged in candidate</p>
              <p className="text-sm font-medium text-brand-400 flex items-center gap-1">
                <span className="w-1.5 h-1.5 rounded-full bg-brand-500 animate-pulse"></span>
                Default Candidate
              </p>
            </div>
            <div className="w-9 h-9 rounded-full bg-gray-800 border border-gray-700 flex items-center justify-center">
              <User className="w-4 h-4 text-gray-300" />
            </div>
          </div>
        </div>
      </header>

      {/* Primary Layout Area */}
      <main className="flex-1 max-w-7xl mx-auto w-full px-4 sm:px-6 lg:px-8 py-8 relative">
        
        {/* Loading Overlay */}
        {analysisLoading && (
          <div className="fixed inset-0 bg-[#070a12]/80 backdrop-blur-md flex items-center justify-center z-50 p-4">
            <div className="glass-card max-w-md w-full p-8 rounded-2xl border border-brand-500/30 text-center flex flex-col items-center">
              <div className="relative mb-6">
                <div className="w-16 h-16 rounded-full border-4 border-brand-500/10 border-t-brand-500 animate-spin flex items-center justify-center"></div>
                <Sparkles className="w-6 h-6 text-brand-400 absolute inset-0 m-auto animate-pulse" />
              </div>
              <h3 className="text-lg font-bold font-display text-white mb-2">Analyzing Resume Match</h3>
              <p className="text-sm text-gray-400 min-h-[40px] px-2 leading-relaxed animate-pulse">
                {analysisStatus || "Analyzing alignments..."}
              </p>
              
              <div className="w-full bg-gray-800 h-1.5 rounded-full mt-6 overflow-hidden">
                <div className="bg-brand-500 h-full rounded-full animate-[loading-bar_10s_ease-in-out_infinite]"></div>
              </div>
            </div>
          </div>
        )}

        {currentView === "dashboard" ? (
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
            
            {/* Left side: Upload Form */}
            <section className="lg:col-span-7 flex flex-col gap-6">
              <div className="glass-card rounded-2xl p-6 sm:p-8">
                <div className="flex items-center gap-3 mb-6">
                  <div className="w-8 h-8 rounded-lg bg-emerald-500/10 flex items-center justify-center text-emerald-400">
                    <FileText className="w-4.5 h-4.5" />
                  </div>
                  <div>
                    <h2 className="text-lg font-bold text-white font-display">Scan New Resume</h2>
                    <p className="text-xs text-gray-400">Paste your target job details and submit your resume</p>
                  </div>
                </div>

                {analysisError && (
                  <div className="mb-6 p-4 rounded-xl bg-red-500/10 border border-red-500/20 text-red-300 text-sm flex gap-3 items-start">
                    <AlertCircle className="w-5 h-5 shrink-0 text-red-400 mt-0.5" />
                    <div>
                      <p className="font-semibold">Analysis Failed</p>
                      <p className="text-xs text-red-400/90 leading-relaxed mt-1">{analysisError}</p>
                    </div>
                  </div>
                )}

                <form onSubmit={handleAnalyze} className="flex flex-col gap-6">
                  {/* Job Description block */}
                  <div className="flex flex-col gap-2">
                    <label className="text-xs font-semibold uppercase tracking-wider text-gray-400 flex justify-between items-center">
                      <span>Target Job Description *</span>
                      <span className="text-[10px] text-gray-500 font-normal">Provide full criteria for better scoring</span>
                    </label>
                    <textarea
                      value={jobDescription}
                      onChange={(e) => setJobDescription(e.target.value)}
                      placeholder="Paste the target job description here. Include details about requirements, specific libraries, frameworks, years of experience, and general responsibilities..."
                      rows={6}
                      className="glass-input p-4 rounded-xl text-sm leading-relaxed text-gray-200 placeholder-gray-500 w-full resize-y min-h-[120px]"
                    />
                  </div>

                  {/* Resume Block */}
                  <div className="flex flex-col gap-3">
                    <div className="flex items-center justify-between">
                      <label className="text-xs font-semibold uppercase tracking-wider text-gray-400">
                        Candidate Resume *
                      </label>
                      <div className="flex bg-gray-900 border border-gray-800 p-0.5 rounded-lg text-xs">
                        <button
                          type="button"
                          onClick={() => setInputMode("file")}
                          className={`px-3 py-1 rounded-md font-medium transition-all ${
                            inputMode === "file"
                              ? "bg-brand-500 text-[#0b0f19] shadow-sm"
                              : "text-gray-400 hover:text-white"
                          }`}
                        >
                          Upload File
                        </button>
                        <button
                          type="button"
                          onClick={() => setInputMode("text")}
                          className={`px-3 py-1 rounded-md font-medium transition-all ${
                            inputMode === "text"
                              ? "bg-brand-500 text-[#0b0f19] shadow-sm"
                              : "text-gray-400 hover:text-white"
                          }`}
                        >
                          Paste Text
                        </button>
                      </div>
                    </div>

                    {inputMode === "file" ? (
                      <div
                        onDragOver={handleDragOver}
                        onDragLeave={handleDragLeave}
                        onDrop={handleDrop}
                        onClick={() => fileInputRef.current?.click()}
                        className={`border-2 border-dashed rounded-xl p-8 text-center cursor-pointer transition-all flex flex-col items-center justify-center min-h-[180px] ${
                          dragOver
                            ? "border-brand-500 bg-brand-500/5 shadow-[0_0_20px_rgba(34,197,94,0.05)]"
                            : resumeFile
                            ? "border-emerald-500/50 bg-emerald-500/5"
                            : "border-gray-800 hover:border-gray-700 hover:bg-gray-800/10"
                        }`}
                      >
                        <input
                          type="file"
                          ref={fileInputRef}
                          onChange={handleFileChange}
                          accept=".pdf,.docx,.doc,.txt"
                          className="hidden"
                        />
                        {resumeFile ? (
                          <div className="flex flex-col items-center gap-2">
                            <div className="w-12 h-12 rounded-xl bg-emerald-500/15 border border-emerald-500/30 flex items-center justify-center mb-1">
                              <FileText className="w-6 h-6 text-emerald-400" />
                            </div>
                            <p className="text-sm font-semibold text-white max-w-xs truncate px-4">
                              {resumeFile.name}
                            </p>
                            <p className="text-xs text-gray-400">
                              {(resumeFile.size / 1024 / 1024).toFixed(2)} MB • Click or drag to change
                            </p>
                          </div>
                        ) : (
                          <div className="flex flex-col items-center gap-2">
                            <div className="w-12 h-12 rounded-xl bg-gray-800/80 border border-gray-700/50 flex items-center justify-center mb-1 text-gray-400">
                              <Upload className="w-5 h-5" />
                            </div>
                            <p className="text-sm font-semibold text-gray-200">
                              Drag & drop your resume file here
                            </p>
                            <p className="text-xs text-gray-500 max-w-sm leading-relaxed">
                              Supports PDF, DOCX, and TXT files (Max 10MB) or click to browse local files
                            </p>
                          </div>
                        )}
                      </div>
                    ) : (
                      <textarea
                        value={resumeText}
                        onChange={(e) => setResumeText(e.target.value)}
                        placeholder="Paste the full text content from your resume here..."
                        rows={7}
                        className="glass-input p-4 rounded-xl text-sm leading-relaxed text-gray-200 placeholder-gray-500 w-full resize-y min-h-[140px]"
                      />
                    )}
                  </div>

                  <button
                    type="submit"
                    className="w-full bg-brand-500 hover:bg-brand-400 text-[#0b0f19] font-bold py-3.5 px-6 rounded-xl transition-all duration-300 transform active:scale-95 shadow-[0_4px_20px_rgba(34,197,94,0.25)] flex items-center justify-center gap-2 text-sm cursor-pointer"
                  >
                    <Sparkles className="w-4 h-4 text-[#0b0f19] fill-current" />
                    Analyze Alignment
                  </button>
                </form>
              </div>
            </section>

            {/* Right side: Dashboard History list */}
            <section className="lg:col-span-5 flex flex-col gap-6">
              <div className="glass-card rounded-2xl p-6">
                <div className="flex items-center justify-between mb-4">
                  <div className="flex items-center gap-2.5">
                    <div className="w-7 h-7 rounded-lg bg-brand-500/10 flex items-center justify-center text-brand-400">
                      <Calendar className="w-4 h-4" />
                    </div>
                    <h2 className="text-base font-bold text-white font-display">Analysis History</h2>
                  </div>
                  <button
                    onClick={fetchHistory}
                    disabled={historyLoading}
                    className="text-gray-400 hover:text-brand-400 p-1.5 rounded-lg hover:bg-gray-800 transition-all cursor-pointer"
                    title="Refresh History"
                  >
                    <RefreshCw className={`w-4 h-4 ${historyLoading ? "animate-spin" : ""}`} />
                  </button>
                </div>

                {/* Filter input */}
                <div className="relative mb-4">
                  <Search className="absolute left-3 top-2.5 w-4 h-4 text-gray-500" />
                  <input
                    type="text"
                    placeholder="Search candidate name or role..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="glass-input pl-9 pr-4 py-2 w-full rounded-xl text-xs placeholder-gray-500 text-gray-200"
                  />
                </div>

                {historyLoading ? (
                  <div className="py-12 flex flex-col items-center gap-3 text-gray-500 text-xs">
                    <Loader2 className="w-5 h-5 text-brand-400 animate-spin" />
                    <p>Loading candidate records...</p>
                  </div>
                ) : historyError ? (
                  <div className="p-4 bg-red-500/10 border border-red-500/20 rounded-xl text-center text-xs text-red-400">
                    <p>Failed to retrieve records: {historyError}</p>
                  </div>
                ) : filteredHistory.length === 0 ? (
                  <div className="py-12 text-center rounded-xl border border-gray-800 border-dashed text-gray-500 px-4">
                    <Info className="w-7 h-7 text-gray-600 mx-auto mb-2.5" />
                    <p className="text-xs font-semibold text-gray-400">No matching analyses</p>
                    <p className="text-[11px] text-gray-500 mt-1 leading-relaxed">
                      {searchQuery ? "Try adjusting your search filter." : "Scan a resume to see history list entries."}
                    </p>
                  </div>
                ) : (
                  <div className="flex flex-col gap-3 max-h-[480px] overflow-y-auto pr-1">
                    {filteredHistory.map((item) => {
                      const date = new Date(item.createdAt);
                      const formattedDate = date.toLocaleDateString("en-US", {
                        month: "short",
                        day: "numeric",
                        year: "numeric"
                      });

                      // Color based on ATS Score
                      const scoreColor = 
                        item.atsScore >= 80 
                          ? "bg-brand-500/10 text-brand-400 border-brand-500/20" 
                          : item.atsScore >= 50 
                          ? "bg-amber-500/10 text-amber-400 border-amber-500/20" 
                          : "bg-rose-500/10 text-rose-400 border-rose-500/20";

                      return (
                        <div
                          key={item.id}
                          onClick={() => selectHistoryItem(item.id)}
                          className="p-3.5 bg-gray-900/40 rounded-xl border border-gray-800/80 hover:border-brand-500/20 hover:bg-gray-900/75 cursor-pointer transition-all flex items-center justify-between group"
                        >
                          <div className="flex items-start gap-3 min-w-0 flex-1">
                            {/* Circle Score indicator */}
                            <div className={`w-10 h-10 rounded-xl border shrink-0 flex flex-col items-center justify-center font-display ${scoreColor}`}>
                              <span className="text-xs font-bold leading-none">{item.atsScore}</span>
                              <span className="text-[7px] uppercase tracking-wider font-semibold opacity-75 mt-0.5">ATS</span>
                            </div>

                            <div className="min-w-0 flex-1">
                              <h4 className="text-xs font-bold text-white truncate font-display group-hover:text-brand-400 transition-colors">
                                {item.candidateName || "Unknown Candidate"}
                              </h4>
                              <p className="text-[11px] text-gray-300 truncate mt-0.5 flex items-center gap-1.5">
                                <Briefcase className="w-3 h-3 shrink-0 text-gray-500" />
                                {item.jobTitle || "Not Specified"}
                              </p>
                              <div className="flex items-center gap-2 mt-1.5 text-[9px] text-gray-500">
                                <span>{formattedDate}</span>
                                <span>•</span>
                                <span className="truncate max-w-[150px]">{item.filename}</span>
                              </div>
                            </div>
                          </div>

                          <div className="flex items-center gap-1.5 shrink-0 pl-2">
                            <button
                              onClick={(e) => deleteHistoryItem(item.id, e)}
                              className="text-gray-600 hover:text-red-400 p-1.5 rounded-lg hover:bg-gray-800 transition-all cursor-pointer opacity-0 group-hover:opacity-100 focus:opacity-100"
                              title="Delete Record"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                            <span className="text-[10px] text-gray-400 group-hover:text-brand-400 font-semibold group-hover:translate-x-0.5 transition-all">
                              View
                            </span>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            </section>
          </div>
        ) : (
          /* Report details screen */
          <div className="flex flex-col gap-6 animate-fade-in">
            {/* Header / Back navigation */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-gray-800 pb-5">
              <div className="flex items-start gap-3.5">
                <button
                  onClick={() => setCurrentView("dashboard")}
                  className="mt-1 p-2 bg-gray-900 border border-gray-800 hover:border-gray-700 text-gray-400 hover:text-white rounded-xl transition-all cursor-pointer shadow-sm shrink-0"
                  title="Back to Dashboard"
                >
                  <ArrowLeft className="w-4 h-4" />
                </button>
                <div>
                  <div className="flex items-center gap-2 flex-wrap">
                    <h2 className="text-xl font-bold text-white font-display tracking-tight">
                      {selectedAnalysis?.candidateName || "Candidate Analysis Report"}
                    </h2>
                    <span className="text-[10px] bg-brand-500/10 text-brand-400 border border-brand-500/20 px-2 py-0.5 rounded-md font-semibold uppercase tracking-wider">
                      Processed
                    </span>
                  </div>
                  <div className="flex items-center gap-3 text-xs text-gray-400 mt-1 flex-wrap">
                    <span className="flex items-center gap-1 text-gray-300">
                      <Briefcase className="w-3.5 h-3.5 text-gray-500" />
                      {selectedAnalysis?.jobTitle}
                    </span>
                    <span>•</span>
                    <span className="flex items-center gap-1">
                      <FileText className="w-3.5 h-3.5 text-gray-500" />
                      {selectedAnalysis?.filename}
                    </span>
                    <span>•</span>
                    <span className="flex items-center gap-1">
                      <Calendar className="w-3.5 h-3.5 text-gray-500" />
                      {selectedAnalysis && new Date(selectedAnalysis.createdAt).toLocaleString()}
                    </span>
                  </div>
                </div>
              </div>

              <div className="flex items-center gap-3">
                <button
                  onClick={() => deleteHistoryItem(selectedAnalysis?.id!, { stopPropagation: () => {} } as any)}
                  className="bg-red-500/10 border border-red-500/20 hover:bg-red-500/20 text-red-400 text-xs font-semibold py-2 px-3.5 rounded-xl transition-all cursor-pointer flex items-center gap-1.5"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                  Delete Report
                </button>
              </div>
            </div>

            {/* Main Score panel & KPI grid */}
            <div className="grid grid-cols-1 md:grid-cols-12 gap-6">
              
              {/* ATS Circle Score widget */}
              <div className="md:col-span-4 glass-card rounded-2xl p-6 flex flex-col items-center justify-center text-center relative overflow-hidden">
                <div className="absolute top-0 right-0 w-24 h-24 bg-brand-500/10 rounded-full blur-2xl pointer-events-none"></div>
                
                <h3 className="text-xs font-semibold uppercase tracking-wider text-gray-400 mb-6">
                  ATS Alignment Rating
                </h3>

                {/* Score wheel SVG */}
                <div className="relative w-40 h-40 flex items-center justify-center">
                  <svg className="w-full h-full -rotate-90">
                    <circle
                      cx="80"
                      cy="80"
                      r="68"
                      className="stroke-gray-800 fill-none"
                      strokeWidth="10"
                    />
                    <circle
                      cx="80"
                      cy="80"
                      r="68"
                      className="stroke-brand-500 fill-none transition-all duration-1000 ease-out"
                      strokeWidth="10"
                      strokeDasharray={`${2 * Math.PI * 68}`}
                      strokeDashoffset={`${2 * Math.PI * 68 * (1 - (selectedAnalysis?.atsScore || 0) / 100)}`}
                      strokeLinecap="round"
                    />
                  </svg>
                  <div className="absolute flex flex-col items-center justify-center">
                    <span className="text-4xl font-extrabold font-display text-white tracking-tight">
                      {selectedAnalysis?.atsScore}
                    </span>
                    <span className="text-[10px] text-gray-400 font-semibold uppercase tracking-wider mt-0.5">
                      ATS Index
                    </span>
                  </div>
                </div>

                {/* Verdict text based on rating */}
                <div className="mt-6">
                  <h4 className={`text-base font-bold font-display ${
                    (selectedAnalysis?.atsScore || 0) >= 80 
                      ? "text-brand-400" 
                      : (selectedAnalysis?.atsScore || 0) >= 60 
                      ? "text-amber-400" 
                      : "text-rose-400"
                  }`}>
                    {(selectedAnalysis?.atsScore || 0) >= 85 
                      ? "Excellent Candidate Match" 
                      : (selectedAnalysis?.atsScore || 0) >= 70 
                      ? "Strong Professional Potential" 
                      : (selectedAnalysis?.atsScore || 0) >= 50 
                      ? "Moderate Match (Refining Needed)" 
                      : "High Mismatch Risk"}
                  </h4>
                  <p className="text-xs text-gray-400 mt-1 px-4 leading-relaxed">
                    {(selectedAnalysis?.atsScore || 0) >= 70 
                      ? "The candidate shows major skill synergies. Proceed to screening call." 
                      : "Consider addressing missing keywords to prevent automatic filter deletion."}
                  </p>
                </div>
              </div>

              {/* General Highlights Bento section */}
              <div className="md:col-span-8 grid grid-cols-1 sm:grid-cols-2 gap-4">
                
                {/* Stats cards */}
                <div className="p-5 bg-emerald-500/5 rounded-2xl border border-emerald-500/10 flex flex-col justify-between">
                  <div>
                    <div className="w-8 h-8 rounded-lg bg-emerald-500/10 flex items-center justify-center text-emerald-400 mb-3">
                      <CheckCircle className="w-4.5 h-4.5" />
                    </div>
                    <h4 className="text-2xl font-extrabold text-white font-display">
                      {selectedAnalysis?.matchedSkills.length}
                    </h4>
                    <p className="text-xs font-semibold text-emerald-400 mt-1 uppercase tracking-wider">
                      Identified Strengths
                    </p>
                  </div>
                  <p className="text-[11px] text-gray-400 leading-relaxed mt-4">
                    Key required qualifications, tools, and experience variables found within the candidate resume.
                  </p>
                </div>

                <div className="p-5 bg-rose-500/5 rounded-2xl border border-rose-500/10 flex flex-col justify-between">
                  <div>
                    <div className="w-8 h-8 rounded-lg bg-rose-500/10 flex items-center justify-center text-rose-400 mb-3">
                      <AlertCircle className="w-4.5 h-4.5" />
                    </div>
                    <h4 className="text-2xl font-extrabold text-white font-display">
                      {selectedAnalysis?.missingSkills.length}
                    </h4>
                    <p className="text-xs font-semibold text-rose-400 mt-1 uppercase tracking-wider">
                      Critical Skill Gaps
                    </p>
                  </div>
                  <p className="text-[11px] text-gray-400 leading-relaxed mt-4">
                    Requirements specified by the job post that are currently missing or insufficiently contextualized.
                  </p>
                </div>

                <div className="sm:col-span-2 p-5 bg-gray-900/40 rounded-2xl border border-gray-800 flex items-center gap-4">
                  <div className="w-10 h-10 rounded-xl bg-brand-500/10 flex items-center justify-center shrink-0">
                    <Award className="w-5 h-5 text-brand-400" />
                  </div>
                  <div>
                    <h4 className="text-xs font-semibold text-white font-display uppercase tracking-wider">
                      Target Role Category Match
                    </h4>
                    <p className="text-sm text-brand-400 font-semibold mt-0.5">
                      {selectedAnalysis?.jobTitle}
                    </p>
                    <p className="text-[11px] text-gray-400 mt-1 leading-relaxed">
                      This rating reflects technical alignment score mapped against standard marketplace expectations for this tier.
                    </p>
                  </div>
                </div>

              </div>

            </div>

            {/* Inner Tabs Menu */}
            <div className="flex border-b border-gray-800 mt-4 text-xs font-semibold">
              <button
                onClick={() => setReportTab("breakdown")}
                className={`py-3 px-5 border-b-2 cursor-pointer transition-all ${
                  reportTab === "breakdown" 
                    ? "border-brand-500 text-brand-400" 
                    : "border-transparent text-gray-400 hover:text-white"
                }`}
              >
                Skills Alignment Map
              </button>
              <button
                onClick={() => setReportTab("suggestions")}
                className={`py-3 px-5 border-b-2 cursor-pointer transition-all ${
                  reportTab === "suggestions" 
                    ? "border-brand-500 text-brand-400" 
                    : "border-transparent text-gray-400 hover:text-white"
                }`}
              >
                ATS Content Suggestions ({selectedAnalysis?.suggestions.length})
              </button>
              <button
                onClick={() => setReportTab("trends")}
                className={`py-3 px-5 border-b-2 cursor-pointer transition-all flex items-center gap-1.5 ${
                  reportTab === "trends" 
                    ? "border-brand-500 text-brand-400" 
                    : "border-transparent text-gray-400 hover:text-white"
                }`}
              >
                <Sparkles className="w-3.5 h-3.5 text-brand-400" />
                Industry Trends Search
              </button>
              <button
                onClick={() => setReportTab("raw")}
                className={`py-3 px-5 border-b-2 cursor-pointer transition-all ${
                  reportTab === "raw" 
                    ? "border-brand-500 text-brand-400" 
                    : "border-transparent text-gray-400 hover:text-white"
                }`}
              >
                Original Text Comparison
              </button>
            </div>

            {/* Tab content screens */}
            <div className="min-h-[300px]">
              
              {/* Tab: Breakdown */}
              {reportTab === "breakdown" && (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6 animate-fade-in">
                  
                  {/* Matched Skills card */}
                  <div className="glass-card rounded-2xl p-6">
                    <div className="flex items-center gap-2 mb-4 text-brand-400 border-b border-gray-800/50 pb-3">
                      <CheckCircle className="w-4.5 h-4.5 shrink-0" />
                      <h3 className="font-bold text-white font-display text-sm uppercase tracking-wider">
                        Matching Resume Skills ({selectedAnalysis?.matchedSkills.length})
                      </h3>
                    </div>
                    {selectedAnalysis?.matchedSkills && selectedAnalysis.matchedSkills.length > 0 ? (
                      <div className="flex flex-wrap gap-2">
                        {selectedAnalysis.matchedSkills.map((skill, index) => (
                          <span
                            key={index}
                            className="bg-brand-500/10 text-brand-400 border border-brand-500/15 px-3 py-1 rounded-lg text-xs font-semibold flex items-center gap-1.5"
                          >
                            <span className="w-1 h-1 rounded-full bg-brand-400"></span>
                            {skill}
                          </span>
                        ))}
                      </div>
                    ) : (
                      <p className="text-xs text-gray-500 italic py-6">
                        No direct matching skills could be automatically identified.
                      </p>
                    )}
                  </div>

                  {/* Missing Skills card */}
                  <div className="glass-card rounded-2xl p-6">
                    <div className="flex items-center gap-2 mb-4 text-rose-400 border-b border-gray-800/50 pb-3">
                      <AlertCircle className="w-4.5 h-4.5 shrink-0" />
                      <h3 className="font-bold text-white font-display text-sm uppercase tracking-wider">
                        Missing or Gapped Requirements ({selectedAnalysis?.missingSkills.length})
                      </h3>
                    </div>
                    {selectedAnalysis?.missingSkills && selectedAnalysis.missingSkills.length > 0 ? (
                      <div className="flex flex-wrap gap-2">
                        {selectedAnalysis.missingSkills.map((skill, index) => (
                          <span
                            key={index}
                            className="bg-rose-500/10 text-rose-300 border border-rose-500/15 px-3 py-1 rounded-lg text-xs font-semibold flex items-center gap-1.5"
                          >
                            <span className="w-1.5 h-1.5 rounded-full bg-rose-400 animate-pulse"></span>
                            {skill}
                          </span>
                        ))}
                      </div>
                    ) : (
                      <div className="p-4 bg-brand-500/10 rounded-xl border border-brand-500/20 text-center py-6">
                        <CheckCircle className="w-6 h-6 text-brand-400 mx-auto mb-2" />
                        <p className="text-xs font-bold text-white">Full Skill Overlap!</p>
                        <p className="text-[10px] text-gray-400 mt-0.5">This candidate covers all target requirements.</p>
                      </div>
                    )}
                  </div>

                </div>
              )}

              {/* Tab: Suggestions list */}
              {reportTab === "suggestions" && (
                <div className="flex flex-col gap-4 animate-fade-in">
                  <div className="p-4 bg-gray-900/30 rounded-xl border border-gray-800/80 text-xs text-gray-400 flex gap-3 items-start max-w-2xl">
                    <Info className="w-4 h-4 text-brand-400 shrink-0 mt-0.5" />
                    <p className="leading-relaxed">
                      These recommendations are calculated by comparing semantic phrasing in standard modern ATS models.
                      Addressing these sections typically yields a <strong>15% to 30% increase</strong> in auto-screening success rates.
                    </p>
                  </div>

                  {selectedAnalysis?.suggestions && selectedAnalysis.suggestions.length > 0 ? (
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      {selectedAnalysis.suggestions.map((sug, index) => (
                        <div
                          key={index}
                          className="p-5 bg-gray-900/50 rounded-2xl border border-gray-800 flex gap-4 items-start hover:border-gray-700 transition-all"
                        >
                          <div className="w-7 h-7 rounded-lg bg-brand-500/10 text-brand-400 flex items-center justify-center shrink-0 font-bold text-xs mt-0.5">
                            {index + 1}
                          </div>
                          <div className="flex flex-col">
                            <span className="text-[10px] uppercase font-bold text-brand-400 tracking-wider">
                              Category: {sug.category}
                            </span>
                            <h4 className="text-xs font-semibold text-white mt-1 leading-relaxed">
                              {sug.detail}
                            </h4>
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="text-center py-12 text-gray-500 border border-gray-800 border-dashed rounded-xl">
                      <p className="text-xs font-bold">No Suggestions Required!</p>
                      <p className="text-[10px] text-gray-400 mt-1">This resume is fully optimized for the provided description.</p>
                    </div>
                  )}
                </div>
              )}

              {/* Tab: Google Search grounded industry trends */}
              {reportTab === "trends" && (
                <div className="glass-card rounded-2xl p-6 sm:p-8 animate-fade-in flex flex-col gap-6">
                  <div className="flex flex-col gap-1.5 border-b border-gray-800/50 pb-4">
                    <div className="flex items-center gap-2">
                      <Sparkles className="w-4.5 h-4.5 text-brand-400" />
                      <h3 className="font-bold text-white font-display text-sm uppercase tracking-wider">
                        Google Search Live Grounding Intelligence
                      </h3>
                    </div>
                    <p className="text-xs text-gray-400 leading-relaxed">
                      Leverage Gemini 3.5 Flash to search current 2026 workplace trends, stack popularity indices, and recruiter preferences for this role tier.
                    </p>
                  </div>

                  {/* Search Form panel */}
                  <div className="flex gap-3 max-w-lg items-center">
                    <div className="relative flex-1">
                      <Briefcase className="absolute left-3.5 top-3 w-4 h-4 text-gray-500" />
                      <input
                        type="text"
                        value={industryTrendsInput}
                        onChange={(e) => setIndustryTrendsInput(e.target.value)}
                        placeholder="e.g., Senior Full Stack Developer, Product Manager"
                        className="glass-input pl-10 pr-4 py-2.5 w-full rounded-xl text-xs placeholder-gray-500 text-gray-200"
                      />
                    </div>
                    <button
                      onClick={handleFetchTrends}
                      disabled={trendsLoading || !industryTrendsInput.trim()}
                      className="bg-brand-500 hover:bg-brand-400 disabled:bg-gray-800 disabled:text-gray-600 text-[#0b0f19] font-bold text-xs py-3 px-5 rounded-xl transition-all cursor-pointer flex items-center gap-1.5 shrink-0 shadow-md"
                    >
                      {trendsLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Search className="w-4 h-4" />}
                      Query Trends
                    </button>
                  </div>

                  {trendsError && (
                    <div className="p-4 rounded-xl bg-red-500/10 border border-red-500/20 text-red-400 text-xs">
                      {trendsError}
                    </div>
                  )}

                  {trendsLoading ? (
                    <div className="py-16 text-center text-gray-400 text-xs flex flex-col items-center justify-center gap-3">
                      <Loader2 className="w-6 h-6 text-brand-400 animate-spin" />
                      <div>
                        <p className="font-bold text-white">Performing Live Market Research...</p>
                        <p className="text-[10px] text-gray-500 mt-1">Grounded in Google Search index databases</p>
                      </div>
                    </div>
                  ) : industryTrendsResult ? (
                    <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
                      
                      {/* Markdown trends body */}
                      <div className="lg:col-span-8 p-6 bg-gray-950/65 rounded-xl border border-gray-800 text-sm leading-relaxed text-gray-200 space-y-4 max-h-[420px] overflow-y-auto">
                        <div className="prose prose-invert prose-xs max-w-none">
                          {/* Simply rendered paragraphs from text results */}
                          {industryTrendsResult.text.split("\n").map((line, idx) => {
                            if (line.startsWith("###")) {
                              return <h4 key={idx} className="text-sm font-bold text-brand-400 mt-4 mb-2 font-display">{line.replace("###", "").trim()}</h4>;
                            }
                            if (line.startsWith("##")) {
                              return <h3 key={idx} className="text-base font-bold text-white mt-5 mb-2 border-b border-gray-800 pb-1 font-display">{line.replace("##", "").trim()}</h3>;
                            }
                            if (line.startsWith("#")) {
                              return <h2 key={idx} className="text-lg font-bold text-white mt-6 mb-3 font-display">{line.replace("#", "").trim()}</h2>;
                            }
                            if (line.startsWith("-") || line.startsWith("*")) {
                              return <li key={idx} className="ml-4 list-disc text-xs text-gray-300 py-0.5">{line.substring(1).trim()}</li>;
                            }
                            if (/^\d+\./.test(line)) {
                              return <li key={idx} className="ml-4 list-decimal text-xs text-gray-300 py-0.5">{line.trim()}</li>;
                            }
                            if (!line.trim()) return <div key={idx} className="h-2"></div>;
                            return <p key={idx} className="text-xs text-gray-300 leading-relaxed py-0.5">{line}</p>;
                          })}
                        </div>
                      </div>

                      {/* Cited Sources bar */}
                      <div className="lg:col-span-4 p-5 bg-gray-900/30 rounded-xl border border-gray-800/80">
                        <h4 className="text-xs font-bold text-white mb-3 flex items-center gap-1.5 uppercase tracking-wider">
                          <Info className="w-3.5 h-3.5 text-brand-400" />
                          Grounded Sources
                        </h4>
                        
                        {industryTrendsResult.sources && industryTrendsResult.sources.length > 0 ? (
                          <div className="flex flex-col gap-2.5">
                            {industryTrendsResult.sources.map((src, idx) => (
                              <a
                                key={idx}
                                href={src.uri}
                                target="_blank"
                                rel="noreferrer"
                                className="p-2.5 bg-gray-950/40 rounded-lg border border-gray-800 text-[10px] text-gray-300 hover:border-brand-500/20 hover:text-brand-400 block transition-all group truncate"
                              >
                                <span className="font-bold block text-white truncate group-hover:text-brand-400">
                                  {src.title}
                                </span>
                                <span className="text-[9px] text-gray-500 flex items-center gap-1 mt-1 truncate">
                                  <ExternalLink className="w-2.5 h-2.5 inline shrink-0" />
                                  {src.uri}
                                </span>
                              </a>
                            ))}
                          </div>
                        ) : (
                          <p className="text-[10px] text-gray-500 italic">No external sources required to synthesize report.</p>
                        )}
                      </div>

                    </div>
                  ) : (
                    <div className="text-center py-12 border border-gray-800 border-dashed rounded-xl bg-gray-900/10 text-gray-500">
                      <HelpCircle className="w-8 h-8 text-gray-600 mx-auto mb-2" />
                      <p className="text-xs font-bold text-gray-400">Trend Query Ready</p>
                      <p className="text-[10px] text-gray-500 mt-1 max-w-sm mx-auto leading-relaxed">
                        Input your target job title above and click query to run automated live market scans for standard hiring profiles.
                      </p>
                    </div>
                  )}

                </div>
              )}

              {/* Tab: Text Comparison */}
              {reportTab === "raw" && (
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 animate-fade-in">
                  
                  {/* Extracted Resume Text panel */}
                  <div className="flex flex-col gap-2">
                    <label className="text-xs font-bold uppercase tracking-wider text-gray-400">
                      Parsed Resume Plaintext
                    </label>
                    <div className="p-4 bg-gray-950/70 border border-gray-800 rounded-xl text-xs font-mono text-gray-300 leading-relaxed max-h-[380px] overflow-y-auto whitespace-pre-wrap">
                      {selectedAnalysis?.extractedText}
                    </div>
                  </div>

                  {/* Target Job Description panel */}
                  <div className="flex flex-col gap-2">
                    <label className="text-xs font-bold uppercase tracking-wider text-gray-400">
                      Submitted Job Description Criteria
                    </label>
                    <div className="p-4 bg-gray-950/70 border border-gray-800 rounded-xl text-xs text-gray-300 leading-relaxed max-h-[380px] overflow-y-auto whitespace-pre-wrap">
                      {selectedAnalysis?.jobDescription}
                    </div>
                  </div>

                </div>
              )}

            </div>

          </div>
        )}

      </main>

      {/* App Footer */}
      <footer className="border-t border-gray-800/80 bg-[#070a12] py-6 mt-12">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex flex-col sm:flex-row items-center justify-between gap-4 text-xs text-gray-500">
          <p>© 2026 AI Resume Analyzer • Grounded in Google Gemini Intelligence.</p>
          <div className="flex gap-4">
            <span className="text-[10px] bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 px-2 py-0.5 rounded-md font-semibold uppercase tracking-wider">
              Secure Sandbox
            </span>
          </div>
        </div>
      </footer>
    </div>
  );
}
