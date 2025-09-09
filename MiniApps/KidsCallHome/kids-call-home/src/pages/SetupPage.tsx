/**
 * ============================================================================
 * KIDS CALL HOME - Family Setup Page
 * ============================================================================
 * 
 * Purpose: Family setup flow for both guardians and children
 * Interface: Shared - provides setup for both user types
 * Dependencies: React, react-router-dom, zustand, nanoid
 * 
 * V1 Features:
 * - Guardian family creation with memorable codes
 * - Child family joining with code verification
 * - Device fingerprinting and registration
 * - PWA installation prompts
 * - Success state with next steps
 * 
 * V2 Ready:
 * - Multi-step wizard interface
 * - Advanced family settings
 * - Device management features
 * 
 * Last Updated: 2024-09-09
 * ============================================================================
 */

import {
    CheckCircleIcon,
    HomeIcon,
    UserPlusIcon
} from '@heroicons/react/24/outline';
import { motion } from 'framer-motion';
import React, { useEffect, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import LoadingSpinner from '../components/shared/LoadingSpinner';
import PWAInstallPrompt from '../components/shared/PWAInstallPrompt';
import FamilyDataService from '../services/familyDataService';
import { useAppStore } from '../stores/useAppStore';

type SetupMode = 'guardian' | 'child' | 'select';

/**
 * SetupPage - Family setup and joining flow
 * 
 * Provides different interfaces for guardians creating families and children
 * joining existing families, with appropriate language and design for each.
 */
const SetupPage: React.FC = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { setCurrentFamily, setCurrentUser, setUserType, setTheme } = useAppStore();
  
  const [mode, setMode] = useState<SetupMode>('select');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  
  // Guardian setup state
  const [familyName, setFamilyName] = useState('');
  const [guardianName, setGuardianName] = useState('');
  const [childrenNames, setChildrenNames] = useState<string[]>(['']);
  
  // Child setup state
  const [familyCode, setFamilyCode] = useState('');
  const [childName, setChildName] = useState('');
  
  // Get family code from location state if coming from landing page
  useEffect(() => {
    if (location.state?.familyCode) {
      setFamilyCode(location.state.familyCode);
      setMode('child');
    }
  }, [location.state]);
  
  
  // Handle guardian family creation
  const handleGuardianSetup = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!familyName.trim() || !guardianName.trim()) return;
    
    setIsLoading(true);
    setError(null);
    
    try {
      // Use real family data service to create family
      const family = FamilyDataService.createFamily({
        familyName: familyName.trim(),
        guardianName: guardianName.trim(),
        guardianEmail: '', // Optional email
      });
      
      // Add children to the family
      for (const childName of childrenNames.filter(name => name.trim())) {
        FamilyDataService.addChildToFamily(family.id, {
          childName: childName.trim(),
        });
      }
      
      // Reload the family to get updated data with children
      const updatedFamily = FamilyDataService.findFamilyById(family.id);
      if (!updatedFamily) {
        throw new Error('Failed to create family');
      }
      
      // Set current user and family
      setCurrentFamily(updatedFamily);
      setCurrentUser(updatedFamily.guardians[0]);
      setUserType('guardian');
      setTheme('guardian');
      
      // Update user's online status
      const { updateFamilyMemberStatus } = useAppStore.getState();
      updateFamilyMemberStatus(updatedFamily.guardians[0].id, true, new Date());
      
      setSuccess(true);
      
      // Redirect to guardian dashboard after delay
      setTimeout(() => {
        navigate('/guardian');
      }, 3000);
      
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create family');
    } finally {
      setIsLoading(false);
    }
  };
  
  // Handle child family joining
  const handleChildSetup = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!familyCode.trim() || !childName.trim()) return;
    
    setIsLoading(true);
    setError(null);
    
    try {
      // Use real family data service to join family
      const result = FamilyDataService.joinFamily({
        familyCode: familyCode.trim(),
        userName: childName.trim(),
      });
      
      if (!result) {
        setError('Invalid family code or child not found. Please check your information and try again.');
        return;
      }
      
      const { family, user, userType } = result;
      
      // Ensure this is a child user
      if (userType !== 'child') {
        setError('This name is registered as a guardian. Children should use their own name.');
        return;
      }
      
      // Set current user and family
      setCurrentFamily(family);
      setCurrentUser(user);
      setUserType('child');
      setTheme('kids');
      
      // Update user's online status
      const { updateFamilyMemberStatus } = useAppStore.getState();
      updateFamilyMemberStatus(user.id, true, new Date());
      
      setSuccess(true);
      
      // Redirect to kids dashboard after delay
      setTimeout(() => {
        navigate('/kids');
      }, 3000);
      
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to join family');
    } finally {
      setIsLoading(false);
    }
  };
  
  // Add child name input
  const addChildName = () => {
    setChildrenNames([...childrenNames, '']);
  };
  
  // Remove child name input
  const removeChildName = (index: number) => {
    setChildrenNames(childrenNames.filter((_, i) => i !== index));
  };
  
  // Update child name
  const updateChildName = (index: number, value: string) => {
    const updated = [...childrenNames];
    updated[index] = value;
    setChildrenNames(updated);
  };
  
  if (success) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-green-500 to-blue-600 p-4">
        <div className="text-center max-w-md">
          <CheckCircleIcon className="w-24 h-24 text-white mx-auto mb-6" />
          <h1 className="text-4xl font-bold text-white mb-4 text-shadow-lg">
            Success!
          </h1>
          <p className="text-xl text-white mb-8 text-shadow">
            {mode === 'guardian' 
              ? 'Your family is ready to connect!'
              : 'Welcome to your family!'
            }
          </p>
          <LoadingSpinner size="large" text="Redirecting..." />
        </div>
      </div>
    );
  }
  
  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-500 to-purple-600 p-4">
      <PWAInstallPrompt />
      
      <div className="container-responsive py-8">
        {mode === 'select' && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8 }}
            className="text-center max-w-2xl mx-auto"
          >
            <h1 className="heading-1 text-white mb-8 text-shadow-lg">
              Set Up Your Family
            </h1>
            
            <div className="grid md:grid-cols-2 gap-8">
              <button
                onClick={() => setMode('guardian')}
                className="card hover:scale-105 transition-transform duration-200"
              >
                <UserPlusIcon className="w-16 h-16 text-blue-500 mx-auto mb-4" />
                <h2 className="text-2xl font-bold text-gray-900 mb-3">
                  Create a Family
                </h2>
                <p className="text-gray-600">
                  Set up a new family group and invite your children to join.
                </p>
              </button>
              
              <button
                onClick={() => setMode('child')}
                className="card hover:scale-105 transition-transform duration-200"
              >
                <HomeIcon className="w-16 h-16 text-purple-500 mx-auto mb-4" />
                <h2 className="text-2xl font-bold text-gray-900 mb-3">
                  Join a Family
                </h2>
                <p className="text-gray-600">
                  Enter your family code to connect with your parents.
                </p>
              </button>
            </div>
          </motion.div>
        )}
        
        {mode === 'guardian' && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8 }}
            className="max-w-2xl mx-auto"
          >
            <div className="text-center mb-8">
              <h1 className="heading-2 text-white mb-4 text-shadow-lg">
                Create Your Family
              </h1>
              <p className="text-white text-opacity-90 text-shadow">
                Set up your family group and get a special code to share with your children.
              </p>
            </div>
            
            <form onSubmit={handleGuardianSetup} className="space-y-6">
              <div className="card">
                <label htmlFor="familyName" className="block text-lg font-semibold text-gray-900 mb-3">
                  Family Name
                </label>
                <input
                  type="text"
                  id="familyName"
                  value={familyName}
                  onChange={(e) => setFamilyName(e.target.value)}
                  placeholder="The Johnson Family"
                  className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  required
                />
              </div>
              
              <div className="card">
                <label htmlFor="guardianName" className="block text-lg font-semibold text-gray-900 mb-3">
                  Your Name
                </label>
                <input
                  type="text"
                  id="guardianName"
                  value={guardianName}
                  onChange={(e) => setGuardianName(e.target.value)}
                  placeholder="Mom, Dad, Grandma, etc."
                  className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  required
                />
              </div>
              
              <div className="card">
                <label className="block text-lg font-semibold text-gray-900 mb-3">
                  Children's Names
                </label>
                <p className="text-gray-600 text-sm mb-4">
                  Add the names of children who will use this app.
                </p>
                {childrenNames.map((name, index) => (
                  <div key={index} className="flex space-x-2 mb-3">
                    <input
                      type="text"
                      value={name}
                      onChange={(e) => updateChildName(index, e.target.value)}
                      placeholder="Child's name"
                      className="flex-1 px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    />
                    {childrenNames.length > 1 && (
                      <button
                        type="button"
                        onClick={() => removeChildName(index)}
                        className="px-4 py-3 bg-red-500 text-white rounded-lg hover:bg-red-600"
                      >
                        Remove
                      </button>
                    )}
                  </div>
                ))}
                <button
                  type="button"
                  onClick={addChildName}
                  className="w-full px-4 py-3 border-2 border-dashed border-gray-300 rounded-lg text-gray-600 hover:border-blue-500 hover:text-blue-500"
                >
                  + Add Another Child
                </button>
              </div>
              
              {error && (
                <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded-lg">
                  {error}
                </div>
              )}
              
              <button
                type="submit"
                disabled={isLoading || !familyName.trim() || !guardianName.trim()}
                className="w-full btn-primary text-lg py-4 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {isLoading ? 'Creating Family...' : 'Create Family'}
              </button>
            </form>
          </motion.div>
        )}
        
        {mode === 'child' && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8 }}
            className="max-w-2xl mx-auto"
          >
            <div className="text-center mb-8">
              <h1 className="heading-2 text-white mb-4 text-shadow-lg">
                Join Your Family
              </h1>
              <p className="text-white text-opacity-90 text-shadow">
                Enter your family code and your name to connect with your parents.
              </p>
            </div>
            
            <form onSubmit={handleChildSetup} className="space-y-6">
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
                  className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent text-center font-mono tracking-wider"
                  required
                />
                <p className="text-gray-600 text-sm mt-2">
                  Ask your parents for the family code.
                </p>
              </div>
              
              <div className="card">
                <label htmlFor="childName" className="block text-lg font-semibold text-gray-900 mb-3">
                  Your Name
                </label>
                <input
                  type="text"
                  id="childName"
                  value={childName}
                  onChange={(e) => setChildName(e.target.value)}
                  placeholder="Your name"
                  className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                  required
                />
                <p className="text-sm text-gray-600 mt-2">
                  You must be added to the family by a parent first. Ask your parents to add you to the family before joining.
                </p>
              </div>
              
              {error && (
                <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded-lg">
                  {error}
                </div>
              )}
              
              <button
                type="submit"
                disabled={isLoading || !familyCode.trim() || !childName.trim()}
                className="w-full btn-primary text-lg py-4 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {isLoading ? 'Joining Family...' : 'Join Family'}
              </button>
            </form>
          </motion.div>
        )}
      </div>
    </div>
  );
};

export default SetupPage;
