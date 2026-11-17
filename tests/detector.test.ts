import assert from 'node:assert/strict';
import test from 'node:test';
import { PRESET_SHORTS } from '../src/lib/constants';
import { evaluateShort } from '../src/lib/detector';
import { extractYouTubeVideoId } from '../src/lib/youtube';

const EXPECTED_KEYS = [
  'video_id',
  'channel',
  'latency_ms',
  'threshold',
  'confidence_score',
  'action',
  'matched_watchlist_entities',
  'matched_spoiler_triggers',
  'stages',
  'swap_asset',
  'esg_on_device_carbon_saved_g'
].sort();

test('PRESET_SHORTS produce expected SWAP_TO_CAT_MEME and PASS decisions', () => {
  const results = PRESET_SHORTS.map((item) => evaluateShort(item));

  assert.equal(results[0].video_id, 'yt_short_001');
  assert.equal(results[0].action, 'PASS');
  assert.equal(results[0].swap_asset, null);

  assert.equal(results[1].video_id, 'yt_short_002');
  assert.equal(results[1].action, 'SWAP_TO_CAT_MEME');
  assert.ok(results[1].confidence_score >= 0.7);
  assert.ok(results[1].matched_watchlist_entities.includes('오징어 게임'));
  assert.ok(results[1].swap_asset !== null);
  assert.equal(results[1].swap_asset?.type, 'local_cached_cat_meme');

  assert.equal(results[2].video_id, 'yt_short_003');
  assert.equal(results[2].action, 'PASS');

  assert.equal(results[3].video_id, 'yt_short_004');
  assert.equal(results[3].action, 'SWAP_TO_CAT_MEME');
  assert.ok(results[3].matched_watchlist_entities.includes('범죄도시'));

  assert.equal(results[4].video_id, 'yt_short_005');
  assert.equal(results[4].action, 'SWAP_TO_CAT_MEME');
  assert.ok(results[4].matched_watchlist_entities.includes('롤드컵'));
});

test('EvaluationResult strictly matches expected JSON schema', () => {
  const res = evaluateShort(PRESET_SHORTS[1]);
  assert.deepEqual(Object.keys(res).sort(), EXPECTED_KEYS);
  assert.equal(res.esg_on_device_carbon_saved_g, 0.42);
  assert.ok(typeof res.latency_ms === 'number' && res.latency_ms > 0);
  assert.ok(res.stages.stage1_metadata.latency_ms > 0);
  assert.ok(res.stages.stage2_on_device_ocr.latency_ms > 0);
  assert.ok(res.stages.stage3_lightweight_stt.latency_ms > 0);
  assert.ok(res.stages.stage4_kg_koelectra.latency_ms > 0);
});

test('Custom threshold controls SWAP_TO_CAT_MEME vs PASS', () => {
  const strictRes = evaluateShort(PRESET_SHORTS[1], { threshold: 1.0 });
  assert.equal(strictRes.action, 'PASS');
  assert.equal(strictRes.swap_asset, null);

  const sensitiveRes = evaluateShort(PRESET_SHORTS[1], { threshold: 0.5 });
  assert.equal(sensitiveRes.action, 'SWAP_TO_CAT_MEME');
  assert.ok(sensitiveRes.swap_asset !== null);
});

test('extractYouTubeVideoId parses Shorts, watch, youtu.be, and raw IDs', () => {
  assert.equal(
    extractYouTubeVideoId('https://www.youtube.com/shorts/dQw4w9WgXcQ'),
    'dQw4w9WgXcQ'
  );
  assert.equal(
    extractYouTubeVideoId('https://youtube.com/shorts/abc123DEF45?feature=share'),
    'abc123DEF45'
  );
  assert.equal(
    extractYouTubeVideoId('https://www.youtube.com/watch?v=abc123DEF45'),
    'abc123DEF45'
  );
  assert.equal(extractYouTubeVideoId('https://youtu.be/abc123DEF45'), 'abc123DEF45');
  assert.equal(extractYouTubeVideoId('abc123DEF45'), 'abc123DEF45');
  assert.equal(extractYouTubeVideoId('https://example.com/not-youtube'), null);
  assert.equal(extractYouTubeVideoId(''), null);
});
