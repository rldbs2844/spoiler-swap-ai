import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

export async function GET() {
  return NextResponse.json({
    ok: true,
    service: 'Spoiler-Swap AI Next.js API',
    runtime: 'nextjs-app-router',
    version: '2.3.0',
    capabilities: {
      youtube_data_api_v3: Boolean(process.env.YOUTUBE_API_KEY?.trim()),
      youtube_oembed: true,
      gemini_stage4: Boolean(process.env.GEMINI_API_KEY?.trim()),
      openai_stage4: Boolean(process.env.OPENAI_API_KEY?.trim()),
      on_device_4stage: true
    },
    timestamp: new Date().toISOString()
  });
}
