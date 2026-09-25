import assert from 'node:assert/strict';
import { test } from 'node:test';

import { verifyTelegramInitData } from './telegram-auth';

const valid =
    'auth_date=1700000000&query_id=AAE&user=%7B%22id%22%3A12345%2C%22first_name%22%3A%22Ada%22%7D&hash=db2e9bce73f0e051b12baee3df95c94f32b7296625f2ca0be512b2ffccecea5e';

test('подмена пользователя и повтор поля не проходят проверку', () => {
    assert.throws(
        () =>
            verifyTelegramInitData(
                valid.replace('12345', '99999'),
                '123456:TEST',
                1_700_000_300,
            ),
        /подпись/,
    );
    assert.throws(
        () =>
            verifyTelegramInitData(
                valid + '&user=another',
                '123456:TEST',
                1_700_000_300,
            ),
        /Повторяющиеся/,
    );
});

test('старая и будущая initData отклоняется', () => {
    assert.throws(
        () => verifyTelegramInitData(valid, '123456:TEST', 1_700_004_000),
        /устарели/,
    );
    assert.throws(
        () => verifyTelegramInitData(valid, '123456:TEST', 1_699_999_800),
        /устарели/,
    );
});
