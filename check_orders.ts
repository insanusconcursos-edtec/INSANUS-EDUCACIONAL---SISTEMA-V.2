import { getAdminConfig } from './src/backend/services/firebaseAdmin.ts';
async function run() {
  const { dbAdmin } = getAdminConfig();
  const snap = await dbAdmin.collection('orders').orderBy('createdAt', 'desc').limit(5).get();
  snap.forEach(d => console.log('ORDER ID', d.id, '\nKEYS', Object.keys(d.data()), '\nSPLIT', d.data().split || d.data().splits));
}
run();
