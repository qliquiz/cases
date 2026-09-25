import { cookies } from 'next/headers';

import { database } from './db';
import { getSession } from './store';

export const sessionCookieName = 'case_lab_session';

export async function currentSession() {
    const token = (await cookies()).get(sessionCookieName)?.value;
    if (!token) return null;
    return getSession(database(), token);
}
