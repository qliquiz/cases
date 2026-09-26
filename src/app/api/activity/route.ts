import { recordActivity } from '@/server/analytics';
import { handleActivity } from '@/server/analytics-handler';
import { appOrigin } from '@/server/auth-config';
import { database } from '@/server/db';
import { currentSession } from '@/server/session';

export const runtime = 'nodejs';

export async function POST(request: Request) {
    return handleActivity(request, {
        origin: appOrigin(),
        getUserId: async () => (await currentSession())?.userId ?? null,
        record: (userId, event) => recordActivity(database(), userId, event),
    });
}
