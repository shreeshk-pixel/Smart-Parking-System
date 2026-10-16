// Admin scan page: first scan = entry, second scan = exit (gives an OTP), then OTP confirms exit.
const $ = id => document.getElementById(id);
let bookingId = null, lastCam = '', lastCamAt = 0;

async function verify(token) {
  token = (token || '').trim();
  if (!token) return;
  $('otpBox').hidden = true;
  msg($('result'), 'Checking...', true);
  try {
    const r = await api('/api/verify_qr', { qr_token: token });
    bookingId = r.booking_id;
    const who = `${r.user_name}, ${r.vehicle_number}, slot ${r.slot_number}`;
    if (r.action === 'entry') msg($('result'), `Entry allowed: ${who}`, true);
    else {
      let text = `Exit requested: ${who}`;
      if (r.overstay_minutes > 0) text += ` (overstayed by ${r.overstay_minutes} min)`;
      msg($('result'), text, r.overstay_minutes > 0 ? false : true);
      $('shownOtp').textContent = r.otp; $('otpBox').hidden = false;
    }
  } catch (e) { msg($('result'), e.message, false); }
}
// The Verify button always calls the server again
$('verify').onclick = () => verify($('token').value);
$('exitBtn').onclick = async () => {
  try { await api('/api/exit_otp', { booking_id: bookingId, otp: $('otp').value.trim() });
    msg($('result'), 'Exit complete. Booking closed.', true); $('otpBox').hidden = true; $('otp').value = ''; }
  catch (e) { msg($('result'), e.message, false); }
};
// Camera scanner: the camera reads the same code many times a second, so ignore repeats within 5 seconds
function onCamera(t) {
  if (t === lastCam && Date.now() - lastCamAt < 5000) return;
  lastCam = t; lastCamAt = Date.now();
  $('token').value = t; verify(t);
}
try { new Html5QrcodeScanner('reader', { fps: 10, qrbox: 220 }).render(onCamera); }
catch (e) { $('reader').textContent = 'Camera not available, paste the code instead.'; }
