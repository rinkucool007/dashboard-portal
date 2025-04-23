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

// Login handler
function handleLogin() {
    const username = document.getElementById('username').value;
    const password = document.getElementById('password').value;
    
    if (username === 'admin' && password === 'password') {
        loginPage.classList.add('hidden');
        dashboardPage.classList.remove('hidden');
    } else {
        alert('Invalid credentials. Please try again.');
    }
}

// Logout handler
function logout() {
    dashboardPage.classList.add('hidden');
    testPage.classList.add('hidden');
    loginPage.classList.remove('hidden');
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
    
    // Load data
    try {
        const data = await loadTestData(testName);
        currentData = data;
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
        // No matching date found
        document.getElementById('daily-total').textContent = 'NA';
        document.getElementById('daily-passed').textContent = 'NA';
        document.getElementById('daily-failed').textContent = 'NA';
        document.getElementById('daily-skipped').textContent = 'NA';
        
        // Set chart data to zeros
        var chartData = {
            Total: "0", Passed: "0", Failed: "0", Skipped: "0", Broken: "0", Unknown: "0"
        };
    } else {
        // Matching date found
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

// Initialize today's date for date inputs
document.addEventListener('DOMContentLoaded', function() {
    const today = DateTime.now().setZone('America/New_York');
    dailyDateInput.value = today.toISODate();
    weeklyDateInput.value = today.toISODate();
});