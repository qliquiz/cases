import assert from 'node:assert/strict';
import { test } from 'node:test';

import { verifyTelegramInitData } from './telegram-auth';

const validInitData =
    'auth_date=1700000000&query_id=AAE&user=%7B%22id%22%3A12345%2C%22first_name%22%3A%22Ada%22%7D&hash=db2e9bce73f0e051b12baee3df95c94f32b7296625f2ca0be512b2ffccecea5e';

test('подписанная Telegram initData подтверждает пользователя', () => {
    assert.deepEqual(
        verifyTelegramInitData(validInitData, '123456:TEST', 1_700_000_300),
        { id: '12345', firstName: 'Ada' },
    );
});
