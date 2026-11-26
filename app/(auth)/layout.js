// Full-screen split layout for login and register: car artwork on the left, the form on the right.
import Link from 'next/link';

export default function AuthLayout({ children }) {
  return (
    <main className="auth-shell">
      <section className="auth-hero">
        <Link className="brand" href="/login"><span className="brand-mark">P</span><span>Smart<b>Park</b></span></Link>
        <h1>Made easy <b>parking</b> in Belagavi</h1>
        <p>Find a free slot on any floor, book it in seconds and drive in with a QR pass.</p>
        <div className="auth-art" aria-hidden="true"><img src="/assets/img/car-top.png" alt="" /></div>
      </section>
      <section className="auth-panel">{children}</section>
    </main>
  );
}
