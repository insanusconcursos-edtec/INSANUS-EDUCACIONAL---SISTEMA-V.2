import fetch from 'node-fetch';

async function hit() {
  const res = await fetch('http://localhost:3000/api/admin/backfill-sales');
  const txt = await res.text();
  console.log(txt);
}
hit();
