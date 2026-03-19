import { TEST_TO, sendOne } from './_brackets_close_email.js';

export async function onRequest({ env }) {
  try {
    await sendOne(env, TEST_TO);
    return new Response(`Test email sent to ${TEST_TO}`, {
      status: 200,
      headers: { 'content-type': 'text/plain; charset=utf-8', 'cache-control': 'no-store' }
    });
  } catch (e) {
    return new Response(`Failed to send test email: ${String(e?.message || e || 'Unknown error')}`, {
      status: 500,
      headers: { 'content-type': 'text/plain; charset=utf-8', 'cache-control': 'no-store' }
    });
  }
}
