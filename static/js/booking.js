// My Bookings: list bookings, pay, cancel, and show the QR pass for paid ones.
async function loadBookings() {
  const list = document.getElementById('list');
  const rows = await api('/api/my_bookings');
  if (!rows.length) { list.innerHTML = '<p class="muted">No bookings yet. <a href="' + (window.BASE || '') + '/">Book a slot</a>.</p>'; return; }
  list.innerHTML = '';
  rows.forEach(b => {
    const card = document.createElement('div'); card.className = 'card';
    card.innerHTML = `
      <h3>${esc(b.location_name)} · Slot ${esc(b.slot_number)}</h3>
      <p><b>Vehicle:</b> ${esc(b.vehicle_number)}<br><b>From:</b> ${esc(b.start_time)}<br><b>To:</b> ${esc(b.end_time)}</p>
      <p>Rs ${b.amount} · <span class="tag ${b.status}">${b.status}</span>
         <span class="tag ${b.payment_status}">${b.payment_status}</span></p>
      <div class="qr"></div><div class="actions"></div>`;
    const actions = card.querySelector('.actions');
    if (b.status === 'booked' && b.payment_status === 'pending') {
      actions.appendChild(button('Pay now', () => act('/api/pay', b.id, 'Payment done.')));
    }
    if (b.status === 'booked') {
      actions.appendChild(button('Cancel', () => confirm('Cancel this booking?') && act('/api/cancel', b.id, 'Booking cancelled.'), 'danger'));
    }
    if (b.qr_token && (b.status === 'booked' || b.status === 'entered')) {
      new QRCode(card.querySelector('.qr'), { text: b.qr_token, width: 140, height: 140 });
      card.querySelector('.qr').insertAdjacentHTML('beforeend', '<p class="muted">Show this pass at entry and exit.</p>');
    }
    list.appendChild(card);
  });
}
function button(text, fn, cls = '') { const b = document.createElement('button'); b.className = 'btn ' + cls; b.textContent = text; b.onclick = fn; return b; }
async function act(url, id, okText) {
  try { await api(url, { booking_id: id }); msg(document.getElementById('msg'), okText, true); loadBookings(); }
  catch (e) { msg(document.getElementById('msg'), e.message, false); }
}
loadBookings().catch(e => msg(document.getElementById('msg'), e.message, false));
