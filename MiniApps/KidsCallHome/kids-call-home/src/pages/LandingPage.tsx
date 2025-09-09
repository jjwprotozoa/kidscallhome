/**
 * ============================================================================
 * KIDS CALL HOME - Landing Page
 * ============================================================================
 * 
 * Purpose: Professional landing page explaining the problem and solution
 * Interface: Guardian-focused with kids interface preview
 * Dependencies: React, react-router-dom, tailwindcss, framer-motion
 * 
 * V1 Features:
 * - Problem/solution explanation with hero section
 * - Family code signup form
 * - Interface previews for both guardian and kids
 * - Mobile-responsive design
 * - Call-to-action for family setup
 * 
 * V2 Ready:
 * - Video demonstrations
 * - Customer testimonials
 * - Advanced analytics
 * - Multi-language support
 * 
 * Last Updated: 2024-09-09
 * ============================================================================
 */

import {
  DevicePhoneMobileIcon,
  HeartIcon,
  PhoneIcon,
  ShieldCheckIcon,
  SparklesIcon,
  UserCircleIcon,
  VideoCameraIcon
} from '@heroicons/react/24/outline';
import { motion } from 'framer-motion';
import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAppStore } from '../stores/useAppStore';

/**
 * LandingPage - Main landing page with problem/solution explanation
 * 
 * Professional landing page that explains the device asymmetry problem
 * and presents Kids Call Home as the solution, with clear calls-to-action
 * for family setup and interface previews.
 */
const LandingPage: React.FC = () => {
  const navigate = useNavigate();
  const { currentFamily, currentUser, userType, logout } = useAppStore();
  const [familyCode, setFamilyCode] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleFamilyCodeSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!familyCode.trim()) return;
    
    setIsSubmitting(true);
    
    try {
      // TODO: Validate family code
      // TODO: Check if family exists
      // TODO: Redirect to appropriate interface
      
      // For now, redirect to setup page
      navigate('/setup', { state: { familyCode: familyCode.trim() } });
    } catch (error) {
      console.error('Family code validation failed:', error);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleCreateFamily = () => {
    navigate('/setup');
  };

  const handleLogout = () => {
    logout();
    // Refresh the page to clear any cached state
    window.location.reload();
  };

  return (
    <div className="min-h-screen" style={{ background: 'var(--theme-background)' }}>
      {/* Hero Section */}
      <section className="container-responsive py-16 md:py-24">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8, ease: [0.25, 0.46, 0.45, 0.94] }}
          className="text-center max-w-4xl mx-auto"
        >
          {currentFamily && currentUser ? (
            // Logged in user content
            <>
              <h1 className="text-large-title font-bold text-theme mb-6">
                Welcome back, {currentUser.name}!
              </h1>
              
              <p className="text-title2 text-theme-secondary mb-8 max-w-2xl mx-auto">
                You're logged into the <span className="text-theme font-semibold">{currentFamily.name}</span> family.
                <br className="hidden md:block" />
                Ready to connect with your family?
              </p>
              
              <div className="flex flex-col sm:flex-row gap-4 justify-center mb-12">
                <button
                  onClick={() => navigate(userType === 'guardian' ? '/guardian' : '/kids')}
                  className="btn-primary text-headline px-8 py-4"
                >
                  Go to {userType === 'guardian' ? 'Guardian' : 'Kids'} Dashboard
                </button>
                <button
                  onClick={handleLogout}
                  className="btn-outline text-headline px-8 py-4"
                >
                  Logout
                </button>
              </div>
            </>
          ) : (
            // Not logged in content
            <>
              <h1 className="text-large-title font-bold text-theme mb-6">
                Finally! Call Your Kids on Their Tablets
              </h1>
              
              <p className="text-title2 text-theme-secondary mb-8 max-w-2xl mx-auto">
                Your kids can call you, but you can't call them back. 
                <br className="hidden md:block" />
                <span className="text-theme font-semibold">Until now.</span>
              </p>
              
              <div className="flex flex-col sm:flex-row gap-4 justify-center mb-12">
                <button
                  onClick={handleCreateFamily}
                  className="btn-primary text-headline px-8 py-4"
                >
                  Start Your Family
                </button>
                <button
                  onClick={() => document.getElementById('join-family')?.scrollIntoView({ behavior: 'smooth' })}
                  className="btn-secondary text-headline px-8 py-4"
                >
                  Join Existing Family
                </button>
                <button
                  onClick={() => navigate('/login')}
                  className="btn-outline text-headline px-8 py-4"
                >
                  Already Have a Family? Login
                </button>
              </div>
            </>
          )}
        </motion.div>
      </section>

      {/* Problem Section */}
      <section className="py-16">
        <div className="container-responsive">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8, ease: [0.25, 0.46, 0.45, 0.94] }}
            className="text-center max-w-3xl mx-auto"
          >
            <h2 className="text-title1 font-bold text-theme mb-8">
              The Device Asymmetry Problem
            </h2>
            
            <div className="grid md:grid-cols-2 gap-6 mb-12">
              <div className="card-surface p-6">
                <div className="text-6xl mb-4">😔</div>
                <h3 className="text-title3 font-semibold text-theme mb-3">
                  Kids Can Call You
                </h3>
                <p className="text-body text-theme-secondary">
                  Your child's tablet has your contact info, so they can call you anytime.
                </p>
              </div>
              
              <div className="card-surface p-6">
                <div className="text-6xl mb-4">😤</div>
                <h3 className="text-title3 font-semibold text-theme mb-3">
                  You Can't Call Them Back
                </h3>
                <p className="text-body text-theme-secondary">
                  Their device doesn't have your number, so you can't reach them when you need to.
                </p>
              </div>
            </div>
          </motion.div>
        </div>
      </section>

      {/* Solution Section */}
      <section className="py-16">
        <div className="container-responsive">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8 }}
            className="text-center max-w-4xl mx-auto"
          >
            <h2 className="text-title1 font-bold text-theme mb-8">
              Kids Call Home: The Solution
            </h2>
            
            <div className="grid md:grid-cols-3 gap-6 mb-12">
              <div className="card-surface p-6 text-center">
                <ShieldCheckIcon className="w-12 h-12 text-theme-primary mx-auto mb-4" />
                <h3 className="text-title3 font-semibold text-theme mb-3">
                  Family Code Security
                </h3>
                <p className="text-body text-theme-secondary">
                  Simple, memorable codes like "BEAR-CAKE-2024" keep your family connected securely.
                </p>
              </div>
              
              <div className="card-surface p-6 text-center">
                <PhoneIcon className="w-12 h-12 text-theme-primary mx-auto mb-4" />
                <h3 className="text-title3 font-semibold text-theme mb-3">
                  Two-Way Calling
                </h3>
                <p className="text-body text-theme-secondary">
                  Voice and video calls work both ways - parents can call kids, kids can call parents.
                </p>
              </div>
              
              <div className="card-surface p-6 text-center">
                <DevicePhoneMobileIcon className="w-12 h-12 text-theme-primary mx-auto mb-4" />
                <h3 className="text-title3 font-semibold text-theme mb-3">
                  Works Everywhere
                </h3>
                <p className="text-body text-theme-secondary">
                  Tablets, phones, computers - any device with a browser. No app store needed.
                </p>
              </div>
            </div>
          </motion.div>
        </div>
      </section>

      {/* Interface Previews */}
      <section className="py-16 bg-white bg-opacity-10">
        <div className="container-responsive">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8 }}
            className="text-center max-w-6xl mx-auto"
          >
            <h2 className="heading-2 text-white mb-12 text-shadow-lg">
              Two Perfect Interfaces
            </h2>
            
            <div className="grid lg:grid-cols-2 gap-12">
              {/* Guardian Interface Preview */}
              <div 
                className="p-8 rounded-2xl shadow-2xl"
                style={{
                  background: 'var(--theme-glass)',
                  backdropFilter: 'blur(var(--glass-blur))',
                  WebkitBackdropFilter: 'blur(var(--glass-blur))',
                  border: '1px solid var(--theme-border)',
                  color: 'var(--theme-text)'
                }}
              >
                <h3 className="text-2xl font-bold text-white mb-6">
                  For Parents & Guardians
                </h3>
                <div className="bg-gradient-to-br from-slate-800 to-slate-900 p-6 rounded-xl mb-6 shadow-inner">
                  <div className="grid grid-cols-1 gap-4">
                    <div className="bg-white bg-opacity-10 backdrop-blur-sm p-4 rounded-xl border border-white border-opacity-20">
                      <div className="flex items-center space-x-4 mb-4">
                        <UserCircleIcon className="w-12 h-12 text-blue-400" />
                        <div>
                          <h4 className="text-white font-semibold text-lg">Emma</h4>
                          <div className="flex items-center space-x-2">
                            <div className="w-2 h-2 bg-green-400 rounded-full"></div>
                            <p className="text-green-400 text-sm font-medium">Online</p>
                          </div>
                        </div>
                      </div>
                      <div className="flex space-x-3">
                        <button className="flex items-center justify-center space-x-2 px-4 py-2 bg-green-600 hover:bg-green-700 text-white text-sm font-medium rounded-lg transition-colors shadow-sm">
                          <PhoneIcon className="w-4 h-4" />
                          <span>Call</span>
                        </button>
                        <button className="flex items-center justify-center space-x-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium rounded-lg transition-colors shadow-sm">
                          <VideoCameraIcon className="w-4 h-4" />
                          <span>Video</span>
                        </button>
                      </div>
                    </div>
                    <div className="bg-white bg-opacity-10 backdrop-blur-sm p-4 rounded-xl border border-white border-opacity-20">
                      <div className="flex items-center space-x-4 mb-4">
                        <UserCircleIcon className="w-12 h-12 text-gray-400" />
                        <div>
                          <h4 className="text-white font-semibold text-lg">Jake</h4>
                          <div className="flex items-center space-x-2">
                            <div className="w-2 h-2 bg-gray-400 rounded-full"></div>
                            <p className="text-gray-400 text-sm font-medium">Offline</p>
                          </div>
                        </div>
                      </div>
                      <div className="flex space-x-3">
                        <button className="flex items-center justify-center space-x-2 px-4 py-2 bg-gray-600 text-white text-sm font-medium rounded-lg opacity-75">
                          <PhoneIcon className="w-4 h-4" />
                          <span>Call</span>
                        </button>
                        <button className="flex items-center justify-center space-x-2 px-4 py-2 bg-gray-600 text-white text-sm font-medium rounded-lg opacity-75">
                          <VideoCameraIcon className="w-4 h-4" />
                          <span>Video</span>
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
                <p className="text-white text-opacity-90">
                  Professional interface with technical details, multi-child management, 
                  and efficient calling controls.
                </p>
              </div>
              
              {/* Kids Interface Preview */}
              <div 
                className="p-8 rounded-2xl shadow-2xl"
                style={{
                  background: 'var(--theme-glass)',
                  backdropFilter: 'blur(var(--glass-blur))',
                  WebkitBackdropFilter: 'blur(var(--glass-blur))',
                  border: '1px solid var(--theme-border)',
                  color: 'var(--theme-text)'
                }}
              >
                <h3 className="text-2xl font-bold text-white mb-6">
                  For Kids
                </h3>
                <div className="bg-gradient-to-br from-orange-400 to-pink-500 p-6 rounded-xl mb-6 shadow-inner">
                  <div className="space-y-4">
                    <div className="bg-white bg-opacity-30 backdrop-blur-sm p-6 rounded-2xl text-center border border-white border-opacity-40">
                      <UserCircleIcon className="w-16 h-16 text-white mx-auto mb-4" />
                      <h4 className="text-2xl font-bold text-white mb-4">Call Mom</h4>
                      <div className="flex space-x-4 justify-center">
                        <button className="w-16 h-16 bg-green-500 hover:bg-green-600 rounded-full text-white shadow-lg transition-all hover:scale-110 flex items-center justify-center">
                          <PhoneIcon className="w-8 h-8" />
                        </button>
                        <button className="w-16 h-16 bg-blue-500 hover:bg-blue-600 rounded-full text-white shadow-lg transition-all hover:scale-110 flex items-center justify-center">
                          <VideoCameraIcon className="w-8 h-8" />
                        </button>
                      </div>
                    </div>
                    <div className="bg-white bg-opacity-30 backdrop-blur-sm p-6 rounded-2xl text-center border border-white border-opacity-40">
                      <UserCircleIcon className="w-16 h-16 text-white mx-auto mb-4" />
                      <h4 className="text-2xl font-bold text-white mb-4">Call Dad</h4>
                      <div className="flex space-x-4 justify-center">
                        <button className="w-16 h-16 bg-green-500 hover:bg-green-600 rounded-full text-white shadow-lg transition-all hover:scale-110 flex items-center justify-center">
                          <PhoneIcon className="w-8 h-8" />
                        </button>
                        <button className="w-16 h-16 bg-blue-500 hover:bg-blue-600 rounded-full text-white shadow-lg transition-all hover:scale-110 flex items-center justify-center">
                          <VideoCameraIcon className="w-8 h-8" />
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
                <p className="text-white text-opacity-90">
                  Playful interface with large buttons, simple language, 
                  and kid-friendly design for easy calling.
                </p>
              </div>
            </div>
          </motion.div>
        </div>
      </section>

      {/* Join Family Section */}
      <section id="join-family" className="py-16">
        <div className="container-responsive">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8 }}
            className="text-center max-w-2xl mx-auto"
          >
            <h2 className="heading-2 text-white mb-8 text-shadow-lg">
              Join Your Family
            </h2>
            
            <form onSubmit={handleFamilyCodeSubmit} className="space-y-6">
              <div>
                <label htmlFor="familyCode" className="block text-lg font-semibold text-white mb-3">
                  Enter Your Family Code
                </label>
                <input
                  type="text"
                  id="familyCode"
                  value={familyCode}
                  onChange={(e) => setFamilyCode(e.target.value.toUpperCase())}
                  placeholder="BEAR-CAKE-2024"
                  className="w-full px-6 py-4 text-lg rounded-xl border-0 focus:ring-2 focus:ring-white focus:ring-opacity-50 text-center font-mono tracking-wider"
                  maxLength={20}
                />
                <p className="text-white text-opacity-75 mt-2 text-sm">
                  Ask your family for the code, or create a new family above.
                </p>
              </div>
              
              <button
                type="submit"
                disabled={!familyCode.trim() || isSubmitting}
                className="btn-primary text-lg px-8 py-4 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {isSubmitting ? 'Joining...' : 'Join Family'}
              </button>
            </form>
          </motion.div>
        </div>
      </section>

      {/* Features Section */}
      <section className="py-16 bg-white bg-opacity-10">
        <div className="container-responsive">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8 }}
            className="text-center max-w-4xl mx-auto"
          >
            <h2 className="heading-2 text-white mb-12 text-shadow-lg">
              Why Families Love Kids Call Home
            </h2>
            
            <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-8">
              <div className="text-center">
                <HeartIcon className="w-12 h-12 text-white mx-auto mb-4" />
                <h3 className="text-lg font-semibold text-white mb-2">Family-Focused</h3>
                <p className="text-white text-opacity-90 text-sm">
                  Built specifically for family communication, not business.
                </p>
              </div>
              
              <div className="text-center">
                <ShieldCheckIcon className="w-12 h-12 text-white mx-auto mb-4" />
                <h3 className="text-lg font-semibold text-white mb-2">Secure & Private</h3>
                <p className="text-white text-opacity-90 text-sm">
                  Family-scoped access with no external tracking or data collection.
                </p>
              </div>
              
              <div className="text-center">
                <SparklesIcon className="w-12 h-12 text-white mx-auto mb-4" />
                <h3 className="text-lg font-semibold text-white mb-2">Easy to Use</h3>
                <p className="text-white text-opacity-90 text-sm">
                  No complex setup - just enter a family code and start calling.
                </p>
              </div>
              
              <div className="text-center">
                <DevicePhoneMobileIcon className="w-12 h-12 text-white mx-auto mb-4" />
                <h3 className="text-lg font-semibold text-white mb-2">Works Everywhere</h3>
                <p className="text-white text-opacity-90 text-sm">
                  Any device with a browser - tablets, phones, computers, smartwatches.
                </p>
              </div>
            </div>
          </motion.div>
        </div>
      </section>

      {/* Footer CTA */}
      <section className="py-16">
        <div className="container-responsive">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8 }}
            className="text-center max-w-2xl mx-auto"
          >
            <h2 className="heading-2 text-white mb-6 text-shadow-lg">
              Ready to Connect Your Family?
            </h2>
            <p className="text-xl text-white text-opacity-90 mb-8 text-shadow">
              Join thousands of families who can finally call their kids on their tablets.
            </p>
            <button
              onClick={handleCreateFamily}
              className="btn-primary text-xl px-12 py-6"
            >
              Start Your Family Today
            </button>
          </motion.div>
        </div>
      </section>
    </div>
  );
};

export default LandingPage;
