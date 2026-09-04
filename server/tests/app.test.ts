import { test, describe } from 'node:test';
import assert from 'node:assert';
import { createServer } from '../src/server';

describe('EchoWire Backend Integration Tests', () => {
  test('Health check endpoint returns status ok', async () => {
    const app = await createServer();
    const res = await app.inject({ method: 'GET', url: '/api/health' });
    assert.strictEqual(res.statusCode, 200);
    const body = JSON.parse(res.body);
    assert.strictEqual(body.status, 'ok');
    await app.close();
  });

  test('User registration and authentication cycle', async () => {
    const app = await createServer();
    const uname = 'test_' + Date.now();
    const res = await app.inject({
      method: 'POST',
      url: '/api/auth/register',
      payload: {
        username: uname,
        email: `${uname}@example.com`,
        password: 'Password123!',
      },
    });

    assert.strictEqual(res.statusCode, 200);
    const body = JSON.parse(res.body);
    assert.strictEqual(body.user.username, uname);

    const cookieHeader = res.headers['set-cookie'];
    assert.ok(cookieHeader, 'Expected set-cookie header on successful registration');

    const meRes = await app.inject({
      method: 'GET',
      url: '/api/auth/me',
      headers: { cookie: cookieHeader as string },
    });
    assert.strictEqual(meRes.statusCode, 200);
    const meBody = JSON.parse(meRes.body);
    assert.strictEqual(meBody.user.username, uname);

    await app.close();
  });

  test('Room creation, listing, and join', async () => {
    const app = await createServer();
    const uname = 'owner_' + Date.now();
    const regRes = await app.inject({
      method: 'POST',
      url: '/api/auth/register',
      payload: {
        username: uname,
        email: `${uname}@example.com`,
        password: 'Password123!',
      },
    });
    const cookie = regRes.headers['set-cookie'] as string;

    const createRoomRes = await app.inject({
      method: 'POST',
      url: '/api/rooms',
      headers: { cookie },
      payload: {
        name: 'Late Night Games',
        type: 'voice',
        maxParticipants: 10,
        bitrate: 64000,
        textChatEnabled: true,
      },
    });
    assert.strictEqual(createRoomRes.statusCode, 200);
    const roomBody = JSON.parse(createRoomRes.body);
    assert.strictEqual(roomBody.room.name, 'Late Night Games');

    const listRes = await app.inject({ method: 'GET', url: '/api/rooms' });
    assert.strictEqual(listRes.statusCode, 200);
    const listBody = JSON.parse(listRes.body);
    assert.ok(listBody.rooms.length > 0);

    await app.close();
  });
});
