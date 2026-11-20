import assert from 'node:assert/strict';
import { test } from 'node:test';
import { createSound } from '../src/audio.js';

test('nhạc và mỗi hiệu ứng Phase 2 tạo nốt với tần số và thời điểm riêng', (t) => {
  const notes = [];
  const createGain = () => ({
    gain: { setTargetAtTime() {}, setValueAtTime() {}, exponentialRampToValueAtTime() {} },
    connect() {},
  });
  class TestAudioContext {
    currentTime = 10;
    state = 'running';
    destination = {};
    createGain = createGain;

    createOscillator() {
      return {
        frequency: {},
        connect: (node) => node,
        start(time) { notes.push({ frequency: this.frequency.value, time }); },
        stop() {},
      };
    }
  }

  const saved = globalThis.AudioContext;
  globalThis.AudioContext = TestAudioContext;
  const sound = createSound();
  t.after(() => {
    sound.stop();
    if (saved === undefined) delete globalThis.AudioContext;
    else globalThis.AudioContext = saved;
  });

  sound.music(2);
  assert.equal(notes.length, 4);
  assert.deepEqual(notes.map(({ frequency }) => frequency), [110, 164.81, 220, 261.63]);
  const cues = ['mote_picked', 'lantern_lit', 'pulse', 'player_hit', 'jump', 'dash', 'won',
    'lost', 'shade_spawned', 'countdown', 'wind'];
  const signatures = cues.map((cue) => {
    const start = notes.length;
    sound.cue(cue);
    const phrase = notes.slice(start);
    assert.ok(phrase.length > 1, cue);
    assert.equal(phrase[0].time, 10);
    return JSON.stringify(phrase);
  });
  assert.equal(new Set(signatures).size, cues.length);
});
