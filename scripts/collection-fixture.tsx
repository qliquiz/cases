// Browser-only test harness: not an application route and never uses a database.
import { useState } from 'react';
import { createRoot } from 'react-dom/client';

import { CollectionPanel } from '../src/app/collection-panel';
import { featuredCase } from '../src/game/catalog';
import type { CollectionEntry } from '../src/server/store';

const catalog = [...featuredCase.drops, ...featuredCase.rareDrops];
function entries(items: typeof catalog): CollectionEntry[] {
    return items.map((item, index) => ({
        id: String(index),
        caseId: featuredCase.id,
        itemId: item.id,
        item,
        openedAt: '2026-09-26T10:00:00.000Z',
    }));
}

function Fixture() {
    const [collection, setCollection] = useState<CollectionEntry[]>([]);
    const [remaining, setRemaining] = useState(0);
    return (
        <main className="mx-auto max-w-lg p-5">
            <div aria-label="Test controls">
                <button
                    onClick={() =>
                        setCollection(
                            entries([
                                catalog[0],
                                catalog[0],
                                catalog[0],
                                catalog[17],
                                catalog[18],
                            ]),
                        )
                    }
                >
                    Fixture partial
                </button>
                <button onClick={() => setCollection(entries(catalog))}>
                    Fixture full
                </button>
                <button onClick={() => setCollection([])}>Fixture empty</button>
                <button
                    onClick={() =>
                        setCollection((current) => [
                            ...current,
                            { ...entries([catalog[1]])[0], id: 'new' },
                        ])
                    }
                >
                    Fixture new drop
                </button>
            </div>
            <CollectionPanel
                collection={collection}
                remaining={remaining}
                onRefresh={() => setRemaining(5)}
            />
        </main>
    );
}

createRoot(document.getElementById('fixture')!).render(<Fixture />);
