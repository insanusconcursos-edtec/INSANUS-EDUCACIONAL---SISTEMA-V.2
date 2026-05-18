async function hit() {
  try {
    const res = await fetch('http://localhost:3000/api/admin/backfill-sales');
    const txt = await res.text();
    console.log(txt);
  } catch(e) {
    console.error(e);
  }
}
hit();
