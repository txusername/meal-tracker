import webPush from 'web-push';
import { sql } from './db';

function initVapid() {
  const subject = process.env.VAPID_SUBJECT;
  const publicKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
  const privateKey = process.env.VAPID_PRIVATE_KEY;
  if (!subject || !publicKey || !privateKey) throw new Error('VAPID env vars not set');
  webPush.setVapidDetails(subject, publicKey, privateKey);
}

export async function sendPushToAll(title: string, body: string) {
  initVapid();
  const subs = await sql`SELECT subscription FROM push_subscriptions`;
  const payload = JSON.stringify({ title, body });

  const results = await Promise.allSettled(
    subs.map((row: any) =>
      webPush.sendNotification(row.subscription as webPush.PushSubscription, payload)
    )
  );

  return {
    sent: results.filter(r => r.status === 'fulfilled').length,
    failed: results.filter(r => r.status === 'rejected').length,
  };
}
