export type ActivityEvent = 'visit' | 'collection_view';

export function isActivityEvent(value: unknown): value is ActivityEvent {
    return value === 'visit' || value === 'collection_view';
}
