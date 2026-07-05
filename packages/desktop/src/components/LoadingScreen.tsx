interface LoadingScreenProps {
  userDisplayName?: string;
}

export default function LoadingScreen(props: LoadingScreenProps) {
  return (
    <div className="app">
      <header className="header">
        <h1>Zeet Player</h1>
        {props.userDisplayName && <span className="badge">{props.userDisplayName}</span>}
      </header>
      <main className="login-center">
        <p className="ping-text">Loading your radio...</p>
      </main>
    </div>
  );
}
