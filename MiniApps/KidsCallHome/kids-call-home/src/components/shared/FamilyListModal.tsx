/**
 * ============================================================================
 * KIDS CALL HOME - Family List Modal
 * ============================================================================
 * 
 * Purpose: Display existing families and allow selection
 * Interface: Shared - used by setup and management pages
 * Dependencies: React, FamilyDataService
 * 
 * V1 Features:
 * - List all existing families
 * - Show family codes and member counts
 * - Allow family selection
 * - Prevent duplicate family creation
 * 
 * Last Updated: 2024-09-09
 * ============================================================================
 */

import { XMarkIcon } from '@heroicons/react/24/outline';
import { motion } from 'framer-motion';
import React from 'react';
import FamilyDataService from '../../services/familyDataService';

interface FamilyListModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSelectFamily: (familyCode: string) => void;
  onJoinFamily: (familyCode: string) => void;
}

const FamilyListModal: React.FC<FamilyListModalProps> = ({
  isOpen,
  onClose,
  onSelectFamily,
  onJoinFamily
}) => {
  if (!isOpen) return null;

  const families = FamilyDataService.getAllFamilies();

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      {/* Backdrop */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="absolute inset-0 bg-black bg-opacity-50"
        onClick={onClose}
      />
      
      {/* Modal */}
      <motion.div
        initial={{ opacity: 0, scale: 0.95, y: 20 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.95, y: 20 }}
        className="relative bg-white rounded-2xl shadow-2xl max-w-2xl w-full max-h-[80vh] overflow-hidden"
      >
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-gray-200">
          <h2 className="text-2xl font-bold text-gray-900">
            Existing Families
          </h2>
          <button
            onClick={onClose}
            className="p-2 hover:bg-gray-100 rounded-full transition-colors"
          >
            <XMarkIcon className="w-6 h-6 text-gray-500" />
          </button>
        </div>

        {/* Content */}
        <div className="p-6 max-h-[60vh] overflow-y-auto">
          {families.length === 0 ? (
            <div className="text-center py-8">
              <div className="text-6xl mb-4">🏠</div>
              <h3 className="text-xl font-semibold text-gray-900 mb-2">
                No Families Found
              </h3>
              <p className="text-gray-600">
                No families have been created yet. Create a new family to get started!
              </p>
            </div>
          ) : (
            <div className="space-y-4">
              {families.map((family) => (
                <div
                  key={family.id}
                  className="border border-gray-200 rounded-xl p-4 hover:bg-gray-50 transition-colors"
                >
                  <div className="flex items-center justify-between mb-3">
                    <h3 className="text-lg font-semibold text-gray-900">
                      {family.name}
                    </h3>
                    <div className="text-sm text-gray-500">
                      Created {new Date(family.created).toLocaleDateString()}
                    </div>
                  </div>
                  
                  <div className="mb-3">
                    <div className="text-sm text-gray-600 mb-1">Family Code:</div>
                    <div className="font-mono text-lg font-bold text-blue-600 bg-blue-50 px-3 py-2 rounded-lg">
                      {family.code}
                    </div>
                  </div>
                  
                  <div className="grid grid-cols-2 gap-4 mb-4">
                    <div>
                      <div className="text-sm text-gray-600 mb-1">Guardians:</div>
                      <div className="text-sm font-medium text-gray-900">
                        {family.guardians.map(g => g.name).join(', ')}
                      </div>
                    </div>
                    <div>
                      <div className="text-sm text-gray-600 mb-1">Children:</div>
                      <div className="text-sm font-medium text-gray-900">
                        {family.children.length > 0 
                          ? family.children.map(c => c.name).join(', ')
                          : 'No children added yet'
                        }
                      </div>
                    </div>
                  </div>
                  
                  <div className="flex gap-2">
                    <button
                      onClick={() => {
                        onSelectFamily(family.code);
                        onClose();
                      }}
                      className="flex-1 bg-blue-500 hover:bg-blue-600 text-white font-semibold py-2 px-4 rounded-lg transition-colors"
                    >
                      Use This Family Code
                    </button>
                    <button
                      onClick={() => {
                        onJoinFamily(family.code);
                        onClose();
                      }}
                      className="flex-1 bg-green-500 hover:bg-green-600 text-white font-semibold py-2 px-4 rounded-lg transition-colors"
                    >
                      Join This Family
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between p-6 border-t border-gray-200 bg-gray-50">
          <p className="text-sm text-gray-600">
            {families.length} {families.length === 1 ? 'family' : 'families'} found
          </p>
          <button
            onClick={onClose}
            className="px-4 py-2 text-gray-600 hover:text-gray-800 font-medium transition-colors"
          >
            Close
          </button>
        </div>
      </motion.div>
    </div>
  );
};

export default FamilyListModal;




