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
import FamilyDataService from '../services/familyDataService';
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
      // Use real family data service to join family
      const result = FamilyDataService.joinFamily({
        familyCode: familyCode.trim(),
        userName: userName.trim(),
      });
      
      if (!result) {
        setError('Invalid family code or user not found. Please check your information and try again.');
        return;
      }
      
      const { family, user, userType } = result;
      
      // Set current family and user in store
      setCurrentFamily(family);
      setCurrentUser(user);
      setUserType(userType);
      
      // Update user's online status
      const { updateFamilyMemberStatus } = useAppStore.getState();
      updateFamilyMemberStatus(user.id, true, new Date());
      
      // Set appropriate theme and redirect
      if (userType === 'guardian') {
        setTheme('guardian');
        navigate('/guardian');
      } else {
        setTheme('kids');
        navigate('/kids');
      }
      
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
