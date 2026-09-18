import React, { Component, ErrorInfo, ReactNode } from 'react';

interface Props {
  children: ReactNode;
  // Quando este valor muda (ex: a aba voltou a ficar visível), o erro é descartado e a árvore
  // tenta renderizar de novo -- sem isso o boundary ficava "travado" no erro até recarregar a página.
  resetKey?: unknown;
}

interface State {
  hasError: boolean;
  message: string;
}

// Um dado ruim que dura uma fração de segundo (ex: registro que chega do realtime antes de ser
// completado) não deveria exigir recarregar o app. Depois de um erro, tenta 1 vez sozinho após um
// instante; se falhar de novo, mostra a tela de erro com "Tentar de novo".
const AUTO_RETRY_MS = 800;

class ErrorBoundary extends Component<Props, State> {
  public state: State = {
    hasError: false,
    message: ''
  };

  private autoRetried = false;
  private retryTimer: ReturnType<typeof setTimeout> | null = null;

  public static getDerivedStateFromError(error: Error): State {
    return { hasError: true, message: error?.message || String(error) };
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error("Uncaught error:", error, errorInfo);
    if (!this.autoRetried) {
      this.autoRetried = true;
      this.retryTimer = setTimeout(() => this.reset(false), AUTO_RETRY_MS);
    }
  }

  public componentDidUpdate(prevProps: Props) {
    if (this.state.hasError && prevProps.resetKey !== this.props.resetKey) {
      this.reset(true);
    }
  }

  public componentWillUnmount() {
    if (this.retryTimer) clearTimeout(this.retryTimer);
  }

  private reset = (manual: boolean) => {
    if (this.retryTimer) { clearTimeout(this.retryTimer); this.retryTimer = null; }
    // Reset manual/por troca de aba libera uma nova tentativa automática se o erro voltar.
    if (manual) this.autoRetried = false;
    this.setState({ hasError: false, message: '' });
  };

  public render() {
    if (this.state.hasError) {
      return (
        <div className="p-8 text-center">
          <h2 className="text-xl font-bold text-slate-800">Algo deu errado.</h2>
          <p className="text-slate-500">Esta tela teve um problema ao carregar.</p>
          {this.state.message && (
            <p className="mt-3 text-[10px] font-mono text-slate-400 break-words">Detalhe técnico: {this.state.message}</p>
          )}
          <div className="mt-4 flex items-center justify-center gap-3">
            <button
              onClick={() => this.reset(true)}
              className="px-4 py-2 bg-blue-600 text-white rounded-lg"
            >
              Tentar de novo
            </button>
            <button
              onClick={() => window.location.reload()}
              className="px-4 py-2 bg-slate-100 text-slate-600 rounded-lg"
            >
              Recarregar página
            </button>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}

export default ErrorBoundary;
