import type { GameState, PedState } from '../core/types';

/** Local browser voices, subtitles, and bounded ambient barks. No network/voice cloning. */
export class Conversation {
  private subtitle = document.createElement('div');
  private enabled = false;
  private nextAt = 4;
  private actor: number | null = null;
  private startedAt = 0;
  private expiresAt = 0;
  private utterance: SpeechSynthesisUtterance | null = null;
  private currentPed: PedState | null = null;
  private disposed = false;
  private serial = 0;
  private greeted = false;

  constructor(host: HTMLElement) {
    this.subtitle.className = 'dialogue-subtitle';
    this.subtitle.setAttribute('role', 'status');
    this.subtitle.setAttribute('aria-live', 'polite');
    host.append(this.subtitle);
    host.addEventListener('pointerdown', this.unlock, { once: true });
    window.addEventListener('keydown', this.unlock, { once: true });
  }

  private unlock = () => { this.enabled = true; };

  update(state: GameState): { actor: number | null; mouth: number } {
    const now = performance.now() / 1000;
    if (this.actor !== null && (now > this.expiresAt || state.phase !== 'playing' || state.player.dead || (this.currentPed && (this.currentPed.health <= 0 || this.currentPed.vehicleId >= 0)))) this.finish();
    if (!this.enabled || state.phase !== 'playing') return { actor: null, mouth: 0 };
    if (this.actor === null && state.time >= this.nextAt && state.player.inVehicle < 0) {
      if (!this.greeted) {
        this.greeted = true;
        this.say(state, null, 'Tommy', 'Vice City. Let’s take a look around.');
      } else {
        const nearby = state.peds.filter(p => p.health > 0 && p.vehicleId < 0 && p.stunned <= 0 && Math.hypot(p.x - state.player.x, p.z - state.player.z) < 5);
        const ped = nearby.sort((a, b) => Math.hypot(a.x - state.player.x, a.z - state.player.z) - Math.hypot(b.x - state.player.x, b.z - state.player.z))[0];
        if (ped) {
          const normal = ['Beautiful day for a walk, huh?', 'Hey. Take it easy out there.', 'The beach is just down the road.', 'See you around, neighbor.'];
          const line = ped.kind === 'cop' ? 'Stop right there!' : ped.fleeing ? 'Hey! Watch where you’re going!' : normal[ped.id % normal.length];
          this.say(state, ped, ped.kind === 'cop' ? 'Officer' : 'Local', line);
        } else this.nextAt = state.time + 3;
      }
    }
    const elapsed = now - this.startedAt;
    return { actor: this.actor, mouth: this.actor === null ? 0 : .15 + .7 * Math.sin(elapsed * 13) ** 2 };
  }

  private say(state: GameState, ped: PedState | null, speaker: string, text: string): void {
    const seconds = Math.max(2.2, text.split(' ').length / 2.8);
    this.actor = ped?.id ?? 0;
    this.currentPed = ped;
    this.startedAt = performance.now() / 1000;
    this.expiresAt = this.startedAt + seconds + 1;
    this.nextAt = state.time + seconds + 14;
    if (ped && !ped.fleeing && ped.kind === 'civ') ped.talkingUntil = state.time + seconds;
    this.subtitle.textContent = `${speaker}: ${text}`;
    if (!('speechSynthesis' in window)) return;
    const utterance = new SpeechSynthesisUtterance(text);
    const voice = speechSynthesis.getVoices().find(v => v.lang.startsWith('en') && v.localService);
    if (voice) utterance.voice = voice;
    utterance.lang = 'en-US';
    utterance.rate = 1;
    utterance.volume = .65;
    const serial = ++this.serial;
    utterance.onend = () => { if (!this.disposed && serial === this.serial) this.finish(); };
    utterance.onerror = () => { if (serial === this.serial) this.utterance = null; };
    this.utterance = utterance;
    speechSynthesis.speak(utterance);
  }

  private finish(): void {
    this.serial++;
    if (this.utterance && 'speechSynthesis' in window && speechSynthesis.speaking) speechSynthesis.cancel();
    this.utterance = null;
    if (this.currentPed) this.currentPed.talkingUntil = 0;
    this.currentPed = null;
    this.actor = null;
    this.subtitle.textContent = '';
  }

  dispose(): void {
    this.disposed = true;
    this.finish();
    this.subtitle.parentElement?.removeEventListener('pointerdown', this.unlock);
    window.removeEventListener('keydown', this.unlock);
    this.subtitle.remove();
  }
}
