const { DateTime } = luxon;

let dailyChart = null;
let weeklyChart = null;
let currentTest = '';
let testDataCache = {};
let currentPage = 1;
const recordsPerPage = 10;
let totalPages = 1;
let currentData = [];

// DOM elements
const loginPage = document.getElementById('login-page');
const dashboardPage = document.getElementById('dashboard-page');
const testPage = document.getElementById('test-page');
const testPageTitle = document.getElementById('test-page-title');
const dailyDateInput = document.getElementById('daily-date');
const weeklyDateInput = document.getElementById('weekly-date');
const resultsTableBody = document.getElementById('results-table-body');
const prevPageButton = document.getElementById('prev-page');
const nextPageButton = document.getElementById('next-page');
const paginationInfo = document.getElementById('pagination-info');
const chatWindow = document.getElementById('chat-window');
const chatMessages = document.getElementById('chat-messages');
const chatInput = document.getElementById('chat-input');
const chatbotLogo = document.getElementById('chatbot-logo');

// Login handler
function handleLogin() {
    const username = document.getElementById('username').value;
    const password = document.getElementById('password').value;
    
    if (username === 'admin' && password === 'password') {
        loginPage.classList.add('hidden');
        dashboardPage.classList.remove('hidden');
        chatbotLogo.classList.add('hidden'); // Hide chatbot logo on dashboard
    } else {
        alert('Invalid credentials. Please try again.');
    }
}

// Logout handler
function logout() {
    dashboardPage.classList.add('hidden');
    testPage.classList.add('hidden');
    loginPage.classList.remove('hidden');
    chatbotLogo.classList.add('hidden'); // Hide chatbot logo on login
    document.getElementById('username').value = '';
    document.getElementById('password').value = '';
}

// Load test project page
async function loadTestPage(testName) {
    currentTest = testName;
    dashboardPage.classList.add('hidden');
    testPage.classList.remove('hidden');
    testPageTitle.textContent = `Welcome to ${testName.charAt(0).toUpperCase() + testName.slice(1)} Project`;
    
    // Set default dates to today in EST
    const today = DateTime.now().setZone('America/New_York');
    const oneWeekAgo = today.minus({ days: 6 });
    
    dailyDateInput.value = today.toISODate();
    weeklyDateInput.value = today.toISODate();
    
    // Reset chatbot
    chatWindow.classList.add('hidden');
    chatMessages.innerHTML = '';
    chatInput.value = '';
    chatbotLogo.classList.remove('hidden'); // Show chatbot logo on test page
    
    // Load data
    try {
        const data = await loadTestData(testName);
        currentData = data;
        console.log('Loaded currentData:', currentData); // Debug data loading
        currentPage = 1;
        totalPages = Math.ceil(data.length / recordsPerPage);
        
        updateDailyChart(today, data);
        updateWeeklyChart(today, data);
        updateResultsTable();
        updatePaginationControls();
        
        // Add event listeners for date changes
        dailyDateInput.onchange = function() {
            const selectedDate = DateTime.fromISO(this.value, { zone: 'America/New_York' });
            updateDailyChart(selectedDate, data);
        };
        
        weeklyDateInput.onchange = function() {
            const selectedDate = DateTime.fromISO(this.value, { zone: 'America/New_York' });
            updateWeeklyChart(selectedDate, data);
        };
    } catch (error) {
        console.error(`Failed to load test page for ${testName}:`, error);
        alert(`Error loading ${testName} data: ${error.message}. Please check the console for details.`);
    }
}

// Back to dashboard
function backToDashboard() {
    testPage.classList.add('hidden');
    dashboardPage.classList.remove('hidden');
    chatbotLogo.classList.add('hidden'); // Hide chatbot logo on dashboard
    
    // Destroy charts to prevent memory leaks
    if (dailyChart) dailyChart.destroy();
    if (weeklyChart) weeklyChart.destroy();
}

// Load test data from JSON file
async function loadTestData(testName) {
    if (testDataCache[testName]) {
        return testDataCache[testName];
    }
    
    try {
        const response = await fetch(`data/${testName}.json`);
        if (!response.ok) {
            throw new Error(`HTTP error ${response.status}: Could not fetch data/${testName}.json. Check if the file exists and is accessible.`);
        }
        const data = await response.json();
        if (!Array.isArray(data)) {
            throw new Error(`Invalid JSON format in ${testName}.json: Expected an array.`);
        }
        testDataCache[testName] = data;
        return data;
    } catch (error) {
        console.error(`Error loading ${testName}.json:`, error);
        throw new Error(`Failed to load ${testName}.json: ${error.message}`);
    }
}

// Update daily chart
function updateDailyChart(date, data) {
    const dateStr = date.toISODate();
    const dailyData = data.find(item => item.Date === dateStr);
    
    // Update stats
    if (!dailyData) {
        document.getElementById('daily-total').textContent = 'NA';
        document.getElementById('daily-passed').textContent = 'NA';
        document.getElementById('daily-failed').textContent = 'NA';
        document.getElementById('daily-skipped').textContent = 'NA';
        
        var chartData = {
            Total: "0", Passed: "0", Failed: "0", Skipped: "0", Broken: "0", Unknown: "0"
        };
    } else {
        document.getElementById('daily-total').textContent = dailyData.Total;
        document.getElementById('daily-passed').textContent = dailyData.Passed;
        document.getElementById('daily-failed').textContent = dailyData.Failed;
        document.getElementById('daily-skipped').textContent = dailyData.Skipped;
        
        chartData = dailyData;
    }
    
    // Create or update chart
    const ctx = document.getElementById('dailyChart').getContext('2d');
    
    if (dailyChart) dailyChart.destroy();
    
    dailyChart = new Chart(ctx, {
        type: 'doughnut',
        data: {
            labels: ['Passed', 'Failed', 'Broken', 'Skipped', 'Unknown'],
            datasets: [{
                data: [
                    parseInt(chartData.Passed) || 0,
                    parseInt(chartData.Failed) || 0,
                    parseInt(chartData.Broken) || 0,
                    parseInt(chartData.Skipped) || 0,
                    parseInt(chartData.Unknown) || 0
                ],
                backgroundColor: [
                    '#10B981',
                    '#EF4444',
                    '#F59E0B',
                    '#6366F1',
                    '#6B7280'
                ],
                borderWidth: 0
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            cutout: '70%',
            plugins: {
                legend: {
                    position: 'right',
                },
                tooltip: {
                    callbacks: {
                        label: function(context) {
                            const label = context.label || '';
                            const value = context.raw || 0;
                            const total = context.dataset.data.reduce((a, b) => a + b, 0);
                            const percentage = total ? Math.round((value / total) * 100) : 0;
                            return `${label}: ${value} (${percentage}%)`;
                        }
                    }
                }
            }
        }
    });
}

// Update weekly chart
function updateWeeklyChart(endDate, data) {
    const endDateStr = endDate.toISODate();
    const endDateObj = DateTime.fromISO(endDateStr, { zone: 'America/New_York' });
    const startDateObj = endDateObj.minus({ days: 6 });
    
    const weekData = data.filter(item => {
        const itemDate = DateTime.fromISO(item.Date, { zone: 'America/New_York' });
        return itemDate >= startDateObj && itemDate <= endDateObj;
    }).sort((a, b) => DateTime.fromISO(a.Date, { zone: 'America/New_York' }) - DateTime.fromISO(b.Date, { zone: 'America/New_York' }));
    
    // Calculate weekly stats
    const totalTests = weekData.reduce((sum, item) => sum + parseInt(item.Total), 0);
    const totalPassed = weekData.reduce((sum, item) => sum + parseInt(item.Passed), 0);
    const avgPassRate = totalTests ? Math.round((totalPassed / totalTests) * 100) : 0;
    
    document.getElementById('weekly-avg-pass').textContent = `${avgPassRate}%`;
    document.getElementById('weekly-total').textContent = totalTests;
    document.getElementById('weekly-stability').textContent = `${avgPassRate}%`;
    
    // Create or update chart
    const ctx = document.getElementById('weeklyChart').getContext('2d');
    
    if (weeklyChart) weeklyChart.destroy();
    
    weeklyChart = new Chart(ctx, {
        type: 'bar',
        data: {
            labels: weekData.map(item => formatDisplayDate(item.Date)),
            datasets: [
                {
                    label: 'Passed',
                    data: weekData.map(item => parseInt(item.Passed) || 0),
                    backgroundColor: '#10B981',
                    borderRadius: 4
                },
                {
                    label: 'Failed',
                    data: weekData.map(item => parseInt(item.Failed) || 0),
                    backgroundColor: '#EF4444',
                    borderRadius: 4
                },
                {
                    label: 'Broken',
                    data: weekData.map(item => parseInt(item.Broken) || 0),
                    backgroundColor: '#F59E0B',
                    borderRadius: 4
                },
                {
                    label: 'Skipped',
                    data: weekData.map(item => parseInt(item.Skipped) || 0),
                    backgroundColor: '#6366F1',
                    borderRadius: 4
                },
                {
                    label: 'Unknown',
                    data: weekData.map(item => parseInt(item.Unknown) || 0),
                    backgroundColor: '#6B7280',
                    borderRadius: 4
                }
            ]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            scales: {
                x: {
                    stacked: true,
                    grid: {
                        display: false
                    }
                },
                y: {
                    stacked: true,
                    beginAtZero: true,
                    ticks: {
                        precision: 0
                    }
                }
            },
            plugins: {
                legend: {
                    position: 'top',
                },
                tooltip: {
                    callbacks: {
                        afterLabel: function(context) {
                            const dataset = context.dataset;
                            const total = dataset.data.reduce((a, b) => a + b, 0);
                            const value = context.raw;
                            const percentage = total ? Math.round((value / total) * 100) : 0;
                            return `Percentage: ${percentage}%`;
                        }
                    }
                }
            }
        }
    });
}

// Update results table with pagination
function updateResultsTable() {
    if (!resultsTableBody) {
        console.error('Error: resultsTableBody element not found (ID: results-table-body)');
        return;
    }
    
    resultsTableBody.innerHTML = '';
    
    const startIndex = (currentPage - 1) * recordsPerPage;
    const endIndex = startIndex + recordsPerPage;
    const paginatedData = currentData.slice(startIndex, endIndex);
    
    paginatedData.forEach(item => {
        const row = document.createElement('tr');
        row.innerHTML = `
            <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-500">${formatDisplayDate(item.Date)}</td>
            <td class="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">${item.Total}</td>
            <td class="px-6 py-4 whitespace-nowrap text-sm text-green-600">${item.Passed}</td>
            <td class="px-6 py-4 whitespace-nowrap text-sm text-red-600">${item.Failed}</td>
            <td class="px-6 py-4 whitespace-nowrap text-sm text-yellow-600">${item.Broken}</td>
            <td class="px-6 py-4 whitespace-nowrap text-sm text-indigo-600">${item.Skipped}</td>
            <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-600">${item.Unknown}</td>
        `;
        resultsTableBody.appendChild(row);
    });
}

// Update pagination controls
function updatePaginationControls() {
    totalPages = Math.ceil(currentData.length / recordsPerPage);
    paginationInfo.textContent = `Page ${currentPage} of ${totalPages}`;
    
    prevPageButton.disabled = currentPage === 1;
    nextPageButton.disabled = currentPage === totalPages || totalPages === 0;
}

// Go to a specific page
function goToPage(page) {
    if (page >= 1 && page <= totalPages) {
        currentPage = page;
        updateResultsTable();
        updatePaginationControls();
    }
}

// Go to previous page
function goToPreviousPage() {
    goToPage(currentPage - 1);
}

// Go to next page
function goToNextPage() {
    goToPage(currentPage + 1);
}

// Helper functions for date formatting in EST
function formatDate(date) {
    return date.toISODate();
}

function formatDisplayDate(dateStr) {
    const dt = DateTime.fromISO(dateStr, { zone: 'America/New_York' });
    return dt.toFormat('ccc, LLL d');
}

// Chatbot functions
function toggleChatWindow() {
    chatWindow.classList.toggle('hidden');
    if (!chatWindow.classList.contains('hidden')) {
        chatInput.focus();
        // Add welcome message if chat is empty
        if (chatMessages.innerHTML === '') {
            const welcomeMessage = document.createElement('div');
            welcomeMessage.className = 'chat-message bot-message';
            welcomeMessage.textContent = `Welcome to ${currentTest.charAt(0).toUpperCase() + currentTest.slice(1)} Project`;
            chatMessages.appendChild(welcomeMessage);
        }
        // Scroll to the bottom
        chatMessages.scrollTop = chatMessages.scrollHeight;
    }
}

function sendMessage() {
    const message = chatInput.value.trim();
    if (!message) return;

    // Add user message
    const userMessage = document.createElement('div');
    userMessage.className = 'chat-message user-message';
    userMessage.textContent = message;
    chatMessages.appendChild(userMessage);

    // Process query and get bot response
    const botResponse = processUserQuery(message);
    const botMessage = document.createElement('div');
    botMessage.className = 'chat-message bot-message';
    botMessage.textContent = botResponse;
    chatMessages.appendChild(botMessage);

    // Clear input and scroll to bottom
    chatInput.value = '';
    chatMessages.scrollTop = chatMessages.scrollHeight;
}

// Process user query about JSON data
function processUserQuery(query) {
    console.log('Processing query:', query);

    if (!currentData || currentData.length === 0) {
        console.log('Error: currentData is empty or not loaded');
        return "No data available for this project.";
    }
    console.log('currentData available:', currentData.length, 'records');

    // Normalize query
    const lowerQuery = query.toLowerCase().replace(/['’]/g, '').replace(/\s+/g, ' ').trim();
    console.log('Normalized query:', lowerQuery);

    // Parse dates
    const dateRegex = /(\d{4}-\d{2}-\d{2})|(\d{2}-\d{2}-\d{4})|(\d{2}\/\d{2}\/\d{4})|(\w+\s+\d{1,2}(?:,\s+\d{4})?)|(\d{1,2}\s+\w+\s+\d{4})/gi;
    const dateMatches = [...lowerQuery.matchAll(dateRegex)];
    let dates = [];

    console.log('Date matches:', dateMatches.map(m => m[0]));
    dateMatches.forEach(match => {
        const dateStr = match[0];
        let targetDate;

        if (dateStr.match(/\d{4}-\d{2}-\d{2}/)) {
            targetDate = DateTime.fromISO(dateStr, { zone: 'America/New_York' });
            console.log('Parsed ISO date:', dateStr, '->', targetDate.isValid ? targetDate.toISODate() : 'Invalid');
        } else if (dateStr.match(/\d{2}-\d{2}-\d{4}/)) {
            targetDate = DateTime.fromFormat(dateStr, 'MM-dd-yyyy', { zone: 'America/New_York' });
            console.log('Parsed MM-DD-YYYY:', dateStr, '->', targetDate.isValid ? targetDate.toISODate() : 'Invalid');
        } else if (dateStr.match(/\d{2}\/\d{2}\/\d{4}/)) {
            targetDate = DateTime.fromFormat(dateStr, 'MM/dd/yyyy', { zone: 'America/New_York' });
            console.log('Parsed MM/DD/YYYY:', dateStr, '->', targetDate.isValid ? targetDate.toISODate() : 'Invalid');
        } else if (dateStr.match(/\w+\s+\d{1,2}(?:,\s+\d{4})?/) || dateStr.match(/\d{1,2}\s+\w+\s+\d{4}/)) {
            let format = dateStr.includes(',') ? 'MMMM d, yyyy' : 'MMMM d yyyy';
            if (!dateStr.includes('20')) {
                const currentYear = DateTime.now().setZone('America/New_York').year;
                targetDate = DateTime.fromFormat(`${dateStr}, ${currentYear}`, 'MMMM d, yyyy', { zone: 'America/New_York' });
                console.log('Parsed natural (no year):', dateStr, `+ ${currentYear} ->`, targetDate.isValid ? targetDate.toISODate() : 'Invalid');
            } else {
                targetDate = DateTime.fromFormat(dateStr, format, { zone: 'America/New_York' });
                console.log('Parsed natural:', dateStr, '->', targetDate.isValid ? targetDate.toISODate() : 'Invalid');
            }
        }

        if (targetDate && targetDate.isValid) {
            dates.push(targetDate);
            console.log('Added date:', targetDate.toISODate());
        } else {
            console.log('Skipped invalid date:', dateStr);
        }
    });

    // Deduplicate and sort dates
    dates = [...new Set(dates.map(d => d.toISODate()))].map(d => DateTime.fromISO(d, { zone: 'America/New_York' }));
    console.log('Final dates:', dates.map(d => d.toISODate()));

    // Define valid fields from JSON
    const validFields = ['total', 'passed', 'failed', 'broken', 'skipped', 'unknown'];
    const fieldAliases = {
        'total': ['total', 'tests', 'test'],
        'passed': ['passed', 'pass'],
        'failed': ['failed', 'fail', 'failure'],
        'broken': ['broken', 'broke'],
        'skipped': ['skipped', 'skip'],
        'unknown': ['unknown']
    };

    // Find matching field
    let targetField = null;
    for (const field of validFields) {
        if (fieldAliases[field].some(alias => lowerQuery.includes(alias))) {
            targetField = field;
            break;
        }
    }
    console.log('Target field:', targetField || 'None');

    // Handle single-date queries
    if (dates.length === 1) {
        const dateStr = dates[0].toISODate();
        console.log('Checking single-date query for:', dateStr);
        const dailyData = currentData.find(item => item.Date === dateStr);
        console.log('Data found:', !!dailyData, dailyData ? dailyData : 'None');

        if (!dailyData) {
            console.log('No data for date:', dateStr);
            return `No data available for ${dates[0].toFormat('MMMM d, yyyy')}.`;
        }

        if (targetField) {
            console.log(`Matched: ${targetField} query`);
            const value = dailyData[targetField.charAt(0).toUpperCase() + targetField.slice(1)];
            return `The number of ${targetField} tests on ${dates[0].toFormat('MMMM d, yyyy')} is ${value}.`;
        }

        if (lowerQuery.includes('compare') && (lowerQuery.includes('pass') || lowerQuery.includes('passed')) && (lowerQuery.includes('fail') || lowerQuery.includes('failed'))) {
            console.log('Matched: Compare pass/fail rate');
            const total = parseInt(dailyData.Total) || 1;
            const passRate = Math.round((parseInt(dailyData.Passed) / total) * 100);
            const failRate = Math.round((parseInt(dailyData.Failed) / total) * 100);
            return `On ${dates[0].toFormat('MMMM d, yyyy')}: Pass rate is ${passRate}%, Fail rate is ${failRate}%.`;
        }

        console.log('Matched: General single-date');
        return `On ${dates[0].toFormat('MMMM d, yyyy')}: Total: ${dailyData.Total}, Passed: ${dailyData.Passed}, Failed: ${dailyData.Failed}, Broken: ${dailyData.Broken}, Skipped: ${dailyData.Skipped}, Unknown: ${dailyData.Unknown}.`;
    }

    // Handle two-date comparison queries
    if (dates.length >= 2 && lowerQuery.includes('compare')) {
        const date1Str = dates[0].toISODate();
        const date2Str = dates[1].toISODate();
        console.log('Checking two-date query - Date1:', date1Str, 'Date2:', date2Str);
        const data1 = currentData.find(item => item.Date === date1Str);
        const data2 = currentData.find(item => item.Date === date2Str);
        console.log('Data found - Date1:', !!data1, 'Date2:', !!data2);

        if (!data1 && !data2) {
            console.log('No data for both dates');
            return `No data available for ${dates[0].toFormat('MMMM d, yyyy')} or ${dates[1].toFormat('MMMM d, yyyy')}.`;
        }
        if (!data1) {
            console.log('No data for date1');
            return `No data available for ${dates[0].toFormat('MMMM d, yyyy')}.`;
        }
        if (!data2) {
            console.log('No data for date2');
            return `No data available for ${dates[1].toFormat('MMMM d, yyyy')}.`;
        }

        if (targetField && fieldAliases[targetField].some(alias => lowerQuery.includes(alias))) {
            console.log(`Matched: Compare ${targetField}`);
            const fieldKey = targetField.charAt(0).toUpperCase() + targetField.slice(1);
            return `${fieldKey} on ${dates[0].toFormat('MMMM d, yyyy')}: ${data1[fieldKey]}; ${fieldKey} on ${dates[1].toFormat('MMMM d, yyyy')}: ${data2[fieldKey]}.`;
        }

        console.log('Matched: General comparison');
        return `On ${dates[0].toFormat('MMMM d, yyyy')}: Passed: ${data1.Passed}, Failed: ${data1.Failed}. On ${dates[1].toFormat('MMMM d, yyyy')}: Passed: ${data2.Passed}, Failed: ${data2.Failed}.`;
    }

    // Handle weekly queries
    if ((lowerQuery.includes('week') || lowerQuery.includes('weekly')) && dates.length >= 1) {
        const endDate = dates[0];
        const startDate = endDate.minus({ days: 6 });
        console.log('Checking weekly query - Start:', startDate.toISODate(), 'End:', endDate.toISODate());

        const weekData = currentData.filter(item => {
            const itemDate = DateTime.fromISO(item.Date, { zone: 'America/New_York' });
            return itemDate >= startDate && itemDate <= endDate;
        });
        console.log('Weekly data found:', weekData.length, 'records');

        if (weekData.length === 0) {
            console.log('No weekly data');
            return `No data available for the week of ${endDate.toFormat('MMMM d, yyyy')}.`;
        }

        const totalTests = weekData.reduce((sum, item) => sum + parseInt(item.Total), 0);
        const totalPassed = weekData.reduce((sum, item) => sum + parseInt(item.Passed), 0);
        const avgPassRate = totalTests ? Math.round((totalPassed / totalTests) * 100) : 0;

        if (lowerQuery.includes('pass') || lowerQuery.includes('passed') || lowerQuery.includes('rate')) {
            console.log('Matched: Weekly pass rate');
            return `The average pass rate for the week of ${endDate.toFormat('MMMM d, yyyy')} is ${avgPassRate}%.`;
        }
        if (lowerQuery.includes('total') || lowerQuery.includes('test') || lowerQuery.includes('tests')) {
            console.log('Matched: Weekly total tests');
            return `The total number of tests for the week of ${endDate.toFormat('MMMM d, yyyy')} is ${totalTests}.`;
        }
        console.log('Matched: Weekly general');
        return `For the week of ${endDate.toFormat('MMMM d, yyyy')}: Total tests: ${totalTests}, Average pass rate: ${avgPassRate}%.`;
    }

    console.log('Error: Query not recognized');
    return "Sorry, I didn't understand your question. Please ask about the project data, e.g., 'What’s the total tests on 2025-04-21?' or 'Compare the passing between 2025-04-21 and 2025-04-22?'";
}

// Initialize today's date for date inputs
document.addEventListener('DOMContentLoaded', function() {
    const today = DateTime.now().setZone('America/New_York');
    dailyDateInput.value = today.toISODate();
    weeklyDateInput.value = today.toISODate();
    chatbotLogo.classList.add('hidden'); // Hide chatbot logo on login page
});
