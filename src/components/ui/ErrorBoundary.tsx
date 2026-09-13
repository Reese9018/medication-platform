import { Component, type ReactNode } from 'react';
import { AlertTriangle, RefreshCw } from 'lucide-react';

interface Props {
  children: ReactNode;
}

interface State {
  hasError: boolean;
  message: string;
}

/**
 * 全局错误边界：任何页面渲染/生命周期中抛出未捕获错误时，
 * 不再让整个应用白屏，而是展示可恢复的友好提示页。
 */
export class ErrorBoundary extends Component<Props, State> {
  state: State = { hasError: false, message: '' };

  static getDerivedStateFromError(error: unknown): State {
    return { hasError: true, message: error instanceof Error ? error.message : String(error) };
  }

  componentDidCatch(error: unknown, info: unknown) {
    console.error('[ErrorBoundary] 页面渲染异常：', error, info);
  }

  handleRetry = () => {
    this.setState({ hasError: false, message: '' });
  };

  render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen bg-cream-50 flex items-center justify-center p-6">
          <div className="w-full max-w-md bg-white rounded-3xl shadow-pop border border-sage-100 p-8 text-center">
            <div className="mx-auto w-16 h-16 rounded-2xl bg-coral-50 flex items-center justify-center text-coral-600 mb-4">
              <AlertTriangle size={28} />
            </div>
            <h2 className="text-lg font-bold text-sage-800">页面出现了一点问题</h2>
            <p className="text-sm text-sage-500 mt-2">加载过程中发生异常，请重试或刷新页面。</p>
            {this.state.message && (
              <p className="mt-3 px-3 py-2 rounded-xl bg-cream-50 border border-sage-100 text-xs text-sage-400 break-all">{this.state.message}</p>
            )}
            <div className="mt-6 flex justify-center gap-2">
              <button
                onClick={this.handleRetry}
                className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-sage-600 text-white text-sm font-medium hover:bg-sage-700 transition"
              >
                <RefreshCw size={14} /> 返回重试
              </button>
              <button
                onClick={() => window.location.reload()}
                className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl border border-sage-200 text-sage-700 text-sm font-medium hover:bg-sage-50 transition"
              >
                刷新页面
              </button>
            </div>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}
