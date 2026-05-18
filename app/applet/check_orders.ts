import { getAdminConfig, initializeFirebaseAdmin } from './src/backend/services/firebaseAdmin.js';
async function run() {
  initializeFirebaseAdmin();
  const { dbAdmin } = getAdminConfig();
  const snap = await dbAdmin.collection('orders').orderBy('createdAt', 'desc').limit(5).get();
  snap.forEach(d => console.log(d.id, Object.keys(d.data()), d.data().split));
}
run();
