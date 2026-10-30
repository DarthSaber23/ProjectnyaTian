import { Component, type ErrorInfo, type ReactNode } from "react";

interface Props {
  children: ReactNode;
}

interface State {
  hasError: boolean;
  error?: Error;
}

export class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error("ErrorBoundary caught an unhandled error:", error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="card mx-auto my-12 flex max-w-lg flex-col items-start gap-4 p-8 text-center sm:text-left">
          <h1 className="text-2xl font-semibold text-danger">Terjadi kesalahan tampilan</h1>
          <p className="text-sm text-muted">
            Mohon maaf, terjadi kendala saat memuat halaman ini. Silakan muat ulang halaman atau kembali ke beranda.
          </p>
          <div className="flex flex-wrap gap-3">
            <button
              type="button"
              className="btn-primary"
              onClick={() => {
                this.setState({ hasError: false });
                window.location.reload();
              }}
            >
              Muat ulang halaman
            </button>
            <a href="/" className="btn-secondary">
              Kembali ke beranda
            </a>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}
