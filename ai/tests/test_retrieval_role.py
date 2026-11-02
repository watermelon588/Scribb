import asyncio

import pytest

from scribb_ai import retrieval


class FakeConnection:
    def __init__(self, bypasses):
        self.bypasses, self.closed = bypasses, False

    async def execute(self, sql):
        assert sql == retrieval.BYPASSES_RLS
        bypasses = self.bypasses

        class Cursor:
            async def fetchone(self):
                return (bypasses,)
        return Cursor()

    async def close(self):
        self.closed = True


@pytest.mark.parametrize("bypasses", [True, False])
def test_roles_that_skip_row_level_security_are_refused(monkeypatch, bypasses):
    conn = FakeConnection(bypasses)

    async def fake_connect(*_, **__):
        return conn
    monkeypatch.setenv("AI_DATABASE_URL", "postgresql://example")
    monkeypatch.setattr(retrieval.psycopg.AsyncConnection, "connect", fake_connect)
    if bypasses:
        with pytest.raises(retrieval.UnsafeRole):
            asyncio.run(retrieval.connect())
        assert conn.closed
    else:
        assert asyncio.run(retrieval.connect()) is conn
