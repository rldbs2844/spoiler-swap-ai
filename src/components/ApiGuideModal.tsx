'use client';

import React, { useState } from 'react';

interface ApiGuideModalProps {
  open: boolean;
  onClose: () => void;
  capabilities: {
    youtube_data_api_v3: boolean;
    gemini_stage4: boolean;
    openai_stage4: boolean;
  } | null;
}

interface ProbeResponse {
  version: string;
  gemini: {
    configured: boolean;
    keyPrefix: string | null;
    ok: boolean;
    testedModel?: string;
    availableModels: string[];
    attempts?: string[];
    error?: string;
  };
  youtube: {
    configured: boolean;
    keyPrefix: string | null;
    ok: boolean;
    error?: string;
  };
}

export default function ApiGuideModal({ open, onClose, capabilities }: ApiGuideModalProps) {
  const [probing, setProbing] = useState(false);
  const [probeError, setProbeError] = useState<string | null>(null);
  const [probeResult, setProbeResult] = useState<ProbeResponse | null>(null);

  if (!open) return null;

  const handleProbe = async () => {
    setProbing(true);
    setProbeError(null);
    try {
      const resp = await fetch('/api/ai-check', { cache: 'no-store' });
      if (resp.ok) {
        setProbeResult(await resp.json());
      } else {
        setProbeError(`서버 진단 응답 오류 (HTTP ${resp.status})`);
      }
    } catch {
      setProbeError('진단 API 요청 중 네트워크 오류가 발생했습니다.');
    } finally {
      setProbing(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/75 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="w-full max-w-xl rounded-2xl bg-slate-900 border border-slate-700 shadow-2xl overflow-hidden">
        <div className="p-4 border-b border-slate-800 flex items-center justify-between">
          <h2 className="text-base font-bold text-white">🔌 외부 API 연동 상태 및 진단</h2>
          <button
            type="button"
            onClick={onClose}
            className="px-2.5 py-1 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-semibold cursor-pointer"
          >
            닫기 ✕
          </button>
        </div>

        <div className="p-4 space-y-4 text-xs text-slate-300 max-h-[75vh] overflow-y-auto">
          <p className="leading-relaxed text-slate-300">
            이 웹 앱은 <strong className="text-white">API 키가 없어도</strong> YouTube oEmbed + 공개 자막 파서 + 온디바이스 4단계 엔진으로 즉시 동작합니다. 아래 버튼으로 현재 서버에 연결된 API 키의 실제 응답 상태를 바로 확인할 수 있습니다.
          </p>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handleProbe}
              disabled={probing}
              className="px-3.5 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white text-xs font-bold transition cursor-pointer"
            >
              {probing ? '실제 API 응답 테스트 중...' : '⚡ 지금 바로 API 실제 연동 테스트'}
            </button>
          </div>

          {probeError && (
            <div className="p-2.5 rounded-xl bg-rose-950/60 border border-rose-500/40 text-xs text-rose-200">
              {probeError}
            </div>
          )}

          {probeResult && (
            <div className="p-3 rounded-xl bg-slate-950 border border-indigo-500/40 space-y-2">
              <div className="text-[11px] font-bold text-indigo-300">
                실시간 API 진단 결과 (버전 {probeResult.version})
              </div>
              <div className="space-y-1.5">
                <div className="flex items-center justify-between gap-2">
                  <span className="mono font-semibold text-white shrink-0">
                    GEMINI_API_KEY ({probeResult.gemini.keyPrefix || '미설정'})
                  </span>
                  <span
                    className={`px-2 py-0.5 rounded-full text-[10px] font-bold truncate max-w-[300px] ${
                      probeResult.gemini.ok
                        ? 'bg-emerald-500/20 text-emerald-300'
                        : 'bg-rose-500/20 text-rose-300'
                    }`}
                  >
                    {probeResult.gemini.ok
                      ? '정상 작동 (200 OK)'
                      : probeResult.gemini.error || '실패'}
                  </span>
                </div>
                {probeResult.gemini.testedModel && (
                  <div className="text-[11px] text-indigo-300">
                    실제 호출 성공 모델:{' '}
                    <span className="mono font-bold">{probeResult.gemini.testedModel}</span>
                  </div>
                )}
                {probeResult.gemini.availableModels.length > 0 && (
                  <div className="text-[11px] text-slate-400">
                    사용 가능 모델: {probeResult.gemini.availableModels.join(', ')}
                  </div>
                )}
                {probeResult.gemini.attempts && probeResult.gemini.attempts.length > 0 && (
                  <div className="p-2 rounded-lg bg-slate-900 border border-slate-800 text-[10px] text-slate-400 mono space-y-0.5">
                    {probeResult.gemini.attempts.map((att, i) => (
                      <div key={i} className="break-all">
                        • {att}
                      </div>
                    ))}
                  </div>
                )}
                {probeResult.gemini.error && (
                  <div className="p-2 rounded-lg bg-amber-950/50 border border-amber-500/30 text-[11px] text-amber-200 leading-relaxed">
                    💡 <strong>해결 팁:</strong> Google Cloud Console → API 및 서비스 → 사용자 인증 정보에서 해당 Gemini API 키의 &quot;API 제한사항&quot;이
                    <code className="mx-1 text-amber-100">Generative Language API</code>로 허용되어 있는지(또는 AI Studio에서 새로 발급한 키인지) 확인해 주세요.
                  </div>
                )}

                <div className="flex items-center justify-between pt-1">
                  <span className="mono font-semibold text-white">
                    YOUTUBE_API_KEY ({probeResult.youtube.keyPrefix || '미설정'})
                  </span>
                  <span
                    className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                      probeResult.youtube.ok
                        ? 'bg-emerald-500/20 text-emerald-300'
                        : 'bg-rose-500/20 text-rose-300'
                    }`}
                  >
                    {probeResult.youtube.ok
                      ? '정상 작동 (200 OK)'
                      : probeResult.youtube.error || '실패'}
                  </span>
                </div>
              </div>
            </div>
          )}

          <div className="space-y-2">
            <div className="p-3 rounded-xl bg-slate-950 border border-slate-800 flex items-center justify-between gap-3">
              <div>
                <div className="font-bold text-white mono">YOUTUBE_API_KEY</div>
                <div className="text-slate-400 mt-0.5">
                  실시간 유튜브 쇼츠 키워드 검색 + 설명란·태그·조회수 수집
                </div>
              </div>
              <span
                className={`px-2 py-0.5 rounded-full font-bold text-[11px] shrink-0 ${
                  capabilities?.youtube_data_api_v3
                    ? 'bg-emerald-500/20 text-emerald-300'
                    : 'bg-slate-800 text-slate-400'
                }`}
              >
                {capabilities?.youtube_data_api_v3 ? '연결됨' : 'oEmbed/파서 폴백'}
              </span>
            </div>

            <div className="p-3 rounded-xl bg-slate-950 border border-slate-800 flex items-center justify-between gap-3">
              <div>
                <div className="font-bold text-white mono">GEMINI_API_KEY</div>
                <div className="text-slate-400 mt-0.5">
                  Stage 4에서 Gemini Flash로 텍스트 + 썸네일 이미지 멀티모달 판정 및 근거 생성
                </div>
              </div>
              <span
                className={`px-2 py-0.5 rounded-full font-bold text-[11px] shrink-0 ${
                  capabilities?.gemini_stage4
                    ? 'bg-emerald-500/20 text-emerald-300'
                    : 'bg-slate-800 text-slate-400'
                }`}
              >
                {capabilities?.gemini_stage4 ? '연결됨' : '온디바이스 폴백'}
              </span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
