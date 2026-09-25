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

export function tryPlaySound(
    context: AudioContext,
    play: (context: AudioContext) => void,
): boolean {
    try {
        play(context);
        return true;
    } catch {
        return false;
    }
}

export function playPreviewSound(context: AudioContext) {
    playTone(context, 660, context.currentTime, 0.24, 0.18);
}

export function playTickSound(context: AudioContext) {
    playTone(context, 780, context.currentTime, 0.04, 0.09);
}

export function playResultSound(context: AudioContext) {
    const now = context.currentTime;
    playTone(context, 520, now, 0.14, 0.16);
    playTone(context, 780, now + 0.09, 0.24, 0.14);
}
