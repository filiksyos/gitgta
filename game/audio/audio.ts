export class AudioFx {
  private ctx: AudioContext | null = null;
  private master: GainNode | null = null;
  private music: GainNode | null = null;
  private engine: OscillatorNode | null = null;
  private engineGain: GainNode | null = null;
  private siren: OscillatorNode | null = null;
  private sirenGain: GainNode | null = null;
  private sirenLfo: OscillatorNode | null = null;
  private started = false;

  resume(): void {
    if (!this.ctx) {
      const ctx = new AudioContext();
      this.ctx = ctx;
      this.master = ctx.createGain();
      this.master.gain.value = 0.22;
      this.master.connect(ctx.destination);
      this.music = ctx.createGain();
      this.music.gain.value = 0.35;
      this.music.connect(this.master);
    }
    void this.ctx.resume();
    if (!this.started) {
      this.started = true;
      this.startBed();
      this.startEngine();
      this.startSiren();
    }
  }

  setEngine(speed: number, driving: boolean): void {
    if (!this.engine || !this.engineGain || !this.ctx) return;
    const t = this.ctx.currentTime;
    const freq = 42 + Math.abs(speed) * 6.5;
    this.engine.frequency.setTargetAtTime(freq, t, 0.08);
    this.engineGain.gain.setTargetAtTime(driving ? 0.08 + Math.min(0.12, Math.abs(speed) * 0.004) : 0, t, 0.1);
  }

  setSiren(on: boolean): void {
    if (!this.sirenGain || !this.ctx) return;
    this.sirenGain.gain.setTargetAtTime(on ? 0.05 : 0, this.ctx.currentTime, 0.2);
  }

  setPursuit(on: boolean): void {
    if (!this.music || !this.ctx) return;
    this.music.gain.setTargetAtTime(on ? 0.5 : 0.28, this.ctx.currentTime, 0.4);
  }

  punch(): void {
    this.noise(0.09, 180, 90, "square");
  }

  gun(): void {
    this.noise(0.12, 420, 80, "sawtooth");
    this.noise(0.07, 140, 40, "square");
  }

  skid(): void {
    this.noise(0.08, 900, 400, "sawtooth");
  }

  impact(): void {
    this.noise(0.14, 90, 40, "square");
  }

  win(): void {
    this.tone(523, 0.12);
    this.tone(659, 0.12, 0.12);
    this.tone(784, 0.18, 0.24);
  }

  fail(): void {
    this.tone(196, 0.2);
    this.tone(147, 0.28, 0.16);
  }

  private startBed(): void {
    if (!this.ctx || !this.music) return;
    const ctx = this.ctx;
    const bass = ctx.createOscillator();
    bass.type = "triangle";
    bass.frequency.value = 49;
    const g = ctx.createGain();
    g.gain.value = 0.18;
    bass.connect(g).connect(this.music);
    bass.start();

    const hat = ctx.createOscillator();
    hat.type = "square";
    hat.frequency.value = 2.2;
    const hatG = ctx.createGain();
    hatG.gain.value = 0.012;
    const hatTone = ctx.createOscillator();
    hatTone.type = "sawtooth";
    hatTone.frequency.value = 220;
    hat.connect(hatG);
    hatG.connect(hatTone.frequency);
    const hg = ctx.createGain();
    hg.gain.value = 0.03;
    hatTone.connect(hg).connect(this.music);
    hat.start();
    hatTone.start();
  }

  private startEngine(): void {
    if (!this.ctx || !this.master) return;
    this.engine = this.ctx.createOscillator();
    this.engine.type = "sawtooth";
    this.engine.frequency.value = 50;
    this.engineGain = this.ctx.createGain();
    this.engineGain.gain.value = 0;
    const filter = this.ctx.createBiquadFilter();
    filter.type = "lowpass";
    filter.frequency.value = 420;
    this.engine.connect(filter).connect(this.engineGain).connect(this.master);
    this.engine.start();
  }

  private startSiren(): void {
    if (!this.ctx || !this.master) return;
    this.siren = this.ctx.createOscillator();
    this.siren.type = "sine";
    this.siren.frequency.value = 620;
    this.sirenGain = this.ctx.createGain();
    this.sirenGain.gain.value = 0;
    this.sirenLfo = this.ctx.createOscillator();
    this.sirenLfo.frequency.value = 1.6;
    const lfoG = this.ctx.createGain();
    lfoG.gain.value = 140;
    this.sirenLfo.connect(lfoG).connect(this.siren.frequency);
    this.siren.connect(this.sirenGain).connect(this.master);
    this.siren.start();
    this.sirenLfo.start();
  }

  private noise(dur: number, freq: number, end: number, type: OscillatorType): void {
    if (!this.ctx || !this.master) return;
    const o = this.ctx.createOscillator();
    o.type = type;
    const g = this.ctx.createGain();
    const t = this.ctx.currentTime;
    o.frequency.setValueAtTime(freq, t);
    o.frequency.exponentialRampToValueAtTime(Math.max(40, end), t + dur);
    g.gain.setValueAtTime(0.12, t);
    g.gain.exponentialRampToValueAtTime(0.001, t + dur);
    o.connect(g).connect(this.master);
    o.start(t);
    o.stop(t + dur + 0.02);
  }

  private tone(freq: number, dur: number, delay = 0): void {
    if (!this.ctx || !this.master) return;
    const o = this.ctx.createOscillator();
    o.type = "triangle";
    const g = this.ctx.createGain();
    const t = this.ctx.currentTime + delay;
    o.frequency.value = freq;
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(0.1, t + 0.02);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(g).connect(this.master);
    o.start(t);
    o.stop(t + dur + 0.05);
  }
}
