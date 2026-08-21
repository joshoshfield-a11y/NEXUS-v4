export class TransientDetector {
  private envelope = 0;
  private follower = 0;
  private lastFollower = 0;
  private cooldown = 0;

  constructor(
    private sampleRate: number,
    private attackMs: number,
    private releaseMs: number,
    private sensitivityAttackMs: number,
    private sensitivityReleaseMs: number,
    private ratio: number,
    private gain: number,
  ) {}

  reset() {
    this.envelope = 0;
    this.follower = 0;
    this.lastFollower = 0;
    this.cooldown = 0;
  }

  process(sample: number, _time: number) {
    const abs = Math.abs(sample) * this.gain;

    const attackCoef = Math.exp(-1 / (this.sampleRate * this.attackMs / 1000));
    const releaseCoef = Math.exp(-1 / (this.sampleRate * this.releaseMs / 1000));

    if (abs > this.envelope) {
      this.envelope = attackCoef * this.envelope + (1 - attackCoef) * abs;
    } else {
      this.envelope = releaseCoef * this.envelope + (1 - releaseCoef) * abs;
    }

    const sensAttackCoef = Math.exp(-1 / (this.sampleRate * this.sensitivityAttackMs / 1000));
    const sensReleaseCoef = Math.exp(-1 / (this.sampleRate * this.sensitivityReleaseMs / 1000));

    if (this.envelope > this.follower) {
      this.follower = sensAttackCoef * this.follower + (1 - sensAttackCoef) * this.envelope;
    } else {
      this.follower = sensReleaseCoef * this.follower + (1 - sensReleaseCoef) * this.envelope;
    }

    const diff = this.follower - this.lastFollower;
    this.lastFollower = this.follower;

    const threshold = this.follower * this.ratio;
    let isOnset = false;

    if (this.cooldown > 0) {
      this.cooldown--;
    } else if (diff > threshold && this.envelope > 0.001) {
      isOnset = true;
      this.cooldown = Math.round(this.sampleRate * 0.05); // 50ms cooldown
    }

    return { envelope: Math.min(1, this.envelope), isOnset };
  }
}
