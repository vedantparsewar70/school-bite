import './helpers/isolate-env';
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';

/** Cleanup: Vercel is the only host, so the Docker/VPS files and the standalone output are gone. */

test('no Docker, Caddy or VPS deploy files, and no standalone output', () => {
  for (const f of ['Dockerfile', 'docker-compose.yml', 'docker-entrypoint.sh', 'deploy.sh', 'Caddyfile', '.dockerignore', 'HOSTING.md']) {
    assert.ok(!existsSync(f), f);
  }
  assert.ok(!readFileSync('next.config.ts', 'utf-8').includes('standalone'));
});
