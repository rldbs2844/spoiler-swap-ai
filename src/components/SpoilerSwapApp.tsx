'use client';

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  DEFAULT_THRESHOLD,
  DEFAULT_WATCHLIST,
  PRESET_SHORTS
} from '@/lib/constants';
import { buildOnDeviceReasoning, evaluateShort } from '@/lib/detector';
import type { EvaluationResult, ScanLogEntry, ShortItem } from '@/lib/types';
import AnalyticsPanel from './AnalyticsPanel';
import ApiGuideModal from './ApiGuideModal';
import ShortsPlayer from './ShortsPlayer';
import StageBreakdown from './StageBreakdown';

type AppMode = 'search' | 'youtube' | 'feed' | 'custom';

export default function SpoilerSwapApp() {
  const [watchlist, setWatchlist] = useState<string[]>(DEFAULT_WATCHLIST);
  const [keywordInput, setKeywordInput] = useState('');
  const [threshold, setThreshold] = useState<number>(DEFAULT_THRESHOLD);
  const [mode, setMode] = useState<AppMode>('feed');
  const [currentIndex, setCurrentIndex] = useState(0);
  const [forceOriginal, setForceOriginal] = useState(false);
  const [autoPlay, setAutoPlay] = useState(false);
  const [voiceEnabled, setVoiceEnabled] = useState(true);
  const [showApiModal, setShowApiModal] = useState(false);

  // Live YouTube Search state
  const [searchQuery, setSearchQuery] = useState('오징어 게임 결말');
  const [searchLoading, setSearchLoading] = useState(false);
  const [searchResults, setSearchResults] = useState<
    Array<{ shortItem: ShortItem; result: EvaluationResult }>
  >([]);
  const [searchNotice, setSearchNotice] = useState<string | null>(null);
  const [searchProvider, setSearchProvider] = useState<string | null>(null);
  const [selectedSearchShort, setSelectedSearchShort] = useState<ShortItem | null>(null);

  // Real YouTube Shorts URL inspector state
  const [youtubeUrl, setYoutubeUrl] = useState('');
  const [youtubeOcrHint, setYoutubeOcrHint] = useState('');
  const [youtubeSttHint, setYoutubeSttHint] = useState('');
  const [youtubeLoading, setYoutubeLoading] = useState(false);
  const [youtubeShort, setYoutubeShort] = useState<ShortItem | null>(null);
  const [youtubeProvider, setYoutubeProvider] = useState<string | null>(null);

  // Custom input state
  const [customShort, setCustomShort] = useState<ShortItem>({
    id: 'custom_input_001',
    channel: '@custom_test_user',
    emoji: '🧪',
    bgGradient: 'from-indigo-950 via-slate-900 to-slate-950',
    title: '[오징어 게임] 결국 마지막에 죽는 캐릭터 #오징어게임 #결말',
    ocr: '충격 반전! 프론트맨의 진짜 정체가 밝혀지는 순간',
    stt: '여러분 결국 456번 기훈이 마지막 선택으로 탈락하게 되는데요'
  });

  // Playback & UI state
  const [isSwappedView, setIsSwappedView] = useState(false);
  const [isScanningFlash, setIsScanningFlash] = useState(false);
  const [isFinalized, setIsFinalized] = useState(true);
  const [progressPct, setProgressPct] = useState(0);
  const [elapsedSec, setElapsedSec] = useState(0);
  const [stagePhase, setStagePhase] = useState<'init' | 'ocr' | 'stt' | 'done'>('done');
  const [toastMsg, setToastMsg] = useState<string | null>(null);

  // API Capabilities & Stats
  const [apiCapabilities, setApiCapabilities] = useState<{
    youtube_data_api_v3: boolean;
    gemini_stage4: boolean;
    openai_stage4: boolean;
  } | null>(null);
  const [stats, setStats] = useState({
    scanned: 0,
    blocked: 0,
    totalLatency: 0,
    carbonSaved: 0
  });
  const [logs, setLogs] = useState<ScanLogEntry[]>([]);
  const [logFilter, setLogFilter] = useState<'all' | 'SWAP_TO_CAT_MEME' | 'PASS'>('all');
  const [activeResult, setActiveResult] = useState<EvaluationResult>(() => {
    const base = evaluateShort(PRESET_SHORTS[0], {
      watchlist: DEFAULT_WATCHLIST,
      threshold: DEFAULT_THRESHOLD
    });
    return { ...base, ai_analysis: buildOnDeviceReasoning(base) };
  });

  const timersRef = useRef<ReturnType<typeof setTimeout>[]>([]);
  const progressRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const audioCtxRef = useRef<AudioContext | null>(null);
  const toastTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const activeShort: ShortItem = useMemo(() => {
    if (mode === 'search' && selectedSearchShort) return selectedSearchShort;
    if (mode === 'youtube' && youtubeShort) return youtubeShort;
    if (mode === 'custom') return customShort;
    return PRESET_SHORTS[currentIndex];
  }, [mode, selectedSearchShort, youtubeShort, customShort, currentIndex]);

  const showToast = useCallback((msg: string) => {
    setToastMsg(msg);
    if (toastTimerRef.current) clearTimeout(toastTimerRef.current);
    toastTimerRef.current = setTimeout(() => setToastMsg(null), 2600);
  }, []);

  const stopAllAudio = useCallback(() => {
    if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
      try {
        window.speechSynthesis.cancel();
      } catch {}
    }
  }, []);

  const speakKorean = useCallback(
    (text: string, rate = 1.08, pitch = 1.0) => {
      if (!voiceEnabled || typeof window === 'undefined' || !('speechSynthesis' in window) || !text)
        return;
      try {
        window.speechSynthesis.cancel();
        const utter = new SpeechSynthesisUtterance(text);
        utter.lang = 'ko-KR';
        utter.rate = rate;
        utter.pitch = pitch;
        window.speechSynthesis.speak(utter);
      } catch {}
    },
    [voiceEnabled]
  );

  const playSwapChime = useCallback(() => {
    if (!voiceEnabled || typeof window === 'undefined') return;
    try {
      const AudioCtx =
        window.AudioContext ||
        (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      if (!AudioCtx) return;
      if (!audioCtxRef.current) audioCtxRef.current = new AudioCtx();
      if (audioCtxRef.current.state === 'suspended') {
        audioCtxRef.current.resume().catch(() => {});
      }
      const now = audioCtxRef.current.currentTime;
      [523.25, 659.25, 783.99].forEach((freq, idx) => {
        const ctx = audioCtxRef.current!;
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = idx === 0 ? 'triangle' : 'sine';
        osc.frequency.setValueAtTime(freq, now + idx * 0.08);
        gain.gain.setValueAtTime(0.001, now + idx * 0.08);
        gain.gain.exponentialRampToValueAtTime(0.14, now + idx * 0.08 + 0.02);
        gain.gain.exponentialRampToValueAtTime(0.001, now + idx * 0.08 + 0.25);
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.start(now + idx * 0.08);
        osc.stop(now + idx * 0.08 + 0.26);
      });
    } catch {}
  }, [voiceEnabled]);

  const clearPlaybackTimers = useCallback(() => {
    timersRef.current.forEach((t) => clearTimeout(t));
    timersRef.current = [];
    if (progressRef.current) {
      clearInterval(progressRef.current);
      progressRef.current = null;
    }
    stopAllAudio();
  }, [stopAllAudio]);

  const recordLog = useCallback((shortItem: ShortItem, result: EvaluationResult) => {
    const isSwap = result.action === 'SWAP_TO_CAT_MEME';
    setStats((prev) => ({
      scanned: prev.scanned + 1,
      blocked: prev.blocked + (isSwap ? 1 : 0),
      totalLatency: prev.totalLatency + result.latency_ms,
      carbonSaved: Number((prev.carbonSaved + result.esg_on_device_carbon_saved_g).toFixed(2))
    }));
    setLogs((prev) => {
      const entry: ScanLogEntry = {
        seq: prev.length + 1,
        timestamp: new Date().toLocaleTimeString('ko-KR', { hour12: false }),
        isoTime: new Date().toISOString(),
        title: shortItem.title,
        result
      };
      return [entry, ...prev].slice(0, 50);
    });
  }, []);

  const runShortSequence = useCallback(
    (
      shortItem: ShortItem,
      animatePlayback: boolean,
      speakAudio: boolean,
      overrideForceOriginal?: boolean,
      precomputedResult?: EvaluationResult
    ) => {
      clearPlaybackTimers();
      setIsScanningFlash(false);

      const forced = overrideForceOriginal ?? forceOriginal;
      const baseLocal = evaluateShort(shortItem, { watchlist, threshold });
      const localResult: EvaluationResult = precomputedResult || {
        ...baseLocal,
        ai_analysis: buildOnDeviceReasoning(baseLocal)
      };
      setActiveResult(localResult);

      if (!animatePlayback) {
        const swapNow = localResult.action === 'SWAP_TO_CAT_MEME' && !forced;
        setIsSwappedView(swapNow);
        setIsFinalized(true);
        setStagePhase('done');
        return;
      }

      setIsSwappedView(false);
      setIsFinalized(false);
      setStagePhase('init');
      setProgressPct(0);
      setElapsedSec(0);

      if (speakAudio && !shortItem.isRealYouTube && shortItem.stt) {
        speakKorean(shortItem.stt, 1.08, 1.0);
      }

      let apiResolvedResult: EvaluationResult = localResult;
      if (!precomputedResult) {
        fetch('/api/evaluate', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ shortItem, watchlist, threshold })
        })
          .then((r) => (r.ok ? r.json() : null))
          .then((data: EvaluationResult | null) => {
            if (data && data.video_id === shortItem.id) {
              apiResolvedResult = data;
            }
          })
          .catch(() => {});
      }

      const started = Date.now();
      progressRef.current = setInterval(() => {
        const sec = (Date.now() - started) / 1000;
        setElapsedSec(sec);
        setProgressPct(Math.min(100, (sec / 4.0) * 100));
        if (sec >= 4.0 && progressRef.current) {
          clearInterval(progressRef.current);
          progressRef.current = null;
        }
      }, 100);

      timersRef.current.push(setTimeout(() => setStagePhase('ocr'), 550));
      timersRef.current.push(setTimeout(() => setStagePhase('stt'), 1150));

      timersRef.current.push(
        setTimeout(() => {
          const finalDecision = apiResolvedResult || localResult;
          setActiveResult(finalDecision);
          recordLog(shortItem, finalDecision);

          if (finalDecision.action === 'SWAP_TO_CAT_MEME' && !forced) {
            stopAllAudio();
            if (speakAudio) playSwapChime();
            setIsScanningFlash(true);

            timersRef.current.push(
              setTimeout(() => {
                setIsScanningFlash(false);
                setIsSwappedView(true);
                setIsFinalized(true);
                setStagePhase('done');
                if (speakAudio) {
                  speakKorean('스포일러를 차단했어요! 귀여운 고양이 보고 가세요.', 1.05, 1.12);
                }
              }, 380)
            );
          } else {
            setIsFinalized(true);
            setStagePhase('done');
          }
        }, 1900)
      );
    },
    [
      clearPlaybackTimers,
      forceOriginal,
      watchlist,
      threshold,
      speakKorean,
      recordLog,
      stopAllAudio,
      playSwapChime
    ]
  );

  useEffect(() => {
    fetch('/api/health')
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => {
        if (d?.capabilities) setApiCapabilities(d.capabilities);
      })
      .catch(() => {});

    runShortSequence(PRESET_SHORTS[0], true, false, false);
    return () => clearPlaybackTimers();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (!autoPlay || mode !== 'feed') return;
    const id = setInterval(() => {
      setCurrentIndex((prev) => {
        const next = (prev + 1) % PRESET_SHORTS.length;
        setForceOriginal(false);
        runShortSequence(PRESET_SHORTS[next], true, true, false);
        return next;
      });
    }, 5500);
    return () => clearInterval(id);
  }, [autoPlay, mode, runShortSequence]);

  const handleAddKeyword = (e: React.FormEvent) => {
    e.preventDefault();
    const val = keywordInput.trim();
    if (!val) return;
    if (!watchlist.includes(val)) {
      const next = [...watchlist, val];
      setWatchlist(next);
      const base = evaluateShort(activeShort, { watchlist: next, threshold });
      const updated = { ...base, ai_analysis: buildOnDeviceReasoning(base) };
      setActiveResult(updated);
      setIsSwappedView(updated.action === 'SWAP_TO_CAT_MEME' && !forceOriginal);
      showToast(`"${val}" 키워드가 워치리스트에 추가되었습니다.`);
    }
    setKeywordInput('');
  };

  const handleRemoveKeyword = (kw: string) => {
    const next = watchlist.filter((item) => item !== kw);
    setWatchlist(next);
    const base = evaluateShort(activeShort, { watchlist: next, threshold });
    const updated = { ...base, ai_analysis: buildOnDeviceReasoning(base) };
    setActiveResult(updated);
    setIsSwappedView(updated.action === 'SWAP_TO_CAT_MEME' && !forceOriginal);
  };

  const handleThresholdChange = (nextVal: number) => {
    setThreshold(nextVal);
    const base = evaluateShort(activeShort, { watchlist, threshold: nextVal });
    const updated = { ...base, ai_analysis: buildOnDeviceReasoning(base) };
    setActiveResult(updated);
    setIsSwappedView(updated.action === 'SWAP_TO_CAT_MEME' && !forceOriginal);
  };

  const handleYouTubeSearch = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!searchQuery.trim()) {
      showToast('검색할 작품이나 키워드를 입력해 주세요.');
      return;
    }
    setSearchLoading(true);
    setSearchNotice(null);
    try {
      const resp = await fetch('/api/youtube-search', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          query: searchQuery.trim(),
          maxResults: 6,
          watchlist,
          threshold
        })
      });
      const data = await resp.json();
      if (!resp.ok || !data.ok) {
        showToast(data.error || '유튜브 검색에 실패했습니다.');
        return;
      }
      setSearchResults(data.items || []);
      setSearchProvider(data.provider);
      setSearchNotice(data.notice || null);
      if (data.items?.length > 0) {
        const first = data.items[0];
        setSelectedSearchShort(first.shortItem);
        setForceOriginal(false);
        runShortSequence(first.shortItem, true, true, false);
      }
    } catch {
      showToast('유튜브 검색 요청 중 오류가 발생했습니다.');
    } finally {
      setSearchLoading(false);
    }
  };

  const handleYouTubeInspect = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!youtubeUrl.trim()) {
      showToast('유튜브 쇼츠 URL을 입력해 주세요.');
      return;
    }
    setYoutubeLoading(true);
    try {
      const resp = await fetch('/api/youtube-inspect', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          url: youtubeUrl.trim(),
          ocr: youtubeOcrHint.trim() || undefined,
          stt: youtubeSttHint.trim() || undefined,
          watchlist,
          threshold
        })
      });
      const data = await resp.json();
      if (!resp.ok || !data.ok) {
        showToast(data.error || '유튜브 쇼츠 조회에 실패했습니다.');
        return;
      }
      setYoutubeShort(data.shortItem);
      setYoutubeProvider(data.provider);
      setForceOriginal(false);
      runShortSequence(data.shortItem, true, true, false, data.result);
      showToast(`실제 유튜브 쇼츠 분석 시작 (${data.provider})`);
    } catch {
      showToast('서버 요청 중 오류가 발생했습니다.');
    } finally {
      setYoutubeLoading(false);
    }
  };

  const handleBatchScan = async () => {
    clearPlaybackTimers();
    let results: EvaluationResult[] | null = null;
    try {
      const resp = await fetch('/api/evaluate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ shorts: PRESET_SHORTS, watchlist, threshold })
      });
      if (resp.ok) {
        const data = await resp.json();
        if (Array.isArray(data?.results)) results = data.results;
      }
    } catch {}
    const finalResults =
      results ||
      PRESET_SHORTS.map((s) => {
        const b = evaluateShort(s, { watchlist, threshold });
        return { ...b, ai_analysis: buildOnDeviceReasoning(b) };
      });
    finalResults.forEach((res, idx) => recordLog(PRESET_SHORTS[idx], res));
    const last = finalResults[finalResults.length - 1];
    if (last) {
      setActiveResult(last);
      setIsSwappedView(last.action === 'SWAP_TO_CAT_MEME' && !forceOriginal);
      setIsFinalized(true);
      setStagePhase('done');
    }
    showToast(`프리셋 쇼츠 ${PRESET_SHORTS.length}편 일괄 스캔 완료!`);
  };

  const downloadFile = (filename: string, content: string, mimeType: string) => {
    const blob = new Blob([content], { type: mimeType });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const handleExportJson = () => {
    const payload = {
      generated_at: new Date().toISOString(),
      threshold,
      watchlist,
      kpi: stats,
      latest_result: activeResult,
      logs: logs.map((l) => l.result)
    };
    downloadFile('spoiler_swap_report.json', JSON.stringify(payload, null, 2), 'application/json');
    showToast('JSON 리포트가 다운로드되었습니다.');
  };

  const handleExportMarkdown = () => {
    const avgMs = stats.scanned > 0 ? Math.round(stats.totalLatency / stats.scanned) : 0;
    const blockRate = stats.scanned > 0 ? ((stats.blocked / stats.scanned) * 100).toFixed(1) : '0.0';
    const rows = logs
      .map(
        (entry, idx) =>
          `| ${logs.length - idx} | ${entry.result.video_id} | ${entry.result.channel} | **${entry.result.action}** | ${entry.result.confidence_score.toFixed(2)} | ${entry.result.latency_ms} ms | ${[...entry.result.matched_watchlist_entities, ...entry.result.matched_spoiler_triggers].join(', ') || '-'} |`
      )
      .join('\n');

    const md = [
      '# Spoiler-Swap AI — 실시간 분석 리포트',
      '',
      `- 생성 시각: ${new Date().toISOString()}`,
      `- 활성 워치리스트: ${watchlist.join(', ')}`,
      `- 차단 임계값(Threshold): ${threshold.toFixed(2)}`,
      '',
      '## 1. 세션 핵심 지표 (KPI)',
      `- 누적 스캔 쇼츠: **${stats.scanned}편**`,
      `- 스포일러 차단 · 고양이 밈 교체: **${stats.blocked}건** (차단율 ${blockRate}%)`,
      `- 평균 응답 지연시간: **${avgMs} ms**`,
      `- 온디바이스 탄소 절감량: **${stats.carbonSaved.toFixed(2)} g**`,
      '',
      '## 2. 감사 로그',
      '| # | Video ID | 채널 | 판정 | 점수 | 지연 | 탐지 키워드 |',
      '| --- | --- | --- | --- | --- | --- | --- |',
      rows || '| - | - | - | - | - | - | - |'
    ].join('\n');
    downloadFile('spoiler_swap_report.md', md, 'text/markdown;charset=utf-8');
    showToast('Markdown 리포트가 다운로드되었습니다.');
  };

  const handleExportCsv = () => {
    const header = 'seq,timestamp,video_id,channel,action,confidence_score,latency_ms,entities,triggers';
    const lines = logs.map((entry) =>
      [
        entry.seq,
        `"${entry.timestamp}"`,
        `"${entry.result.video_id}"`,
        `"${entry.result.channel}"`,
        entry.result.action,
        entry.result.confidence_score.toFixed(2),
        entry.result.latency_ms,
        `"${entry.result.matched_watchlist_entities.join(' ')}"`,
        `"${entry.result.matched_spoiler_triggers.join(' ')}"`
      ].join(',')
    );
    downloadFile(
      'spoiler_swap_logs.csv',
      '\uFEFF' + [header, ...lines].join('\n'),
      'text/csv;charset=utf-8'
    );
    showToast('CSV 감사 로그가 다운로드되었습니다.');
  };

  return (
    <div className="min-h-screen bg-[#0b0f19] text-slate-100">
      {/* Toast */}
      {toastMsg && (
        <div className="fixed bottom-5 right-5 z-50 px-4 py-2.5 rounded-xl bg-indigo-600 text-white text-xs font-bold shadow-xl border border-indigo-400/50">
          {toastMsg}
        </div>
      )}

      {/* API Guide Modal */}
      <ApiGuideModal
        open={showApiModal}
        onClose={() => setShowApiModal(false)}
        capabilities={apiCapabilities}
      />

      {/* Header */}
      <header className="sticky top-0 z-40 border-b border-slate-800/80 bg-[#0b0f19]/90 backdrop-blur-md">
        <div className="max-w-7xl mx-auto px-4 py-3 flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-indigo-500 to-rose-500 flex items-center justify-center text-lg shadow-lg">
              🐱
            </div>
            <div>
              <h1 className="text-base font-extrabold tracking-tight text-white flex items-center gap-2">
                Spoiler-Swap AI
                <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-indigo-500/20 text-indigo-300 border border-indigo-500/40">
                  Next.js Full-Stack
                </span>
              </h1>
              <p className="text-[11px] text-slate-400">
                실시간 유튜브 쇼츠 임베드 · 4단계 멀티모달 AI 탐지 · 고양이 힐링 밈 스왑
              </p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <span
              className={`px-2.5 py-1 rounded-full text-[11px] font-semibold border ${
                apiCapabilities?.youtube_data_api_v3
                  ? 'bg-emerald-500/15 text-emerald-300 border-emerald-500/30'
                  : 'bg-slate-800 text-slate-300 border-slate-700'
              }`}
            >
              YouTube: {apiCapabilities?.youtube_data_api_v3 ? 'Data API v3' : 'oEmbed/파서'}
            </span>
            <span
              className={`px-2.5 py-1 rounded-full text-[11px] font-semibold border ${
                apiCapabilities?.gemini_stage4 || apiCapabilities?.openai_stage4
                  ? 'bg-emerald-500/15 text-emerald-300 border-emerald-500/30'
                  : 'bg-slate-800 text-slate-300 border-slate-700'
              }`}
            >
              AI Stage 4:{' '}
              {apiCapabilities?.gemini_stage4
                ? 'Gemini 2.0'
                : apiCapabilities?.openai_stage4
                  ? 'GPT-4o-mini'
                  : '온디바이스 KG'}
            </span>
            <button
              type="button"
              onClick={() => setShowApiModal(true)}
              className="px-3 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold border border-slate-700 transition cursor-pointer"
            >
              🔌 API 설정 가이드
            </button>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-4 py-5 space-y-6">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
          {/* Left Column: Controls & Mode Tabs */}
          <section className="lg:col-span-4 space-y-4">
            {/* Mode Switcher */}
            <div className="grid grid-cols-2 gap-1.5 p-1.5 rounded-2xl bg-slate-900 border border-slate-800">
              {(
                [
                  ['search', '🔍 실시간 유튜브 검색'],
                  ['youtube', '🔗 유튜브 URL 검사'],
                  ['feed', '🎬 프리셋 시연 피드'],
                  ['custom', '🧪 직접 입력 테스트']
                ] as const
              ).map(([key, label]) => (
                <button
                  key={key}
                  type="button"
                  onClick={() => {
                    setMode(key);
                    setAutoPlay(false);
                    setForceOriginal(false);
                  }}
                  className={`py-2 px-2.5 rounded-xl text-xs font-bold transition cursor-pointer ${
                    mode === key
                      ? 'bg-indigo-600 text-white shadow'
                      : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/60'
                  }`}
                >
                  {label}
                </button>
              ))}
            </div>

            {/* Mode Panel */}
            <div className="rounded-2xl bg-slate-900/75 border border-slate-800 p-4 space-y-3">
              {mode === 'search' && (
                <div className="space-y-3">
                  <form onSubmit={handleYouTubeSearch} className="flex gap-2">
                    <input
                      type="text"
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      placeholder="예: 오징어 게임 결말, 범죄도시"
                      className="flex-1 px-3 py-2 rounded-xl bg-slate-950 border border-slate-700 text-xs text-white focus:outline-none focus:border-indigo-500"
                    />
                    <button
                      type="submit"
                      disabled={searchLoading}
                      className="px-3.5 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white text-xs font-bold transition cursor-pointer shrink-0"
                    >
                      {searchLoading ? '검색 중...' : '검색'}
                    </button>
                  </form>

                  {searchNotice && (
                    <div className="p-2.5 rounded-xl bg-amber-950/40 border border-amber-500/30 text-[11px] text-amber-200 leading-relaxed">
                      {searchNotice}
                    </div>
                  )}

                  {searchResults.length > 0 && (
                    <div className="space-y-2 max-h-[280px] overflow-y-auto pr-1">
                      <div className="text-[11px] text-slate-400 flex justify-between">
                        <span>검색 결과 ({searchResults.length}건)</span>
                        <span className="mono">{searchProvider}</span>
                      </div>
                      {searchResults.map(({ shortItem, result }) => {
                        const isBlocked = result.action === 'SWAP_TO_CAT_MEME';
                        const isSelected = selectedSearchShort?.id === shortItem.id;
                        return (
                          <button
                            key={shortItem.id}
                            type="button"
                            onClick={() => {
                              setSelectedSearchShort(shortItem);
                              setForceOriginal(false);
                              runShortSequence(shortItem, true, true, false);
                            }}
                            className={`w-full text-left p-2.5 rounded-xl border transition flex items-center gap-2.5 cursor-pointer ${
                              isSelected
                                ? 'bg-indigo-600/20 border-indigo-500'
                                : 'bg-slate-950/70 border-slate-800 hover:border-slate-700'
                            }`}
                          >
                            {/* eslint-disable-next-line @next/next/no-img-element */}
                            <img
                              src={shortItem.thumbnailUrl}
                              alt={shortItem.title}
                              className="w-12 h-16 rounded-lg object-cover bg-slate-800 shrink-0"
                            />
                            <div className="min-w-0 flex-1 space-y-1">
                              <div className="text-xs font-semibold text-white line-clamp-2">
                                {shortItem.title}
                              </div>
                              <div className="flex items-center justify-between gap-2 text-[10px]">
                                <span className="text-slate-400 truncate">{shortItem.channel}</span>
                                <span
                                  className={`px-1.5 py-0.5 rounded font-bold shrink-0 ${
                                    isBlocked
                                      ? 'bg-rose-500/20 text-rose-300'
                                      : 'bg-emerald-500/20 text-emerald-300'
                                  }`}
                                >
                                  {isBlocked ? '🐱 차단' : '✅ 안전'} {(result.confidence_score * 100).toFixed(0)}%
                                </span>
                              </div>
                            </div>
                          </button>
                        );
                      })}
                    </div>
                  )}
                </div>
              )}

              {mode === 'youtube' && (
                <form onSubmit={handleYouTubeInspect} className="space-y-3">
                  <div>
                    <label className="block text-[11px] font-semibold text-slate-300 mb-1">
                      유튜브 쇼츠 URL 또는 영상 ID
                    </label>
                    <input
                      type="text"
                      value={youtubeUrl}
                      onChange={(e) => setYoutubeUrl(e.target.value)}
                      placeholder="https://www.youtube.com/shorts/..."
                      className="w-full px-3 py-2 rounded-xl bg-slate-950 border border-slate-700 text-xs text-white focus:outline-none focus:border-indigo-500"
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] font-semibold text-slate-400 mb-1">
                      [선택] 화면 자막(OCR) 힌트
                    </label>
                    <input
                      type="text"
                      value={youtubeOcrHint}
                      onChange={(e) => setYoutubeOcrHint(e.target.value)}
                      placeholder="비워두면 유튜브 설명란·제목 자동 활용"
                      className="w-full px-3 py-2 rounded-xl bg-slate-950 border border-slate-700 text-xs text-white focus:outline-none focus:border-indigo-500"
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] font-semibold text-slate-400 mb-1">
                      [선택] 음성 자막(STT) 힌트
                    </label>
                    <input
                      type="text"
                      value={youtubeSttHint}
                      onChange={(e) => setYoutubeSttHint(e.target.value)}
                      placeholder="비워두면 유튜브 공개 자막 트랙 자동 추출"
                      className="w-full px-3 py-2 rounded-xl bg-slate-950 border border-slate-700 text-xs text-white focus:outline-none focus:border-indigo-500"
                    />
                  </div>
                  <button
                    type="submit"
                    disabled={youtubeLoading}
                    className="w-full py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white text-xs font-bold transition cursor-pointer"
                  >
                    {youtubeLoading ? '유튜브 메타데이터/자막 분석 중...' : '🔍 실제 쇼츠 불러와서 검사'}
                  </button>
                  {youtubeShort && (
                    <div className="p-2.5 rounded-xl bg-slate-950 border border-slate-800 text-[11px] text-slate-300 space-y-1">
                      <div className="flex justify-between text-slate-400">
                        <span>데이터 소스: {youtubeProvider}</span>
                        <span>자막: {youtubeShort.captionSource || 'none'}</span>
                      </div>
                      <div className="font-semibold text-white line-clamp-2">{youtubeShort.title}</div>
                    </div>
                  )}
                </form>
              )}

              {mode === 'feed' && (
                <div className="space-y-2.5">
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-xs font-bold text-slate-200">
                      시연 프리셋 ({currentIndex + 1}/{PRESET_SHORTS.length})
                    </span>
                    <div className="flex items-center gap-1.5">
                      <button
                        type="button"
                        onClick={() => setAutoPlay((v) => !v)}
                        className={`px-2.5 py-1 rounded-lg text-[11px] font-bold border transition cursor-pointer ${
                          autoPlay
                            ? 'bg-emerald-600/25 text-emerald-300 border-emerald-500/50'
                            : 'bg-slate-800 text-slate-300 border-slate-700'
                        }`}
                      >
                        {autoPlay ? '⏸ 자동재생 중' : '▶ 자동재생'}
                      </button>
                      <button
                        type="button"
                        onClick={handleBatchScan}
                        className="px-2.5 py-1 rounded-lg bg-indigo-600/20 hover:bg-indigo-600/35 text-indigo-300 text-[11px] font-bold border border-indigo-500/40 transition cursor-pointer"
                      >
                        ⚡ 일괄 스캔
                      </button>
                    </div>
                  </div>
                  <div className="space-y-1.5">
                    {PRESET_SHORTS.map((item, idx) => (
                      <button
                        key={item.id}
                        type="button"
                        onClick={() => {
                          setCurrentIndex(idx);
                          setForceOriginal(false);
                          runShortSequence(item, true, true, false);
                        }}
                        className={`w-full text-left px-3 py-2 rounded-xl border text-xs transition flex items-center gap-2 cursor-pointer ${
                          idx === currentIndex
                            ? 'bg-indigo-600/20 border-indigo-500 text-white'
                            : 'bg-slate-950/70 border-slate-800 text-slate-300 hover:border-slate-700'
                        }`}
                      >
                        <span>{item.emoji}</span>
                        <span className="truncate flex-1 font-medium">{item.title}</span>
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {mode === 'custom' && (
                <div className="space-y-2.5">
                  <input
                    type="text"
                    value={customShort.title}
                    onChange={(e) => setCustomShort({ ...customShort, title: e.target.value })}
                    placeholder="영상 제목 / 해시태그"
                    className="w-full px-3 py-2 rounded-xl bg-slate-950 border border-slate-700 text-xs text-white"
                  />
                  <input
                    type="text"
                    value={customShort.ocr}
                    onChange={(e) => setCustomShort({ ...customShort, ocr: e.target.value })}
                    placeholder="화면 자막 (OCR)"
                    className="w-full px-3 py-2 rounded-xl bg-slate-950 border border-slate-700 text-xs text-white"
                  />
                  <textarea
                    rows={2}
                    value={customShort.stt}
                    onChange={(e) => setCustomShort({ ...customShort, stt: e.target.value })}
                    placeholder="음성 자막 (STT)"
                    className="w-full px-3 py-2 rounded-xl bg-slate-950 border border-slate-700 text-xs text-white"
                  />
                  <button
                    type="button"
                    onClick={() => {
                      setForceOriginal(false);
                      runShortSequence(customShort, true, true, false);
                    }}
                    className="w-full py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold transition cursor-pointer"
                  >
                    🧪 4단계 스포일러 판정 실행
                  </button>
                </div>
              )}
            </div>

            {/* Watchlist & Threshold Settings */}
            <div className="rounded-2xl bg-slate-900/75 border border-slate-800 p-4 space-y-3">
              <div className="flex items-center justify-between">
                <h2 className="text-xs font-bold text-white">🎯 스포일러 차단 워치리스트</h2>
                <label className="flex items-center gap-1.5 text-[11px] text-slate-300 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={voiceEnabled}
                    onChange={(e) => setVoiceEnabled(e.target.checked)}
                    className="accent-indigo-500"
                  />
                  TTS/효과음
                </label>
              </div>

              <form onSubmit={handleAddKeyword} className="flex gap-1.5">
                <input
                  type="text"
                  value={keywordInput}
                  onChange={(e) => setKeywordInput(e.target.value)}
                  placeholder="작품명 추가 (예: 더 글로리)"
                  className="flex-1 px-3 py-1.5 rounded-xl bg-slate-950 border border-slate-700 text-xs text-white focus:outline-none focus:border-indigo-500"
                />
                <button
                  type="submit"
                  className="px-3 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-white text-xs font-semibold border border-slate-700 cursor-pointer"
                >
                  추가
                </button>
              </form>

              <div className="flex flex-wrap gap-1.5">
                {watchlist.map((kw) => (
                  <span
                    key={kw}
                    className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-indigo-500/15 border border-indigo-500/35 text-[11px] font-semibold text-indigo-200"
                  >
                    {kw}
                    <button
                      type="button"
                      onClick={() => handleRemoveKeyword(kw)}
                      className="text-indigo-300 hover:text-rose-300 cursor-pointer"
                    >
                      ×
                    </button>
                  </span>
                ))}
              </div>

              <div className="pt-2 border-t border-slate-800 space-y-1">
                <div className="flex items-center justify-between text-xs">
                  <span className="text-slate-300 font-medium">차단 민감도 임계치 (Threshold)</span>
                  <span className="mono font-bold text-indigo-300">{threshold.toFixed(2)}</span>
                </div>
                <input
                  type="range"
                  min={0.4}
                  max={0.95}
                  step={0.05}
                  value={threshold}
                  onChange={(e) => handleThresholdChange(parseFloat(e.target.value))}
                  className="w-full accent-indigo-500 cursor-pointer"
                />
                <div className="flex justify-between text-[10px] text-slate-500">
                  <span>0.40 (엄격 차단)</span>
                  <span>0.70 (권장)</span>
                  <span>0.95 (느슨)</span>
                </div>
              </div>
            </div>
          </section>

          {/* Center Column: 9:16 Shorts Player + Cat Meme Swap */}
          <section className="lg:col-span-4">
            <ShortsPlayer
              shortItem={activeShort}
              result={activeResult}
              isSwappedView={isSwappedView}
              isScanningFlash={isScanningFlash}
              isFinalized={isFinalized}
              forceOriginal={forceOriginal}
              stagePhase={stagePhase}
              progressPct={progressPct}
              elapsedSec={elapsedSec}
              showNav={mode === 'feed'}
              onPrev={() => {
                const prev = (currentIndex - 1 + PRESET_SHORTS.length) % PRESET_SHORTS.length;
                setCurrentIndex(prev);
                setForceOriginal(false);
                runShortSequence(PRESET_SHORTS[prev], true, true, false);
              }}
              onNext={() => {
                const next = (currentIndex + 1) % PRESET_SHORTS.length;
                setCurrentIndex(next);
                setForceOriginal(false);
                runShortSequence(PRESET_SHORTS[next], true, true, false);
              }}
              onToggleForceOriginal={() => {
                const next = !forceOriginal;
                setForceOriginal(next);
                setIsSwappedView(activeResult.action === 'SWAP_TO_CAT_MEME' && !next);
              }}
              onRescan={() => {
                setForceOriginal(false);
                runShortSequence(activeShort, true, true, false);
              }}
            />
          </section>

          {/* Right Column: Stage 1~4 Breakdown & AI Reasoning */}
          <section className="lg:col-span-4">
            <StageBreakdown
              result={activeResult}
              onCopyJson={() => {
                navigator.clipboard.writeText(JSON.stringify(activeResult, null, 2));
                showToast('판정 JSON이 클립보드에 복사되었습니다.');
              }}
            />
          </section>
        </div>

        {/* Bottom: KPI & Audit Log */}
        <AnalyticsPanel
          stats={stats}
          logs={logs}
          logFilter={logFilter}
          onFilterChange={setLogFilter}
          onExportJson={handleExportJson}
          onExportMarkdown={handleExportMarkdown}
          onExportCsv={handleExportCsv}
          onClearLogs={() => {
            setLogs([]);
            setStats({ scanned: 0, blocked: 0, totalLatency: 0, carbonSaved: 0 });
            showToast('감사 로그가 초기화되었습니다.');
          }}
        />
      </main>
    </div>
  );
}
