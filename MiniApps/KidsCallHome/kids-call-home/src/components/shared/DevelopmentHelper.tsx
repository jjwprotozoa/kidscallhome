/**
 * ============================================================================
 * KIDS CALL HOME - Development Helper Component
 * ============================================================================
 * 
 * Purpose: Helps developers set up proper development environment for testing
 * Interface: Development-only component
 * Dependencies: React, tailwindcss
 * 
 * V1 Features:
 * - Development environment detection
 * - HTTPS setup instructions
 * - Browser configuration guidance
 * - Alternative development options
 * 
 * V2 Ready:
 * - Automatic development server setup
 * - Browser flag management
 * - Development environment validation
 * 
 * Last Updated: 2024-09-09
 * ============================================================================
 */

import { CheckCircleIcon, ExclamationTriangleIcon } from '@heroicons/react/24/outline';
import React, { useEffect, useState } from 'react';

const DevelopmentHelper: React.FC = () => {
  const [isSecureContext, setIsSecureContext] = useState(false);
  const [currentOrigin, setCurrentOrigin] = useState('');
  const [browserInfo, setBrowserInfo] = useState('');

  useEffect(() => {
    setIsSecureContext(window.isSecureContext);
    setCurrentOrigin(window.location.origin);
    setBrowserInfo(navigator.userAgent);
  }, []);

  const isChrome = browserInfo.toLowerCase().includes('chrome');
  const isFirefox = browserInfo.toLowerCase().includes('firefox');
  const isSafari = browserInfo.toLowerCase().includes('safari') && !browserInfo.toLowerCase().includes('chrome');
  const isEdge = browserInfo.toLowerCase().includes('edge');

  const getBrowserInstructions = () => {
    if (isChrome) {
      return {
        name: 'Chrome',
        steps: [
          'Open Chrome and go to chrome://flags/',
          'Search for "unsafely-treat-insecure-origin-as-secure"',
          'Add your development URL (e.g., http://100.102.8.51:3000)',
          'Set the flag to "Enabled"',
          'Restart Chrome and try again'
        ]
      };
    } else if (isFirefox) {
      return {
        name: 'Firefox',
        steps: [
          'Type about:config in the address bar',
          'Search for "media.navigator.permission.disabled"',
          'Set it to "true"',
          'Search for "media.navigator.streams.fake"',
          'Set it to "true" (for testing)',
          'Restart Firefox and try again'
        ]
      };
    } else if (isSafari) {
      return {
        name: 'Safari',
        steps: [
          'Go to Safari > Preferences > Advanced',
          'Check "Show Develop menu in menu bar"',
          'Go to Develop > Disable Cross-Origin Restrictions',
          'Or use Safari Technology Preview for development'
        ]
      };
    } else if (isEdge) {
      return {
        name: 'Edge',
        steps: [
          'Open Edge and go to edge://flags/',
          'Search for "unsafely-treat-insecure-origin-as-secure"',
          'Add your development URL (e.g., http://100.102.8.51:3000)',
          'Set the flag to "Enabled"',
          'Restart Edge and try again'
        ]
      };
    } else {
      return {
        name: 'Your Browser',
        steps: [
          'Look for security settings in your browser',
          'Enable insecure origins for development',
          'Or use localhost instead of IP address'
        ]
      };
    }
  };

  const browserInstructions = getBrowserInstructions();

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl shadow-2xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="p-6 border-b border-gray-200">
          <div className="flex items-center space-x-3 mb-2">
            <ExclamationTriangleIcon className="w-8 h-8 text-yellow-500" />
            <h2 className="text-xl font-bold text-gray-900">
              Development Environment Setup
            </h2>
          </div>
          <p className="text-gray-600">
            Camera and microphone access requires HTTPS or localhost for security reasons.
          </p>
        </div>

        {/* Current Status */}
        <div className="p-6">
          <div className="mb-6">
            <h3 className="text-lg font-semibold text-gray-900 mb-3">
              Current Status:
            </h3>
            <div className="space-y-2">
              <div className="flex items-center space-x-3">
                {isSecureContext ? (
                  <CheckCircleIcon className="w-5 h-5 text-green-500" />
                ) : (
                  <ExclamationTriangleIcon className="w-5 h-5 text-red-500" />
                )}
                <span className="text-gray-700">
                  Secure Context: {isSecureContext ? 'Yes' : 'No'}
                </span>
              </div>
              <div className="flex items-center space-x-3">
                <ExclamationTriangleIcon className="w-5 h-5 text-yellow-500" />
                <span className="text-gray-700">
                  Current URL: {currentOrigin}
                </span>
              </div>
            </div>
          </div>

          {/* Quick Solutions */}
          <div className="mb-6">
            <h3 className="text-lg font-semibold text-gray-900 mb-3">
              Quick Solutions:
            </h3>
            <div className="space-y-3">
              <div className="p-4 bg-blue-50 border border-blue-200 rounded-lg">
                <h4 className="font-semibold text-blue-900 mb-2">Option 1: Use localhost</h4>
                <p className="text-sm text-blue-700 mb-2">
                  Change your development server to use localhost instead of IP address:
                </p>
                <code className="text-xs bg-blue-100 px-2 py-1 rounded">
                  npm run dev -- --host localhost
                </code>
                <p className="text-xs text-blue-600 mt-1">
                  Then access via: http://localhost:3000
                </p>
              </div>

              <div className="p-4 bg-green-50 border border-green-200 rounded-lg">
                <h4 className="font-semibold text-green-900 mb-2">Option 2: Enable HTTPS</h4>
                <p className="text-sm text-green-700 mb-2">
                  Set up HTTPS for your development server:
                </p>
                <code className="text-xs bg-green-100 px-2 py-1 rounded">
                  npm run dev -- --https
                </code>
                <p className="text-xs text-green-600 mt-1">
                  Then access via: https://100.102.8.51:3000
                </p>
              </div>
            </div>
          </div>

          {/* Browser-specific instructions */}
          <div className="mb-6">
            <h3 className="text-lg font-semibold text-gray-900 mb-3">
              For {browserInstructions.name}:
            </h3>
            <ol className="space-y-2">
              {browserInstructions.steps.map((step, index) => (
                <li key={index} className="flex items-start space-x-3">
                  <span className="flex-shrink-0 w-6 h-6 bg-blue-100 text-blue-600 rounded-full flex items-center justify-center text-sm font-semibold">
                    {index + 1}
                  </span>
                  <span className="text-gray-700">{step}</span>
                </li>
              ))}
            </ol>
          </div>

          {/* Alternative Development Options */}
          <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
            <h4 className="text-sm font-semibold text-yellow-800 mb-2">
              Alternative Development Options:
            </h4>
            <ul className="text-sm text-yellow-700 space-y-1">
              <li>• Use ngrok to create HTTPS tunnel: <code>ngrok http 3000</code></li>
              <li>• Use mkcert to create local SSL certificates</li>
              <li>• Use Vite's built-in HTTPS support</li>
              <li>• Deploy to a staging environment with HTTPS</li>
            </ul>
          </div>
        </div>

        {/* Actions */}
        <div className="p-6 border-t border-gray-200 flex space-x-3">
          <button
            onClick={() => window.location.reload()}
            className="flex-1 bg-blue-500 text-white px-4 py-2 rounded-lg hover:bg-blue-600 transition-colors font-medium"
          >
            Try Again
          </button>
          <button
            onClick={() => window.close()}
            className="flex-1 bg-gray-200 text-gray-800 px-4 py-2 rounded-lg hover:bg-gray-300 transition-colors font-medium"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
};

export default DevelopmentHelper;
