export default function AuthLayout({ children }) {
  return (
    <div className="auth-wrap">
      <section className="auth-hero">
        <div className="row">
          <div className="brand-logo">LF</div>
          <strong style={{ color: '#fff' }}>Campus Lost &amp; Found</strong>
        </div>
        <div>
          <h1>Lost something on campus? Let the database find it.</h1>
          <ul>
            <li>Report lost and found items in seconds</li>
            <li>Hybrid matching: SQL rules + vector similarity</li>
            <li>Claims verified by the Lost &amp; Found desk</li>
            <li>Every hand-over tracked end to end</li>
          </ul>
        </div>
        <p className="small" style={{ opacity: 0.7 }}>DBMS Mini Project - MySQL 8 · LanceDB · Next.js</p>
      </section>
      <section className="auth-panel">
        <div className="card auth-card"><div className="card-body">{children}</div></div>
      </section>
    </div>
  );
}
