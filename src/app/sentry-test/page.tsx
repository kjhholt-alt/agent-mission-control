'use client';

import { useState } from 'react';
import * as Sentry from '@sentry/nextjs';

export default function SentryTestPage() {
  const [errorType, setErrorType] = useState<string>('');

  const throwError = () => {
    throw new Error('Test error from Sentry test page');
  };

  const captureException = () => {
    try {
      throw new Error('Manually captured exception');
    } catch (error) {
      Sentry.captureException(error, {
        tags: {
          test: 'manual-capture',
        },
      });
      alert('Exception captured and sent to Sentry!');
    }
  };

  const captureMessage = () => {
    Sentry.captureMessage('Test message from Nexus', 'info');
    alert('Message sent to Sentry!');
  };

  const triggerUnhandledError = () => {
    setErrorType('unhandled');
    // This will be caught by error.tsx
    setTimeout(() => {
      throw new Error('Unhandled async error');
    }, 100);
  };

  if (errorType === 'boundary') {
    throwError();
  }

  return (
    <div className="min-h-screen bg-[#0a0a0f] p-8">
      <div className="max-w-2xl mx-auto">
        <h1 className="text-3xl font-bold text-white mb-6">
          Sentry Integration Test
        </h1>

        <div className="bg-[#1a1a2e] border border-cyan-500/20 rounded-lg p-6 space-y-4">
          <p className="text-zinc-400 mb-4">
            Click any button below to test different Sentry error handling scenarios:
          </p>

          <div className="space-y-3">
            <button
              onClick={() => setErrorType('boundary')}
              className="w-full px-4 py-3 bg-red-600 hover:bg-red-500 text-white rounded-lg transition-colors font-medium"
            >
              Test Error Boundary (throws error)
            </button>

            <button
              onClick={captureException}
              className="w-full px-4 py-3 bg-orange-600 hover:bg-orange-500 text-white rounded-lg transition-colors font-medium"
            >
              Test Manual Exception Capture
            </button>

            <button
              onClick={captureMessage}
              className="w-full px-4 py-3 bg-blue-600 hover:bg-blue-500 text-white rounded-lg transition-colors font-medium"
            >
              Test Message Capture
            </button>

            <button
              onClick={triggerUnhandledError}
              className="w-full px-4 py-3 bg-purple-600 hover:bg-purple-500 text-white rounded-lg transition-colors font-medium"
            >
              Test Unhandled Async Error
            </button>
          </div>

          <div className="mt-6 p-4 bg-black/40 border border-cyan-500/20 rounded">
            <h3 className="text-sm font-semibold text-cyan-400 mb-2">
              Setup Instructions:
            </h3>
            <ol className="text-xs text-zinc-400 space-y-1 list-decimal list-inside">
              <li>Create a Sentry account at sentry.io</li>
              <li>Create a new Next.js project in Sentry</li>
              <li>Copy your DSN from project settings</li>
              <li>Add it to .env.local as NEXT_PUBLIC_SENTRY_DSN</li>
              <li>Restart the dev server</li>
              <li>Click the buttons above to send test errors</li>
              <li>Check your Sentry dashboard for captured errors</li>
            </ol>
          </div>

          <a
            href="/"
            className="block text-center px-4 py-2 bg-zinc-700 hover:bg-zinc-600 text-white rounded-lg transition-colors mt-4"
          >
            Back to Dashboard
          </a>
        </div>
      </div>
    </div>
  );
}
