import { Component, type ReactNode } from 'react';

/** Beklenmeyen bir hata olursa boş ekran yerine kurtarma seçeneği gösterir. */
export class ErrorBoundary extends Component<{ children: ReactNode }, { failed: boolean }> {
  state = { failed: false };

  static getDerivedStateFromError() {
    return { failed: true };
  }

  componentDidCatch(error: unknown) {
    console.error(error);
  }

  render() {
    if (!this.state.failed) return this.props.children;
    return (
      <main className="screen crash">
        <h1 className="display">Bir şeyler ters gitti</h1>
        <p>Sayfayı yenilemeyi dene. Sorun sürerse kayıtlı verileri sıfırlayarak uygulamayı yeniden başlatabilirsin.</p>
        <button type="button" className="btn btn--primary btn--lg btn--block" onClick={() => window.location.reload()}>
          Sayfayı yenile
        </button>
        <button
          type="button"
          className="btn btn--soft btn--lg btn--block"
          onClick={() => {
            try {
              localStorage.removeItem('dolapta-ne-var');
            } catch {
              /* depolama yoksa yapılacak bir şey yok */
            }
            window.location.replace('#/dolap');
            window.location.reload();
          }}
        >
          Verileri sıfırla ve yeniden başlat
        </button>
      </main>
    );
  }
}
