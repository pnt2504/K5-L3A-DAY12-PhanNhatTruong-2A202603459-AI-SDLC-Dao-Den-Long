const effects = {
  mote_picked: [[880, 0, 0.08], [1319, 0.04, 0.12]],
  lantern_lit: [[392, 0, 0.4], [587, 0.08, 0.44], [784, 0.16, 0.65]],
  pulse: [[151, 0, 0.28], [302, 0.04, 0.45], [620, 0.07, 0.38]],
  player_hit: [[169, 0, 0.16], [102, 0.07, 0.3]],
  jump: [[246, 0, 0.14], [414, 0.025, 0.09]],
  dash: [[218, 0, 0.09], [436, 0.02, 0.19]],
  won: [[523, 0, 0.55], [659, 0.14, 0.6], [784, 0.28, 0.8], [1046, 0.42, 0.8]],
  lost: [[349, 0, 0.45], [262, 0.15, 0.5], [196, 0.3, 0.7]],
  shade_spawned: [[111, 0, 0.34], [118, 0, 0.34]],
  countdown: [[659, 0, 0.13], [988, 0.04, 0.14]],
  wind: [[154, 0, 0.72], [214, 0.25, 0.91], [271, 0.56, 0.8]],
  charm_picked: [[440, 0, 0.2], [660, 0.07, 0.33], [990, 0.14, 0.31]],
  drifter_steal: [[293, 0, 0.13], [220, 0.08, 0.18]],
};

const motifs = [
  [130.81, 196, 261.63, 329.63],
  [110, 164.81, 220, 261.63],
  [146.83, 220, 293.66, 349.23],
  [98, 146.83, 196, 246.94],
];

export function createSound() {
  let context;
  let master;
  let interval;
  let volume = 0.55;
  let phrase = 0;

  function unlock() {
    const Audio = globalThis.AudioContext ?? globalThis.webkitAudioContext;
    if (!Audio) return;
    if (!context) {
      context = new Audio();
      master = context.createGain();
      master.gain.value = volume;
      master.connect(context.destination);
    }
    if (context.state === 'suspended') context.resume().catch(() => {});
  }

  function note(frequency, delay, length, level, type = 'sine') {
    const time = context.currentTime + delay;
    const oscillator = context.createOscillator();
    const envelope = context.createGain();
    oscillator.type = type;
    oscillator.frequency.value = frequency;
    envelope.gain.setValueAtTime(0.0001, time);
    envelope.gain.exponentialRampToValueAtTime(level, time + Math.min(length / 3, 0.075));
    envelope.gain.exponentialRampToValueAtTime(0.0001, time + length);
    oscillator.connect(envelope).connect(master);
    oscillator.start(time);
    oscillator.stop(time + length + 0.02);
  }

  return {
    volume(value) {
      volume = value;
      if (master) master.gain.setTargetAtTime(value, context.currentTime, 0.045);
    },
    cue(name) {
      if (!context || !effects[name]) return;
      for (const [frequency, delay, length] of effects[name]) {
        note(frequency, delay, length, name === 'wind' ? 0.07 : 0.1, name === 'wind' ? 'triangle' : 'sine');
      }
    },
    music(night) {
      unlock();
      if (!context || interval) return;
      phrase = 0;
      const play = () => {
        const chord = motifs[(phrase + night - 1) % motifs.length];
        chord.forEach((frequency, index) => note(frequency, index * 0.35, 1.9 - index * 0.13, 0.035));
        phrase += 1;
      };
      play();
      interval = setInterval(play, 2600);
    },
    stop() {
      clearInterval(interval);
      interval = undefined;
    },
  };
}
