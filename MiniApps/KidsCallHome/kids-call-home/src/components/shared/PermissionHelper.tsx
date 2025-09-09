/**
 * ============================================================================
 * KIDS CALL HOME - Permission Helper Component
 * ============================================================================
 * 
 * Purpose: Shows helpful instructions for enabling camera and microphone permissions
 * Interface: Shared across all components
 * Dependencies: React, tailwindcss
 * 
 * V1 Features:
 * - Step-by-step instructions for enabling permissions
 * - Browser-specific guidance
 * - Visual indicators for permission status
 * 
 * V2 Ready:
 * - Interactive permission testing
 * - Browser detection and specific instructions
 * - Permission status monitoring
 * 
 * Last Updated: 2024-09-09
 * ============================================================================
 */

import { CameraIcon, MicrophoneIcon, ShieldCheckIcon } from '@heroicons/react/24/outline';
import React from 'react';

interface PermissionHelperProps {
  onClose: () => void;
  onRetry: () => void;
}

const PermissionHelper: React.FC<PermissionHelperProps> = ({ onClose, onRetry }) => {
  const getBrowserInstructions = () => {
    const userAgent = navigator.userAgent.toLowerCase();
    
    if (userAgent.includes('chrome')) {
      return {
        name: 'Chrome',
        steps: [
          'Click the lock icon (🔒) in the address bar',
          'Set Camera and Microphone to "Allow"',
          'Refresh the page',
          'If still blocked, go to Settings > Privacy and security > Site settings'
        ]
      };
    } else if (userAgent.includes('firefox')) {
      return {
        name: 'Firefox',
        steps: [
          'Click the shield icon in the address bar',
          'Click "Permissions"',
          'Set Camera and Microphone to "Allow"',
          'Refresh the page'
        ]
      };
    } else if (userAgent.includes('safari')) {
      return {
        name: 'Safari',
        steps: [
          'Go to Safari menu > Settings > Websites',
          'Select "Camera" and "Microphone"',
          'Set this website to "Allow"',
          'Refresh the page'
        ]
      };
    } else if (userAgent.includes('edge')) {
      return {
        name: 'Edge',
        steps: [
          'Click the lock icon in the address bar',
          'Set Camera and Microphone to "Allow"',
          'Refresh the page',
          'If still blocked, go to Settings > Site permissions'
        ]
      };
    } else {
      return {
        name: 'Your Browser',
        steps: [
          'Look for a lock or shield icon in the address bar',
          'Click it and find Camera and Microphone settings',
          'Set them to "Allow" for this site',
          'Refresh the page'
        ]
      };
    }
  };

  const browserInfo = getBrowserInstructions();

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl shadow-2xl max-w-md w-full max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="p-6 border-b border-gray-200">
          <div className="flex items-center space-x-3 mb-2">
            <ShieldCheckIcon className="w-8 h-8 text-blue-500" />
            <h2 className="text-xl font-bold text-gray-900">
              Enable Camera & Microphone
            </h2>
          </div>
          <p className="text-gray-600">
            To make video calls, we need access to your camera and microphone.
          </p>
        </div>

        {/* Instructions */}
        <div className="p-6">
          <div className="mb-6">
            <h3 className="text-lg font-semibold text-gray-900 mb-3">
              For {browserInfo.name}:
            </h3>
            <ol className="space-y-2">
              {browserInfo.steps.map((step, index) => (
                <li key={index} className="flex items-start space-x-3">
                  <span className="flex-shrink-0 w-6 h-6 bg-blue-100 text-blue-600 rounded-full flex items-center justify-center text-sm font-semibold">
                    {index + 1}
                  </span>
                  <span className="text-gray-700">{step}</span>
                </li>
              ))}
            </ol>
          </div>

          {/* Visual Indicators */}
          <div className="grid grid-cols-2 gap-4 mb-6">
            <div className="flex items-center space-x-3 p-3 bg-red-50 rounded-lg">
              <CameraIcon className="w-6 h-6 text-red-500" />
              <div>
                <p className="text-sm font-medium text-red-900">Camera</p>
                <p className="text-xs text-red-600">Currently blocked</p>
              </div>
            </div>
            <div className="flex items-center space-x-3 p-3 bg-red-50 rounded-lg">
              <MicrophoneIcon className="w-6 h-6 text-red-500" />
              <div>
                <p className="text-sm font-medium text-red-900">Microphone</p>
                <p className="text-xs text-red-600">Currently blocked</p>
              </div>
            </div>
          </div>

          {/* Alternative Instructions */}
          <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4 mb-6">
            <h4 className="text-sm font-semibold text-yellow-800 mb-2">
              Alternative Method:
            </h4>
            <p className="text-sm text-yellow-700">
              Go to your browser's Privacy & Security settings and enable camera/microphone access for this website.
            </p>
          </div>
        </div>

        {/* Actions */}
        <div className="p-6 border-t border-gray-200 flex space-x-3">
          <button
            onClick={onRetry}
            className="flex-1 bg-blue-500 text-white px-4 py-2 rounded-lg hover:bg-blue-600 transition-colors font-medium"
          >
            Try Again
          </button>
          <button
            onClick={onClose}
            className="flex-1 bg-gray-200 text-gray-800 px-4 py-2 rounded-lg hover:bg-gray-300 transition-colors font-medium"
          >
            Cancel
          </button>
        </div>
      </div>
    </div>
  );
};

export default PermissionHelper;
