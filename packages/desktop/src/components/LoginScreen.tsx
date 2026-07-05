import "./LoginScreen.css";

interface LoginScreenProps {
  showRetry: boolean;
  error: string | null;
  authing: boolean;
  onRetry: () => void;
  onLogin: () => void;
}

export default function LoginScreen(props: LoginScreenProps) {
  return (
    <div className="app">
      <header className="header">
        <h1>Zeet Player</h1>
      </header>
      <main className="login-center">
        <div className="login-card">
          <h2>Yandex Music</h2>
          {props.showRetry ? (
            <>
              <p className="login-sub login-sub--error">
                {props.error ?? "Services unavailable"}
              </p>
              <button className="login-btn" onClick={props.onRetry}>Retry</button>
            </>
          ) : (
            <>
              <p className="login-sub">Sign in with your Yandex account</p>
              <button className="login-btn" onClick={props.onLogin} disabled={props.authing}>
                {props.authing ? "Opening browser..." : "Sign in with Yandex"}
              </button>
              {props.error && <p className="login-error">{props.error}</p>}
            </>
          )}
        </div>
      </main>
    </div>
  );
}
