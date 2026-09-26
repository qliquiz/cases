import { type ActivityEvent, isActivityEvent } from '@/game/analytics-events';

type Services = {
    origin: string;
    getUserId: () => Promise<string | null>;
    record: (userId: string, event: ActivityEvent) => Promise<void>;
};

export async function handleActivity(request: Request, services: Services) {
    const respond = (status: number) =>
        new Response(null, {
            status,
            headers: { 'Cache-Control': 'no-store' },
        });
    if (request.headers.get('origin') !== services.origin) return respond(403);
    try {
        const reader = request.body?.getReader();
        if (!reader) return respond(400);
        let body = '';
        let size = 0;
        const decoder = new TextDecoder();
        try {
            while (true) {
                const chunk = await reader.read();
                if (chunk.done) break;
                size += chunk.value.byteLength;
                if (size > 32) {
                    await reader.cancel();
                    return respond(413);
                }
                body += decoder.decode(chunk.value, { stream: true });
            }
            body += decoder.decode();
        } finally {
            reader.releaseLock();
        }
        if (!isActivityEvent(body)) return respond(400);
        const userId = await services.getUserId();
        if (!userId) return respond(401);
        await services.record(userId, body);
        return respond(204);
    } catch {
        // Analytics failure never changes the game state or exposes DB details.
        return respond(503);
    }
}
