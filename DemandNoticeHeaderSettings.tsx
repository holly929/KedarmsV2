import React, { useState } from 'react';

/**
 * DemandNoticeHeaderSettings
 * 
 * Provides a UI section for users to configure custom header captions 
 * for generated demand notice documents.
 */
const DemandNoticeHeaderSettings: React.FC = () => {
  const [headerCaption, setHeaderCaption] = useState<string>('');
  const [status, setStatus] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle');

  const handleSave = async () => {
    setStatus('saving');
    try {
      // Placeholder for your API logic to persist the settings
      // e.g., await api.patch('/api/settings', { demandNoticeCaption: headerCaption });
      await new Promise(resolve => setTimeout(resolve, 600)); // Simulate network
      setStatus('saved');
      setTimeout(() => setStatus('idle'), 2000);
    } catch (error) {
      console.error('Failed to save header settings:', error);
      setStatus('error');
    }
  };

  return (
    <div className="mt-8 border-t border-gray-200 pt-8">
      <h3 className="text-lg font-medium leading-6 text-gray-900">Demand Notice Settings</h3>
      <p className="mt-1 text-sm text-gray-500">
        Customize the header information that appears on issued demand notices.
      </p>

      <div className="mt-6 grid grid-cols-1 gap-y-6 gap-x-4 sm:grid-cols-6">
        <div className="sm:col-span-4">
          <label htmlFor="header-caption" className="block text-sm font-medium text-gray-700">
            Header Caption
          </label>
          <div className="mt-1 flex rounded-md shadow-sm">
            <input
              type="text"
              name="header-caption"
              id="header-caption"
              value={headerCaption}
              onChange={(e) => setHeaderCaption(e.target.value)}
              className="block w-full min-w-0 flex-1 rounded-md border-gray-300 focus:border-blue-500 focus:ring-blue-500 sm:text-sm p-2 border"
              placeholder="e.g., FINAL NOTICE OF NON-PAYMENT"
            />
          </div>
        </div>
      </div>

      <div className="mt-4 flex justify-end">
        <button
          type="button"
          onClick={handleSave}
          disabled={status === 'saving'}
          className={`inline-flex justify-center rounded-md border border-transparent py-2 px-4 text-sm font-medium text-white shadow-sm focus:outline-none focus:ring-2 focus:ring-offset-2 ${
            status === 'saved' ? 'bg-green-600' : 'bg-blue-600 hover:bg-blue-700 focus:ring-blue-500'
          } transition-colors`}
        >
          {status === 'saving' ? 'Saving...' : status === 'saved' ? 'Saved' : 'Save Header Settings'}
        </button>
      </div>
    </div>
  );
};

export default DemandNoticeHeaderSettings;