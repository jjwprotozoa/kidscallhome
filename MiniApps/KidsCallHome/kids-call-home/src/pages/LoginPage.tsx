/**
 * ============================================================================
 * KIDS CALL HOME - Login Page
 * ============================================================================
 * 
 * Purpose: Login page for existing family members to access their family
 * Interface: Shared - provides login for both guardians and children
 * Dependencies: React, react-router-dom, zustand
 * 
 * V1 Features:
 * - Family code and user name authentication
 * - Automatic user type detection (guardian vs child)
 * - Error handling for invalid credentials
 * - Redirect to appropriate dashboard
 * 
 * V2 Ready:
 * - Remember me functionality
 * - Password-based authentication
 * - Multi-device login management
 * 
 * Last Updated: 2024-09-09
 * ============================================================================
 */

import {
    ArrowLeftIcon,
    ExclamationTriangleIcon,
    HomeIcon,
    UserCircleIcon
} from '@heroicons/react/24/outline';
import { motion } from 'framer-motion';
import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import LoadingSpinner from '../components/shared/LoadingSpinner';
import { useAppStore } from '../stores/useAppStore';

/**
 * LoginPage - Login interface for existing family members
 * 
 * Allows both guardians and children to log back into their existing family
 * using their family code and name. Automatically detects user type and
 * redirects to the appropriate dashboard.
 */
const LoginPage: React.FC = () => {
  const navigate = useNavigate();
  const { setCurrentFamily, setCurrentUser, setUserType, setTheme } = useAppStore();
  
  const [familyCode, setFamilyCode] = useState('');
  const [userName, setUserName] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!familyCode.trim() || !userName.trim()) return;
    
    setIsLoading(true);
    setError(null);
    
    try {
      // TODO: Implement real family code validation and user lookup
      // For now, simulate family lookup based on code
      const mockFamily = {
        id: 'family-test-123',
        code: 'TEST123',
        name: 'The Test Family',
        guardians: [
          {
            id: 'guardian-1',
            name: 'Mom',
            email: '',
            avatar: '👩‍💼',
            isOnline: true,
            lastSeen: new Date(),
            deviceId: 'guardian-device-1',
            preferences: {
              theme: 'guardian' as const,
              notifications: {
                calls: true,
                messages: true,
                childOnline: true,
              },
              callQuality: 'auto' as const,
              showTechnicalDetails: true,
            },
          },
          {
            id: 'guardian-2',
            name: 'Dad',
            email: '',
            avatar: '👨‍💼',
            isOnline: false,
            lastSeen: new Date(),
            deviceId: 'guardian-device-2',
            preferences: {
              theme: 'guardian' as const,
              notifications: {
                calls: true,
                messages: true,
                childOnline: true,
              },
              callQuality: 'auto' as const,
              showTechnicalDetails: true,
            },
          }
        ],
        children: [
          {
            id: 'child-1',
            name: 'Emma',
            age: 8,
            avatar: '👧',
            deviceId: 'child-device-1',
            isOnline: true,
            lastSeen: new Date(),
            preferences: {
              theme: 'kids' as const,
              fontSize: 'large' as const,
              soundEffects: true,
              animations: true,
              emergencyButtonEnabled: true,
            },
            approvedGuardians: ['guardian-1', 'guardian-2'],
          },
          {
            id: 'child-2',
            name: 'Jake',
            age: 6,
            avatar: '👦',
            deviceId: 'child-device-2',
            isOnline: false,
            lastSeen: new Date(),
            preferences: {
              theme: 'kids' as const,
              fontSize: 'large' as const,
              soundEffects: true,
              animations: true,
              emergencyButtonEnabled: true,
            },
            approvedGuardians: ['guardian-1', 'guardian-2'],
          }
        ],
        created: new Date(),
        lastActive: new Date(),
        settings: {
          allowChildInitiatedCalls: true,
          emergencyContacts: [],
          callTimeout: 30,
          maxCallDuration: 60,
          requireGuardianApproval: false,
          timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
        },
      };
      
      // Check if family code matches
      if (familyCode.trim().toUpperCase() !== 'TEST123') {
        setError('Invalid family code. Please use TEST123 for testing.');
        return;
      }
      
      // Look for user in guardians first
      const guardian = mockFamily.guardians.find(
        g => g.name.toLowerCase() === userName.trim().toLowerCase()
      );
      
      if (guardian) {
        // User is a guardian
        setCurrentFamily(mockFamily);
        setCurrentUser(guardian);
        setUserType('guardian');
        setTheme('guardian');
        
        // Redirect to guardian dashboard
        navigate('/guardian');
        return;
      }
      
      // Look for user in children
      const child = mockFamily.children.find(
        c => c.name.toLowerCase() === userName.trim().toLowerCase()
      );
      
      if (child) {
        // User is a child
        setCurrentFamily(mockFamily);
        setCurrentUser(child);
        setUserType('child');
        setTheme('kids');
        
        // Redirect to kids dashboard
        navigate('/kids');
        return;
      }
      
      // User not found in family
      setError(`Sorry, "${userName}" is not a member of this family. Please check your name or ask your parents to add you to the family.`);
      
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Login failed. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-500 to-purple-600 p-4">
      <div className="container-responsive py-8">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8 }}
          className="max-w-md mx-auto"
        >
          {/* Header */}
          <div className="text-center mb-8">
            <Link
              to="/"
              className="inline-flex items-center text-white text-opacity-80 hover:text-opacity-100 mb-6 transition-colors"
            >
              <ArrowLeftIcon className="w-5 h-5 mr-2" />
              Back to Home
            </Link>
            
            <div className="w-16 h-16 bg-white bg-opacity-20 rounded-full flex items-center justify-center mx-auto mb-4">
              <HomeIcon className="w-8 h-8 text-white" />
            </div>
            
            <h1 className="heading-2 text-white mb-4 text-shadow-lg">
              Welcome Back!
            </h1>
            <p className="text-white text-opacity-90 text-shadow">
              Enter your family code and name to access your family.
            </p>
          </div>
          
          {/* Login Form */}
          <form onSubmit={handleLogin} className="space-y-6">
            <div className="card">
              <label htmlFor="familyCode" className="block text-lg font-semibold text-gray-900 mb-3">
                Family Code
              </label>
              <input
                type="text"
                id="familyCode"
                value={familyCode}
                onChange={(e) => setFamilyCode(e.target.value.toUpperCase())}
                placeholder="BEAR-CAKE-2024"
                className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-center font-mono tracking-wider"
                required
              />
              <p className="text-gray-600 text-sm mt-2">
                Enter the family code you received when you first joined.
              </p>
            </div>
            
            <div className="card">
              <label htmlFor="userName" className="block text-lg font-semibold text-gray-900 mb-3">
                Your Name
              </label>
              <input
                type="text"
                id="userName"
                value={userName}
                onChange={(e) => setUserName(e.target.value)}
                placeholder="Mom, Dad, Emma, Jake, etc."
                className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                required
              />
              <p className="text-gray-600 text-sm mt-2">
                Enter the name you used when you first joined the family.
              </p>
            </div>
            
            {error && (
              <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded-lg flex items-start">
                <ExclamationTriangleIcon className="w-5 h-5 mr-2 mt-0.5 flex-shrink-0" />
                <span>{error}</span>
              </div>
            )}
            
            <button
              type="submit"
              disabled={isLoading || !familyCode.trim() || !userName.trim()}
              className="w-full btn-primary text-lg py-4 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center"
            >
              {isLoading ? (
                <>
                  <LoadingSpinner size="small" className="mr-2" />
                  Logging in...
                </>
              ) : (
                <>
                  <UserCircleIcon className="w-5 h-5 mr-2" />
                  Login to Family
                </>
              )}
            </button>
          </form>
          
          {/* Help Text */}
          <div className="mt-8 text-center">
            <p className="text-white text-opacity-75 text-sm">
              Don't have a family yet?{' '}
              <Link to="/setup" className="text-white font-semibold hover:underline">
                Create or join a family
              </Link>
            </p>
          </div>
        </motion.div>
      </div>
    </div>
  );
};

export default LoginPage;
