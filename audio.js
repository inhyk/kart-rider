export class AudioManager {
  constructor() {
    this.enabled = true;
    this.ctx = null;
    this.lastBeat = -1;
    this.voices = new Set();
    try {
      this.enabled = localStorage.getItem("pocket-gp-sound") !== "off";
    } catch {}
  }
  start() {
    if (!this.enabled) return;
    try {
      if (!this.ctx) {
        const A = window.AudioContext || window.webkitAudioContext;
        this.ctx = new A();
        const c = this.ctx;
        this.master = c.createGain();
        this.master.gain.value = 0.5;
        this.limiter = c.createDynamicsCompressor();
        this.limiter.threshold.value = -12;
        this.limiter.knee.value = 10;
        this.limiter.ratio.value = 8;
        this.limiter.attack.value = 0.003;
        this.limiter.release.value = 0.15;
        this.master.connect(this.limiter).connect(c.destination);
        this.engine = c.createOscillator();
        this.engine.type = "sawtooth";
        this.engineFilter = c.createBiquadFilter();
        this.engineFilter.type = "lowpass";
        this.engineFilter.frequency.value = 700;
        this.engineGain = c.createGain();
        this.engineGain.gain.value = 0;
        this.engine
          .connect(this.engineFilter)
          .connect(this.engineGain)
          .connect(this.master);
        this.engine.start();
        this.sub = c.createOscillator();
        this.sub.type = "triangle";
        this.subGain = c.createGain();
        this.subGain.gain.value = 0;
        this.sub.connect(this.subGain).connect(this.master);
        this.sub.start();
        const buffer = c.createBuffer(1, c.sampleRate * 2, c.sampleRate),
          data = buffer.getChannelData(0);
        for (let i = 0; i < data.length; i++) data[i] = Math.random() * 2 - 1;
        this.noise = c.createBufferSource();
        this.noise.buffer = buffer;
        this.noise.loop = true;
        const filter = c.createBiquadFilter();
        filter.type = "bandpass";
        filter.frequency.value = 1600;
        filter.Q.value = 0.5;
        this.skid = c.createGain();
        this.skid.gain.value = 0;
        this.noise.connect(filter).connect(this.skid).connect(this.master);
        this.noise.start();
      }
      void this.ctx.resume().catch(() => {});
    } catch {
      this.enabled = false;
    }
  }
  toggle() {
    this.enabled = !this.enabled;
    try {
      localStorage.setItem("pocket-gp-sound", this.enabled ? "on" : "off");
    } catch {}
    if (this.enabled) this.start();
    else if (this.ctx) void this.ctx.suspend().catch(() => {});
    return this.enabled;
  }
  tone(
    freq,
    duration = 0.1,
    type = "sine",
    volume = 0.08,
    slide = null,
    delay = 0,
  ) {
    if (!this.enabled || !this.ctx || this.voices.size >= 48) return;
    const c = this.ctx,
      t = c.currentTime + delay,
      o = c.createOscillator(),
      g = c.createGain();
    o.type = type;
    o.frequency.setValueAtTime(freq, t);
    if (slide)
      o.frequency.exponentialRampToValueAtTime(
        Math.max(20, slide),
        t + duration,
      );
    g.gain.setValueAtTime(0.001, t);
    g.gain.exponentialRampToValueAtTime(volume, t + 0.008);
    g.gain.exponentialRampToValueAtTime(0.0001, t + duration);
    o.connect(g).connect(this.master);
    this.voices.add(o);
    o.onended = () => {
      o.disconnect();
      g.disconnect();
      this.voices.delete(o);
    };
    o.start(t);
    o.stop(t + duration + 0.02);
  }
  effect(type) {
    if (type === "pickup") {
      for (let i = 0; i < 3; i++)
        this.tone([660, 880, 1320][i], 0.14, "sine", 0.12, null, i * 0.065);
    } else if (type === "boost" || type === "driftBoost") {
      this.tone(150, 0.3, "triangle", 0.1, 950);
      this.tone(300, 0.3, "sine", 0.08, 1400, 0.06);
    } else if (type === "impact" || type === "wall" || type === "bump") {
      this.tone(110, 0.18, "sawtooth", 0.08, 35);
    } else if (type === "splash") this.tone(450, 0.3, "sine", 0.13, 90);
    else if (type === "block") {
      this.tone(1100, 0.22, "sine", 0.12, 1900);
    } else if (type === "lightning") this.tone(180, 0.27, "square", 0.045, 40);
    else if (type === "finish") {
      for (let i = 0; i < 6; i++)
        this.tone(
          [523, 659, 784, 1047, 784, 1047][i],
          0.35,
          "triangle",
          0.1,
          null,
          i * 0.12,
        );
    } else if (type === "start") {
      this.tone(1000, 0.35, "square", 0.04);
    } else if (type === "count") this.tone(500, 0.12, "square", 0.05);
    else if (type === "use") this.tone(380, 0.12, "triangle", 0.08, 850);
  }
  update(g) {
    if (!this.ctx || !this.enabled) return;
    const c = this.ctx,
      r = g?.racers[0],
      active = g?.mode === "racing",
      speed = r?.speed || 0;
    this.engine.frequency.setTargetAtTime(
      48 + speed * 3.3 - Math.floor(speed / 12) * 12 + (r?.boost > 0 ? 35 : 0),
      c.currentTime,
      0.09,
    );
    this.engineGain.gain.setTargetAtTime(
      active ? 0.012 + speed * 0.00012 : 0,
      c.currentTime,
      0.15,
    );
    this.engineFilter.frequency.setTargetAtTime(
      400 + speed * 15,
      c.currentTime,
      0.15,
    );
    this.sub.frequency.setTargetAtTime(32 + speed * 1.7, c.currentTime, 0.12);
    this.subGain.gain.setTargetAtTime(active ? 0.008 : 0, c.currentTime, 0.15);
    this.skid.gain.setTargetAtTime(
      active && r?.drifting ? 0.026 : 0,
      c.currentTime,
      0.1,
    );
    if (active) {
      const beat = Math.floor(g.time / 0.2);
      if (beat !== this.lastBeat) {
        this.lastBeat = beat;
        const melodies = [
            [
              0, 4, 7, 12, 11, 7, 4, -1, 2, 5, 9, 14, 12, 9, 5, -1, 4, 7, 12,
              16, 14, 12, 7, 4, 2, 7, 11, 14, 12, 7, 4, -1,
            ],
            [
              0, 3, 7, 10, 7, 3, 0, -1, 5, 8, 12, 15, 12, 8, 5, -1, 3, 7, 10,
              14, 10, 7, 3, -1, 2, 5, 9, 14, 9, 5, 2, -1,
            ],
            [
              0, 7, 12, 7, 3, 10, 15, 10, 5, 12, 17, 12, 7, 14, 19, -1, 0, 7,
              10, 14, 12, 7, 3, 7, 5, 8, 12, 15, 14, 10, 7, -1,
            ],
          ],
          base = g.track === 1 ? 196 : g.track === 2 ? 220 : 261.63,
          note = melodies[g.track][beat % 32],
          chord = [0, 5, 9, 7][Math.floor(beat / 16) % 4];
        if (note >= 0)
          this.tone(base * Math.pow(2, note / 12), 0.16, "triangle", 0.021);
        if (beat % 4 === 0)
          this.tone(
            base * 0.5 * Math.pow(2, (chord + (beat % 8 === 4 ? 7 : 0)) / 12),
            0.3,
            "sine",
            0.035,
          );
        if (beat % 4 === 0) this.tone(120, 0.11, "sine", 0.045, 42);
        if (beat % 4 === 2) this.tone(170, 0.07, "triangle", 0.025, 80);
        if (beat % 2 === 1) this.tone(4600, 0.025, "square", 0.002, 2800);
      }
    }
  }
}
