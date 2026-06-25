import { Component } from 'react'
import { RefreshCw } from 'lucide-react'

export default class ErrorBoundary extends Component {
  constructor(props) {
    super(props)
    this.state = { hasError: false, error: null }
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error }
  }

  componentDidCatch(error, info) {
    console.error('[ErrorBoundary]', error, info)
  }

  render() {
    if (!this.state.hasError) return this.props.children

    return (
      <div className="flex flex-col items-center justify-center min-h-[40vh] gap-4 px-6 text-center">
        <div className="text-4xl">⚠️</div>
        <div>
          <p className="font-semibold text-slate-800 text-lg">Terjadi kesalahan pada halaman ini</p>
          <p className="text-sm text-slate-500 mt-1">{this.state.error?.message ?? 'Unknown error'}</p>
        </div>
        <button
          onClick={() => { this.setState({ hasError: false, error: null }); window.location.reload() }}
          className="btn-primary flex items-center gap-2"
        >
          <RefreshCw size={15} /> Refresh Halaman
        </button>
      </div>
    )
  }
}
