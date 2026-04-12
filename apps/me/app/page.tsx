export default function PassportLanding() {
  return (
    <main style={{
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      minHeight: '100vh',
      padding: '2rem',
      textAlign: 'center',
    }}>
      <div style={{
        maxWidth: '32rem',
        display: 'flex',
        flexDirection: 'column',
        gap: '1.5rem',
      }}>
        <h1 style={{
          fontSize: '2.5rem',
          fontWeight: 900,
          color: '#FF8200',
          margin: 0,
          letterSpacing: '-0.02em',
        }}>
          Afterroar
        </h1>

        <p style={{
          fontSize: '1.25rem',
          color: '#e2e8f0',
          lineHeight: 1.6,
          margin: 0,
        }}>
          Your gaming identity, your rules.
        </p>

        <p style={{
          fontSize: '1rem',
          color: '#9ca3af',
          lineHeight: 1.6,
          margin: 0,
        }}>
          One login across every store and app in the Afterroar ecosystem.
          See your data. Control your consent. Delete anytime.
        </p>

        <div style={{
          marginTop: '1rem',
          padding: '1.5rem',
          background: 'rgba(255, 130, 0, 0.05)',
          borderRadius: '12px',
          border: '1px solid rgba(255, 130, 0, 0.2)',
        }}>
          <p style={{
            fontSize: '0.95rem',
            color: '#FF8200',
            fontWeight: 700,
            margin: '0 0 0.5rem 0',
          }}>
            Coming soon
          </p>
          <p style={{
            fontSize: '0.875rem',
            color: '#9ca3af',
            margin: 0,
            lineHeight: 1.5,
          }}>
            Passport is being built. When it launches, this is where
            your gaming identity lives — your library, your points,
            your tournament history, your privacy settings.
          </p>
        </div>

        <div style={{
          marginTop: '2rem',
          fontSize: '0.75rem',
          color: '#6b7280',
        }}>
          Powered by Afterroar • Founded February 2025
        </div>
      </div>
    </main>
  );
}
