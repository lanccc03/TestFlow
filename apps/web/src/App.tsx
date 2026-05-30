function App() {
  return (
    <main className="app-shell">
      <section className="status-panel">
        <p className="eyebrow">TestFlow</p>
        <h1>Automation testing workspace</h1>
        <p className="lede">
          Electron, React, and the local FastAPI backend are ready for phased
          implementation.
        </p>
      </section>

      <section className="service-grid" aria-label="Phase 0 services">
        <article>
          <span>Frontend</span>
          <strong>Vite dev server</strong>
          <code>http://127.0.0.1:5173</code>
        </article>
        <article>
          <span>Backend</span>
          <strong>FastAPI health check</strong>
          <code>http://127.0.0.1:8000/health</code>
        </article>
        <article>
          <span>Desktop</span>
          <strong>Electron shell</strong>
          <code>pnpm dev:desktop</code>
        </article>
      </section>
    </main>
  )
}

export default App
