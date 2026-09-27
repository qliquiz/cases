import type { Metadata } from 'next';

import { CraftScreen } from './craft-screen';
import { CraftShell } from './craft-shell';

export const metadata: Metadata = { title: 'Крафт скинов — CaseGo' };
export default function CraftPage() {
    return (
        <CraftShell>
            <CraftScreen />
        </CraftShell>
    );
}
