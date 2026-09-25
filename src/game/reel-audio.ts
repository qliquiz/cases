export function cardAtMarker(
    markerX: number,
    trackX: number,
    cardWidth: number,
    cardStep: number,
): number {
    return Math.round((markerX - trackX - cardWidth / 2) / cardStep);
}

function playTone(
    context: AudioContext,
    frequency: number,
    start: number,
    duration: number,
    volume: number,
) {
    const oscillator = context.createOscillator();
    const gain = context.createGain();

    oscillator.type = 'triangle';
    oscillator.frequency.setValueAtTime(frequency, start);
    gain.gain.setValueAtTime(volume, start);
    gain.gain.exponentialRampToValueAtTime(0.0001, start + duration);
    oscillator.connect(gain);
    gain.connect(context.destination);
    oscillator.start(start);
    oscillator.stop(start + duration);
}

export function playTickSound(context: AudioContext) {
    playTone(context, 780, context.currentTime, 0.03, 0.035);
}

export function playResultSound(context: AudioContext) {
    const now = context.currentTime;
    playTone(context, 520, now, 0.11, 0.05);
    playTone(context, 780, now + 0.07, 0.2, 0.045);
}
