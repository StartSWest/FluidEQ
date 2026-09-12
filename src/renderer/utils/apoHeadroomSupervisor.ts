export default class ApoHeadroomSupervisor {
  private trimDb: number;

  private appliedDb: number;

  private quietMs = 0;

  private elapsedMs = 0;

  private pending = false;

  private reassessing = false;

  notifyEdit(): void {
    this.reassessing = true;
    this.quietMs = 0;
  }

  constructor(initialTrimDb = 0, pending = false) {
    this.trimDb = Number.isFinite(initialTrimDb)
      ? Math.max(-20, Math.min(0, initialTrimDb))
      : 0;
    this.appliedDb = this.trimDb;
    this.pending = pending;
  }

  observe(peakDbfs: number, durationMs: number): number | undefined {
    const elapsed = Math.min(250, Math.max(0, durationMs));
    if (!Number.isFinite(elapsed) || this.pending) {
      return undefined;
    }
    this.elapsedMs += elapsed;
    if (!Number.isFinite(peakDbfs) || peakDbfs < -65) {
      this.quietMs = 0;
      return undefined;
    }
    if (peakDbfs > -1) {
      this.quietMs = 0;
      const justified = this.appliedDb - (peakDbfs + 1);
      this.trimDb = Math.max(-20, Math.min(this.trimDb, justified));
    } else if (this.reassessing && peakDbfs < -1.5) {
      this.trimDb = Math.min(0, this.appliedDb + 0.5);
    } else if (peakDbfs < -3) {
      this.quietMs += elapsed;
      if (this.quietMs > 10000) {
        this.trimDb = Math.min(0, this.trimDb + elapsed * 0.00005);
      }
    } else {
      this.quietMs = 0;
    }
    const delta = this.trimDb - this.appliedDb;
    if (
      Math.abs(delta) < 0.25 ||
      this.elapsedMs < (delta < 0 || this.reassessing ? 2000 : 15000)
    ) {
      return undefined;
    }
    this.pending = true;
    this.reassessing = false;
    return (
      Math.round(
        (this.appliedDb + Math.max(-0.5, Math.min(0.5, delta))) * 100,
      ) / 100
    );
  }

  acknowledge(trimDb: number): void {
    this.appliedDb = trimDb;
    this.trimDb = trimDb;
    this.elapsedMs = 0;
    this.quietMs = 0;
    this.pending = false;
  }
}
