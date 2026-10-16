// Map page: shows locations on a Leaflet map, then the slot grid and booking form.
const map = L.map('map').setView([15.8497, 74.4977], 13); // Belagavi
L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', { attribution: '&copy; OpenStreetMap' }).addTo(map);

let currentLoc = null, selectedSlot = null;
const $ = id => document.getElementById(id);

// Default times: now + 1 hour, rounded to the minute
function toLocalInput(d) { const p = n => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth()+1)}-${p(d.getDate())}T${p(d.getHours())}:${p(d.getMinutes())}`; }
const now = new Date(); $('start').value = toLocalInput(now);
$('end').value = toLocalInput(new Date(now.getTime() + 3600000));

// Legend in the bottom-right corner of the map
const legend = L.control({ position: 'bottomright' });
legend.onAdd = () => { const d = L.DomUtil.create('div', 'legend');
  d.innerHTML = '<b>Parking</b><br><i style="background:green"></i> Slots free<br><i style="background:red"></i> Full'; return d; };
legend.addTo(map);

async function loadLocations() {
  const locs = await api('/api/locations');
  const bounds = [];
  locs.forEach(l => {
    const color = l.free_slots > 0 ? 'green' : 'red';
    const m = L.circleMarker([l.latitude, l.longitude], { radius: 12, color, fillOpacity: 0.7 }).addTo(map);
    m.bindPopup(`<b>${esc(l.name)}</b><br>${l.free_slots}/${l.total_slots} free<br>Rs ${l.price_per_hour}/hr`);
    m.on('click', () => selectLocation(l));
    bounds.push([l.latitude, l.longitude]);
  });
  if (bounds.length) map.fitBounds(bounds, { padding: [40, 40] });
}

function selectLocation(l) {
  currentLoc = l;
  $('locName').textContent = l.name;
  $('locInfo').textContent = `${l.address} · Rs ${l.price_per_hour} per hour`;
  $('bookingBox').hidden = false;
  loadSlots();
}

async function loadSlots() {
  selectedSlot = null; if ($('bookBtn')) $('bookBtn').disabled = true;
  const q = `location_id=${currentLoc.id}&start=${encodeURIComponent($('start').value)}&end=${encodeURIComponent($('end').value)}`;
  try {
    const slots = await api('/api/slots?' + q);
    $('slots').innerHTML = '';
    slots.forEach(s => {
      const b = document.createElement('button');
      b.className = 'slot ' + (s.available ? 'free' : 'taken');
      b.textContent = s.slot_number + (s.vehicle_type === 'bike' ? ' 🏍' : ' 🚗');
      b.disabled = !s.available;
      b.onclick = () => {
        document.querySelectorAll('.slot.selected').forEach(x => x.classList.remove('selected'));
        b.classList.add('selected'); selectedSlot = s;
        if ($('bookBtn')) $('bookBtn').disabled = false;
      };
      $('slots').appendChild(b);
    });
  } catch (e) { msg($('bookMsg'), e.message, false); }
}

$('check').onclick = loadSlots;
if ($('bookBtn')) $('bookBtn').onclick = async () => {
  if (!selectedSlot) return;
  try {
    const r = await api('/api/book', { slot_id: selectedSlot.id, vehicle_number: $('vehicle').value.trim(),
      start_time: $('start').value, end_time: $('end').value });
    msg($('bookMsg'), `Booked! Booking #${r.booking_id}, amount Rs ${r.amount}. Pay for it on My Bookings.`, true);
    loadSlots();
  } catch (e) { msg($('bookMsg'), e.message, false); }
};
loadLocations().catch(e => alert(e.message));
