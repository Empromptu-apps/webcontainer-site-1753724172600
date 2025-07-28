import React, { useState, useEffect } from 'react';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, BarChart, Bar, ResponsiveContainer } from 'recharts';

const API_BASE = 'https://staging.empromptu.ai/api_tools';
const API_HEADERS = {
  'Authorization': 'Bearer 22c3d153c7f536d80c3c384fb6ddc93c',
  'X-Generated-App-ID': 'e7bc17d0-5a4a-4bad-8a4f-75c36b2116c9',
  'X-Usage-Key': '369397c6ffb66469db3dc7796c8f70f9',
  'Content-Type': 'application/json'
};

const TigerFiveGolfTracker = () => {
  const [activeTab, setActiveTab] = useState('input');
  const [darkMode, setDarkMode] = useState(false);
  const [rounds, setRounds] = useState([]);
  const [apiLogs, setApiLogs] = useState([]);
  const [showApiLogs, setShowApiLogs] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [processingStep, setProcessingStep] = useState('');
  const [formData, setFormData] = useState({
    date: new Date().toISOString().split('T')[0],
    course: '',
    totalScore: '',
    doubleBogeyOrWorse: 0,
    bogeyOnPar5: 0,
    threePutts: 0,
    bogeyInside150: 0,
    missedEasySaves: 0,
    badDrives: 0
  });

  useEffect(() => {
    const savedRounds = localStorage.getItem('tigerFiveRounds');
    if (savedRounds) {
      setRounds(JSON.parse(savedRounds));
    }
    
    const savedDarkMode = localStorage.getItem('darkMode');
    if (savedDarkMode) {
      setDarkMode(JSON.parse(savedDarkMode));
    }
  }, []);

  useEffect(() => {
    localStorage.setItem('tigerFiveRounds', JSON.stringify(rounds));
  }, [rounds]);

  useEffect(() => {
    localStorage.setItem('darkMode', JSON.stringify(darkMode));
    if (darkMode) {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
  }, [darkMode]);

  const logApiCall = (method, endpoint, data, response) => {
    const logEntry = {
      timestamp: new Date().toISOString(),
      method,
      endpoint,
      data,
      response,
      id: Date.now()
    };
    setApiLogs(prev => [logEntry, ...prev.slice(0, 9)]);
  };

  const apiCall = async (endpoint, method = 'POST', data = null) => {
    try {
      const response = await fetch(`${API_BASE}${endpoint}`, {
        method,
        headers: API_HEADERS,
        body: data ? JSON.stringify(data) : null
      });
      
      const result = await response.json();
      logApiCall(method, endpoint, data, result);
      return result;
    } catch (error) {
      logApiCall(method, endpoint, data, { error: error.message });
      throw error;
    }
  };

  const handleInputChange = (field, value) => {
    setFormData(prev => ({
      ...prev,
      [field]: field === 'date' || field === 'course' || field === 'totalScore' ? value : parseInt(value) || 0
    }));
  };

  const calculateTigerFive = (round) => {
    return round.doubleBogeyOrWorse + round.bogeyOnPar5 + round.threePutts + 
           round.bogeyInside150 + round.missedEasySaves;
  };

  const submitRound = async () => {
    if (!formData.course || !formData.totalScore) {
      alert('Please enter course name and total score');
      return;
    }

    setIsProcessing(true);
    setProcessingStep('Saving round data...');

    try {
      const newRound = {
        ...formData,
        id: Date.now(),
        tigerFive: calculateTigerFive(formData)
      };

      // Store round data via API
      const roundData = JSON.stringify(newRound);
      await apiCall('/input_data', 'POST', {
        created_object_name: `golf_round_${newRound.id}`,
        data_type: 'strings',
        input_data: [roundData]
      });

      setProcessingStep('Analyzing performance...');
      
      // Generate analysis
      await apiCall('/apply_prompt', 'POST', {
        created_object_names: [`analysis_${newRound.id}`],
        prompt_string: 'Analyze this golf round data and provide insights on Tiger Five performance: {round_data}',
        inputs: [{
          object_name: `golf_round_${newRound.id}`,
          processing_mode: 'combine_events'
        }]
      });

      setRounds(prev => [newRound, ...prev]);
      
      setFormData({
        date: new Date().toISOString().split('T')[0],
        course: '',
        totalScore: '',
        doubleBogeyOrWorse: 0,
        bogeyOnPar5: 0,
        threePutts: 0,
        bogeyInside150: 0,
        missedEasySaves: 0,
        badDrives: 0
      });

      setProcessingStep('Complete!');
      setTimeout(() => {
        setIsProcessing(false);
        setProcessingStep('');
      }, 1000);

    } catch (error) {
      console.error('Error saving round:', error);
      setIsProcessing(false);
      setProcessingStep('');
      alert('Error saving round. Please try again.');
    }
  };

  const deleteAllData = async () => {
    if (!confirm('Are you sure you want to delete all golf data? This cannot be undone.')) {
      return;
    }

    try {
      // Delete API objects
      for (const round of rounds) {
        try {
          await fetch(`${API_BASE}/objects/golf_round_${round.id}`, {
            method: 'DELETE',
            headers: API_HEADERS
          });
          await fetch(`${API_BASE}/objects/analysis_${round.id}`, {
            method: 'DELETE',
            headers: API_HEADERS
          });
        } catch (error) {
          console.log('Error deleting object:', error);
        }
      }

      // Clear local storage
      setRounds([]);
      localStorage.removeItem('tigerFiveRounds');
      alert('All data deleted successfully');
    } catch (error) {
      console.error('Error deleting data:', error);
      alert('Error deleting some data');
    }
  };

  const exportData = () => {
    const csvContent = [
      'Date,Course,Total Score,Tiger Five,Double Bogey+,Bogey Par 5,3-Putts,Bogey <150y,Missed Saves,Bad Drives',
      ...rounds.map(round => 
        `${round.date},${round.course},${round.totalScore},${round.tigerFive},${round.doubleBogeyOrWorse},${round.bogeyOnPar5},${round.threePutts},${round.bogeyInside150},${round.missedEasySaves},${round.badDrives}`
      )
    ].join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'tiger-five-golf-data.csv';
    a.click();
    window.URL.revokeObjectURL(url);
  };

  const getRecentRounds = (count) => rounds.slice(0, count);
  
  const getAverages = (roundsToAnalyze) => {
    if (roundsToAnalyze.length === 0) return {};
    
    const totals = roundsToAnalyze.reduce((acc, round) => ({
      tigerFive: acc.tigerFive + round.tigerFive,
      doubleBogeyOrWorse: acc.doubleBogeyOrWorse + round.doubleBogeyOrWorse,
      bogeyOnPar5: acc.bogeyOnPar5 + round.bogeyOnPar5,
      threePutts: acc.threePutts + round.threePutts,
      bogeyInside150: acc.bogeyInside150 + round.bogeyInside150,
      missedEasySaves: acc.missedEasySaves + round.missedEasySaves,
      badDrives: acc.badDrives + round.badDrives
    }), {
      tigerFive: 0, doubleBogeyOrWorse: 0, bogeyOnPar5: 0, 
      threePutts: 0, bogeyInside150: 0, missedEasySaves: 0, badDrives: 0
    });

    const count = roundsToAnalyze.length;
    return {
      tigerFive: (totals.tigerFive / count).toFixed(1),
      doubleBogeyOrWorse: (totals.doubleBogeyOrWorse / count).toFixed(1),
      bogeyOnPar5: (totals.bogeyOnPar5 / count).toFixed(1),
      threePutts: (totals.threePutts / count).toFixed(1),
      bogeyInside150: (totals.bogeyInside150 / count).toFixed(1),
      missedEasySaves: (totals.missedEasySaves / count).toFixed(1),
      badDrives: (totals.badDrives / count).toFixed(1)
    };
  };

  const chartData = rounds.slice(0, 20).reverse().map((round, index) => ({
    round: `R${index + 1}`,
    date: round.date,
    tigerFive: round.tigerFive,
    doubleBogeyOrWorse: round.doubleBogeyOrWorse,
    bogeyOnPar5: round.bogeyOnPar5,
    threePutts: round.threePutts,
    bogeyInside150: round.bogeyInside150,
    missedEasySaves: round.missedEasySaves,
    badDrives: round.badDrives
  }));

  const recent5 = getAverages(getRecentRounds(5));
  const recent10 = getAverages(getRecentRounds(10));
  const recent20 = getAverages(getRecentRounds(20));

  return (
    <div className={`min-h-screen transition-colors duration-300 ${darkMode ? 'dark bg-gray-900' : 'bg-gray-50'}`}>
      <div className="max-w-6xl mx-auto p-4 sm:p-6 lg:p-8">
        {/* Header */}
        <div className="flex flex-col sm:flex-row justify-between items-center mb-8">
          <h1 className="text-3xl sm:text-4xl font-bold text-primary-600 dark:text-primary-400 mb-4 sm:mb-0">
            Tiger Five Golf Tracker
          </h1>
          <div className="flex items-center space-x-4">
            <button
              onClick={() => setDarkMode(!darkMode)}
              className="p-2 rounded-xl bg-white dark:bg-gray-800 shadow-lg hover:shadow-xl transition-all duration-200"
              aria-label="Toggle dark mode"
            >
              {darkMode ? 'âï¸' : 'ð'}
            </button>
            <button
              onClick={() => setShowApiLogs(!showApiLogs)}
              className="px-4 py-2 bg-green-500 text-white rounded-xl hover:bg-green-600 transition-colors duration-200"
              aria-label="Show API logs"
            >
              API Logs
            </button>
            <button
              onClick={deleteAllData}
              className="px-4 py-2 bg-red-500 text-white rounded-xl hover:bg-red-600 transition-colors duration-200"
              aria-label="Delete all data"
            >
              Delete All
            </button>
          </div>
        </div>

        {/* API Logs Modal */}
        {showApiLogs && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
            <div className="bg-white dark:bg-gray-800 rounded-2xl max-w-4xl w-full max-h-[80vh] overflow-hidden">
              <div className="p-6 border-b border-gray-200 dark:border-gray-700">
                <div className="flex justify-between items-center">
                  <h3 className="text-xl font-bold text-gray-900 dark:text-white">API Call Logs</h3>
                  <button
                    onClick={() => setShowApiLogs(false)}
                    className="text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200"
                  >
                    â
                  </button>
                </div>
              </div>
              <div className="p-6 overflow-y-auto max-h-[60vh]">
                {apiLogs.length === 0 ? (
                  <p className="text-gray-500 dark:text-gray-400">No API calls yet</p>
                ) : (
                  <div className="space-y-4">
                    {apiLogs.map(log => (
                      <div key={log.id} className="bg-gray-50 dark:bg-gray-700 rounded-xl p-4">
                        <div className="flex justify-between items-start mb-2">
                          <span className="font-mono text-sm text-primary-600 dark:text-primary-400">
                            {log.method} {log.endpoint}
                          </span>
                          <span className="text-xs text-gray-500 dark:text-gray-400">
                            {new Date(log.timestamp).toLocaleTimeString()}
                          </span>
                        </div>
                        <pre className="text-xs bg-white dark:bg-gray-800 p-2 rounded overflow-x-auto">
                          {JSON.stringify({ request: log.data, response: log.response }, null, 2)}
                        </pre>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        {/* Processing Modal */}
        {isProcessing && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
            <div className="bg-white dark:bg-gray-800 rounded-2xl p-8 max-w-md w-full mx-4">
              <div className="text-center">
                <div className="spinner mx-auto mb-4"></div>
                <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">Processing Round</h3>
                <p className="text-gray-600 dark:text-gray-400">{processingStep}</p>
              </div>
            </div>
          </div>
        )}

        {/* Tab Navigation */}
        <div className="flex mb-8 bg-white dark:bg-gray-800 rounded-2xl shadow-lg overflow-hidden">
          <button
            onClick={() => setActiveTab('input')}
            className={`flex-1 py-4 px-6 font-semibold transition-all duration-200 ${
              activeTab === 'input'
                ? 'bg-primary-500 text-white'
                : 'text-primary-600 dark:text-primary-400 hover:bg-primary-50 dark:hover:bg-gray-700'
            }`}
            aria-label="Input round data"
          >
            Input Round
          </button>
          <button
            onClick={() => setActiveTab('analytics')}
            className={`flex-1 py-4 px-6 font-semibold transition-all duration-200 ${
              activeTab === 'analytics'
                ? 'bg-primary-500 text-white'
                : 'text-primary-600 dark:text-primary-400 hover:bg-primary-50 dark:hover:bg-gray-700'
            }`}
            aria-label="View analytics"
          >
            Analytics
          </button>
        </div>

        {activeTab === 'input' && (
          <div className="space-y-8 fade-in">
            {/* Basic Round Info */}
            <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-lg p-6">
              <h3 className="text-xl font-bold text-gray-900 dark:text-white mb-6">Round Details</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                  <label className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2">
                    Date
                  </label>
                  <input
                    type="date"
                    value={formData.date}
                    onChange={(e) => handleInputChange('date', e.target.value)}
                    className="w-full px-4 py-3 border border-gray-300 dark:border-gray-600 rounded-xl focus:ring-2 focus:ring-primary-500 focus:border-transparent bg-white dark:bg-gray-700 text-gray-900 dark:text-white transition-all duration-200"
                    aria-label="Round date"
                  />
                </div>
                <div>
                  <label className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2">
                    Total Score
                  </label>
                  <input
                    type="number"
                    value={formData.totalScore}
                    onChange={(e) => handleInputChange('totalScore', e.target.value)}
                    className="w-full px-4 py-3 border border-gray-300 dark:border-gray-600 rounded-xl focus:ring-2 focus:ring-primary-500 focus:border-transparent bg-white dark:bg-gray-700 text-gray-900 dark:text-white transition-all duration-200"
                    placeholder="Enter total score"
                    aria-label="Total score"
                  />
                </div>
                <div className="md:col-span-2">
                  <label className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2">
                    Course Name
                  </label>
                  <input
                    type="text"
                    value={formData.course}
                    onChange={(e) => handleInputChange('course', e.target.value)}
                    className="w-full px-4 py-3 border border-gray-300 dark:border-gray-600 rounded-xl focus:ring-2 focus:ring-primary-500 focus:border-transparent bg-white dark:bg-gray-700 text-gray-900 dark:text-white transition-all duration-200"
                    placeholder="Enter course name"
                    aria-label="Course name"
                  />
                </div>
              </div>
            </div>

            {/* Tiger Five Mistakes */}
            <div className="bg-gradient-to-br from-yellow-50 to-orange-50 dark:from-yellow-900/20 dark:to-orange-900/20 rounded-2xl shadow-lg p-6 border border-yellow-200 dark:border-yellow-800">
              <h3 className="text-xl font-bold text-yellow-800 dark:text-yellow-200 mb-6">Tiger Five Mistakes</h3>
              <div className="space-y-4">
                {[
                  { key: 'doubleBogeyOrWorse', label: 'Double Bogeys or Worse', desc: 'Any hole 2+ over par' },
                  { key: 'bogeyOnPar5', label: 'Bogeys or Worse on Par 5s', desc: 'Missing birdie opportunities' },
                  { key: 'threePutts', label: '3-Putts', desc: 'Poor putting execution' },
                  { key: 'bogeyInside150', label: 'Bogeys from Inside 150 Yards', desc: 'Short game mistakes' },
                  { key: 'missedEasySaves', label: 'Blown Easy Saves', desc: 'Missed up-and-downs near green' }
                ].map(mistake => (
                  <div key={mistake.key} className="flex items-center justify-between p-4 bg-white dark:bg-gray-800 rounded-xl shadow-sm">
                    <div className="flex-1">
                      <label className="block font-semibold text-gray-900 dark:text-white">
                        {mistake.label}
                      </label>
                      <p className="text-sm text-gray-600 dark:text-gray-400">{mistake.desc}</p>
                    </div>
                    <input
                      type="number"
                      min="0"
                      value={formData[mistake.key]}
                      onChange={(e) => handleInputChange(mistake.key, e.target.value)}
                      className="w-20 px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg text-center focus:ring-2 focus:ring-primary-500 focus:border-transparent bg-white dark:bg-gray-700 text-gray-900 dark:text-white transition-all duration-200"
                      aria-label={mistake.label}
                    />
                  </div>
                ))}
              </div>
              <div className={`mt-6 p-4 rounded-xl text-center ${
                calculateTigerFive(formData) <= 6 
                  ? 'bg-green-100 dark:bg-green-900/30 border border-green-300 dark:border-green-700' 
                  : 'bg-red-100 dark:bg-red-900/30 border border-red-300 dark:border-red-700'
              }`}>
                <div className="text-2xl font-bold text-gray-900 dark:text-white">
                  Tiger Five Total: {calculateTigerFive(formData)}
                </div>
                {calculateTigerFive(formData) <= 6 && (
                  <div className="text-green-700 dark:text-green-300 font-semibold mt-1">
                    â Goal Achieved!
                  </div>
                )}
              </div>
            </div>

            {/* Additional Stats */}
            <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-lg p-6">
              <h3 className="text-xl font-bold text-gray-900 dark:text-white mb-6">Additional Stats</h3>
              <div className="flex items-center justify-between p-4 bg-gray-50 dark:bg-gray-700 rounded-xl">
                <div>
                  <label className="block font-semibold text-gray-900 dark:text-white">
                    Bad Drives
                  </label>
                  <p className="text-sm text-gray-600 dark:text-gray-400">Drives that don't leave open shots to green</p>
                </div>
                <input
                  type="number"
                  min="0"
                  value={formData.badDrives}
                  onChange={(e) => handleInputChange('badDrives', e.target.value)}
                  className="w-20 px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg text-center focus:ring-2 focus:ring-primary-500 focus:border-transparent bg-white dark:bg-gray-800 text-gray-900 dark:text-white transition-all duration-200"
                  aria-label="Bad drives"
                />
              </div>
            </div>

            <button
              onClick={submitRound}
              disabled={isProcessing}
              className="w-full py-4 bg-primary-500 hover:bg-primary-600 disabled:bg-gray-400 text-white font-bold rounded-2xl shadow-lg hover:shadow-xl transition-all duration-200 text-lg"
              aria-label="Save round data"
            >
              {isProcessing ? 'Saving Round...' : 'Save Round'}
            </button>
          </div>
        )}

        {activeTab === 'analytics' && (
          <div className="space-y-8 fade-in">
            {rounds.length === 0 ? (
              <div className="text-center py-16">
                <div className="text-6xl mb-4">â³</div>
                <h3 className="text-2xl font-bold text-gray-900 dark:text-white mb-2">No Rounds Yet</h3>
                <p className="text-gray-600 dark:text-gray-400 text-lg">
                  Add your first round to see analytics and track your Tiger Five progress!
                </p>
              </div>
            ) : (
              <>
                {/* Export Button */}
                <div className="flex justify-end">
                  <button
                    onClick={exportData}
                    className="px-6 py-3 bg-green-500 hover:bg-green-600 text-white font-semibold rounded-xl shadow-lg hover:shadow-xl transition-all duration-200"
                    aria-label="Download CSV data"
                  >
                    ð Download CSV
                  </button>
                </div>

                {/* Recent Performance Summary */}
                <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-lg p-6">
                  <h3 className="text-xl font-bold text-gray-900 dark:text-white mb-6">Recent Performance</h3>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                    {[
                      { label: 'Last 5 Rounds', data: recent5, count: Math.min(5, rounds.length) },
                      { label: 'Last 10 Rounds', data: recent10, count: Math.min(10, rounds.length) },
                      { label: 'Last 20 Rounds', data: recent20, count: Math.min(20, rounds.length) }
                    ].filter(period => period.count > 0).map(period => (
                      <div key={period.label} className="text-center p-6 bg-gray-50 dark:bg-gray-700 rounded-xl">
                        <h4 className="font-semibold text-gray-900 dark:text-white mb-3">{period.label}</h4>
                        <div className={`text-4xl font-bold mb-2 ${
                          parseFloat(period.data.tigerFive) <= 6 ? 'text-green-500' : 'text-red-500'
                        }`}>
                          {period.data.tigerFive}
                        </div>
                        <div className="text-sm text-gray-600 dark:text-gray-400">Avg Tiger Five</div>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Tiger Five Trend Chart */}
                {chartData.length > 0 && (
                  <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-lg p-6">
                    <h3 className="text-xl font-bold text-gray-900 dark:text-white mb-6">
                      Tiger Five Trend (Last 20 Rounds)
                    </h3>
                    <div className="h-80">
                      <ResponsiveContainer width="100%" height="100%">
                        <LineChart data={chartData}>
                          <CartesianGrid strokeDasharray="3 3" stroke={darkMode ? '#374151' : '#e5e7eb'} />
                          <XAxis dataKey="round" stroke={darkMode ? '#9ca3af' : '#6b7280'} />
                          <YAxis stroke={darkMode ? '#9ca3af' : '#6b7280'} />
                          <Tooltip 
                            contentStyle={{
                              backgroundColor: darkMode ? '#1f2937' : '#ffffff',
                              border: `1px solid ${darkMode ? '#374151' : '#e5e7eb'}`,
                              borderRadius: '8px',
                              color: darkMode ? '#ffffff' : '#000000'
                            }}
                          />
                          <Line 
                            type="monotone" 
                            dataKey="tigerFive" 
                            stroke="#2c5530" 
                            strokeWidth={3}
                            dot={{ fill: '#2c5530', strokeWidth: 2, r: 4 }}
                            name="Tiger Five"
                          />
                          <Line 
                            type="monotone" 
                            dataKey={() => 6}
                            stroke="#dc2626" 
                            strokeDasharray="5 5"
                            dot={false}
                            name="Goal (6)"
                          />
                        </LineChart>
                      </ResponsiveContainer>
                    </div>
                  </div>
                )}

                {/* Mistake Breakdown */}
                {rounds.length >= 5 && (
                  <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-lg p-6">
                    <h3 className="text-xl font-bold text-gray-900 dark:text-white mb-6">
                      Mistake Breakdown (Last 5 Rounds Average)
                    </h3>
                    <div className="h-80">
                      <ResponsiveContainer width="100%" height="100%">
                        <BarChart data={[
                          { name: 'Double Bogey+', value: parseFloat(recent5.doubleBogeyOrWorse) },
                          { name: 'Bogey Par 5', value: parseFloat(recent5.bogeyOnPar5) },
                          { name: '3-Putts', value: parseFloat(recent5.threePutts) },
                          { name: 'Bogey <150y', value: parseFloat(recent5.bogeyInside150) },
                          { name: 'Missed Saves', value: parseFloat(recent5.missedEasySaves) },
                          { name: 'Bad Drives', value: parseFloat(recent5.badDrives) }
                        ]}>
                          <CartesianGrid strokeDasharray="3 3" stroke={darkMode ? '#374151' : '#e5e7eb'} />
                          <XAxis dataKey="name" stroke={darkMode ? '#9ca3af' : '#6b7280'} />
                          <YAxis stroke={darkMode ? '#9ca3af' : '#6b7280'} />
                          <Tooltip 
                            contentStyle={{
                              backgroundColor: darkMode ? '#1f2937' : '#ffffff',
                              border: `1px solid ${darkMode ? '#374151' : '#e5e7eb'}`,
                              borderRadius: '8px',
                              color: darkMode ? '#ffffff' : '#000000'
                            }}
                          />
                          <Bar dataKey="value" fill="#2c5530" radius={[4, 4, 0, 0]} />
                        </BarChart>
                      </ResponsiveContainer>
                    </div>
                  </div>
                )}

                {/* Recent Rounds Table */}
                <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-lg overflow-hidden">
                  <div className="p-6 border-b border-gray-200 dark:border-gray-700">
                    <h3 className="text-xl font-bold text-gray-900 dark:text-white">Recent Rounds</h3>
                  </div>
                  <div className="overflow-x-auto">
                    <table className="table table-hover w-full">
                      <thead className="bg-gray-50 dark:bg-gray-700">
                        <tr>
                          <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                            Date
                          </th>
                          <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                            Course
                          </th>
                          <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                            Score
                          </th>
                          <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                            Tiger Five
                          </th>
                          <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                            Status
                          </th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
                        {rounds.slice(0, 10).map(round => (
                          <tr key={round.id} className={`${
                            round.tigerFive <= 6 
                              ? 'bg-green-50 dark:bg-green-900/20' 
                              : 'bg-red-50 dark:bg-red-900/20'
                          } hover:bg-opacity-75 transition-colors duration-200`}>
                            <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 dark:text-white">
                              {new Date(round.date).toLocaleDateString()}
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900 dark:text-white">
                              {round.course}
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap text-sm text-center text-gray-900 dark:text-white">
                              {round.totalScore}
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap text-sm text-center font-bold">
                              <span className={round.tigerFive <= 6 ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'}>
                                {round.tigerFive}
                              </span>
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap text-center">
                              {round.tigerFive <= 6 ? (
                                <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300">
                                  â Goal Met
                                </span>
                              ) : (
                                <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300">
                                  Above Goal
                                </span>
                              )}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              </>
            )}
          </div>
        )}
      </div>
    </div>
  );
};

export default TigerFiveGolfTracker;
