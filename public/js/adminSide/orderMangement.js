// Initialize Flatpickr for date inputs
flatpickr("#startDate", {
    dateFormat: "d/m/Y",
    allowInput: true,
    onChange: function(selectedDates, dateStr) {
        if (!validateDate(dateStr)) {
            document.getElementById('startDateError').style.display = 'block';
        } else {
            document.getElementById('startDateError').style.display = 'none';
        }
    }
});

flatpickr("#endDate", {
    dateFormat: "d/m/Y",
    allowInput: true,
    onChange: function(selectedDates, dateStr) {
        if (!validateDate(dateStr)) {
            document.getElementById('endDateError').style.display = 'block';
        } else {
            document.getElementById('endDateError').style.display = 'none';
        }
    }
});

// Validate date format (DD/MM/YYYY)
function validateDate(dateStr) {
    const regex = /^(\d{2})\/(\d{2})\/(\d{4})$/;
    if (!regex.test(dateStr)) return false;
    const [day, month, year] = dateStr.split('/').map(Number);
    const date = new Date(year, month - 1, day);
    return date.getDate() === day && date.getMonth() === month - 1 && date.getFullYear() === year;
}

// Convert DD/MM/YYYY to YYYY-MM-DD for API requests
function toISODate(dateStr) {
    const [day, month, year] = dateStr.split('/').map(Number);
    return `${year}-${month.toString().padStart(2, '0')}-${day.toString().padStart(2, '0')}`;
}

// Validate date range (start <= end, max 90 days)
function validateDateRange(startDate, endDate) {
    if (!startDate || !endDate) return false;
    if (!validateDate(startDate) || !validateDate(endDate)) return false;
    const start = new Date(startDate.split('/').reverse().join('-'));
    const end = new Date(endDate.split('/').reverse().join('-'));
    const daysDiff = (end - start) / (1000 * 60 * 60 * 24);
    return start <= end && daysDiff <= 90;
}

// Update dashboard with filtered data
function updateDashboard(data) {
    // Update summary stats
    document.getElementById('totalCustomers').textContent = data.count || 0;
    document.getElementById('totalRevenue').textContent = `₹${(data.totalRevenue || 0).toFixed(2)}`;
    document.getElementById('totalOrders').textContent = data.orderCount || 0;
    document.getElementById('totalProducts').textContent = data.productCount || 0;

    // Update Revenue Chart
    if (revenueChartInstance) revenueChartInstance.destroy();
    const revenueCtx = document.getElementById('revenueChart').getContext('2d');

    // Determine if data is daily (YYYY-MM-DD) or monthly (YYYY-MM)
    const isDailyData = data.timePeriod === 'custom' || data.timePeriod === 'today' || data.timePeriod === 'yesterday';
    
    // Format and sort revenue data
    const sortedRevenueData = (data.revenueData || [])
        .map(item => {
            let label;
            if (isDailyData) {
                // Format daily data as DD/MM/YYYY
                const [year, month, day] = item._id.split('-').map(Number);
                label = new Date(year, month - 1, day).toLocaleDateString('en-GB', {
                    day: '2-digit',
                    month: '2-digit',
                    year: 'numeric'
                });
            } else {
                // Format monthly data as Month YYYY
                const [year, month] = item._id.split('-').map(Number);
                label = new Date(year, month - 1, 1).toLocaleDateString('en-GB', {
                    month: 'long',
                    year: 'numeric'
                });
            }
            return { ...item, label };
        })
        .sort((a, b) => a._id.localeCompare(b._id));

    // Create line chart with heartbeat-like design
    revenueChartInstance = new Chart(revenueCtx, {
        type: 'line',
        data: {
            labels: sortedRevenueData.map(item => item.label),
            datasets: [
                {
                    label: 'Revenue',
                    data: sortedRevenueData.map(item => item.revenue || 0),
                    borderColor: chartColors.primary, // #8b5cf6
                    backgroundColor: chartColors.primary + '20',
                    tension: 0.7, // High tension for wavy, heartbeat-like effect
                    fill: true,
                    borderWidth: 5, // Thicker line for prominence
                    pointBackgroundColor: chartColors.primary,
                    pointBorderColor: '#fff',
                    pointBorderWidth: 3,
                    pointRadius: sortedRevenueData.map((_, i) => (i % 2 === 0 ? 8 : 6)), // Alternating sizes for pulse effect
                    pointHoverRadius: 12, // Larger hover effect
                },
                {
                    label: 'Orders',
                    data: sortedRevenueData.map(item => item.orderCount || 0),
                    borderColor: chartColors.success, // #10b981
                    backgroundColor: chartColors.success + '20',
                    tension: 0.7, // High tension for wavy effect
                    fill: true,
                    borderWidth: 5,
                    pointBackgroundColor: chartColors.success,
                    pointBorderColor: '#fff',
                    pointBorderWidth: 3,
                    pointRadius: sortedRevenueData.map((_, i) => (i % 2 === 0 ? 8 : 6)),
                    pointHoverRadius: 12,
                },
            ],
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: { display: false }, // Hide default legend (custom legend in HTML)
                tooltip: {
                    callbacks: {
                        label: function (context) {
                            const label = context.dataset.label || '';
                            const value = context.parsed.y;
                            return `${label}: ${label === 'Revenue' ? '₹' + value.toFixed(2) : value}`;
                        },
                    },
                },
            },
            scales: {
                x: {
                    grid: { display: false },
                    ticks: {
                        color: '#64748b',
                        maxRotation: sortedRevenueData.length > 10 ? 45 : 0, // Rotate labels for long ranges
                        minRotation: sortedRevenueData.length > 10 ? 45 : 0,
                        maxTicksLimit: 12, // Limit ticks for readability
                    },
                },
                y: {
                    grid: { color: '#f1f5f9' },
                    ticks: {
                        color: '#64748b',
                        callback: function (value) {
                            return this.getLabelForValue(value).includes('Revenue') ? '₹' + value : value;
                        },
                    },
                },
            },
            elements: {
                point: { hoverRadius: 12 },
                line: {
                    animation: {
                        duration: 1200, // Smooth animation for loading
                        easing: 'easeInOutSine', // Sine easing for heartbeat-like flow
                    },
                },
            },
            animation: {
                onComplete: function () {
                    // Apply pulsing effect to points
                    this.data.datasets.forEach(dataset => {
                        dataset.pointStyle = 'circle';
                        dataset.pointRadius = dataset.data.map((_, i) => (i % 2 === 0 ? 8 : 6));
                    });
                    this.update();
                },
            },
        },
    });

    // ... rest of the function (orderStatusChart, paymentChart, etc.) remains unchanged ...

    // Update Order Status Chart
    if (orderStatusChartInstance) orderStatusChartInstance.destroy();
    const orderStatusCtx = document.getElementById('orderStatusChart').getContext('2d');
    orderStatusChartInstance = new Chart(orderStatusCtx, {
        type: 'doughnut',
        data: {
            labels: data.orderStatusData.map(item => item._id),
            datasets: [
                {
                    data: data.orderStatusData.map(item => item.count),
                    backgroundColor: [
                        chartColors.orange,
                        chartColors.blue,
                        chartColors.green,
                        chartColors.teal,
                        chartColors.red,
                        chartColors.yellow,
                        chartColors.gray,
                    ].slice(0, data.orderStatusData.length),
                    borderWidth: 0,
                    cutout: '70%',
                },
            ],
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: { legend: { display: false } },
        },
    });

    // Update Order Status Legend
    const orderStatusLegend = document.getElementById('orderStatusLegend');
    orderStatusLegend.innerHTML = data.orderStatusData
        .map(
            (status, index) => `
            <div class="d-flex justify-content-between align-items-center mb-2">
                <div class="d-flex align-items-center">
                    <div class="legend-dot me-2" style="background-color: ${
                        ['#FF9500', '#007AFF', '#34C759', '#00C896', '#FF3B30', '#FFCC02', '#8E8E93'][index]
                    };"></div>
                    <small>${status._id}</small>
                </div>
                <small class="fw-bold">${status.count}</small>
            </div>
        `
        )
        .join('');

    // Update Payment Methods Chart
    if (paymentChartInstance) paymentChartInstance.destroy();
    const paymentCtx = document.getElementById('paymentChart').getContext('2d');
    paymentChartInstance = new Chart(paymentCtx, {
        type: 'doughnut',
        data: {
            labels: data.paymentMethodData.map(item => item._id),
            datasets: [
                {
                    data: data.paymentMethodData.map(item => item.count),
                    backgroundColor: [chartColors.primary, chartColors.success, chartColors.warning].slice(
                        0,
                        data.paymentMethodData.length
                    ),
                    borderWidth: 0,
                    cutout: '70%',
                },
            ],
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: { legend: { display: false } },
        },
    });

    // Update Payment Methods Legend
    const paymentMethodLegend = document.getElementById('paymentMethodLegend');
    const totalPayments = data.paymentMethodData.reduce((sum, m) => sum + m.count, 0);
    paymentMethodLegend.innerHTML = data.paymentMethodData
        .map(
            (method, index) => `
            <div class="d-flex justify-content-between align-items-center mb-2">
                <div class="d-flex align-items-center">
                    <div class="legend-dot me-2" style="background-color: ${
                        ['#8B5CF6', '#10B981', '#F59E0B'][index]
                    };"></div>
                    <small>${method._id}</small>
                </div>
                <small class="fw-bold">${totalPayments ? ((method.count / totalPayments) * 100).toFixed(0) : 0}%</small>
            </div>
        `
        )
        .join('');

    // Update Top Categories Chart
    if (categoriesChartInstance) categoriesChartInstance.destroy();
    const categoriesCtx = document.getElementById('categoriesChart').getContext('2d');
    categoriesChartInstance = new Chart(categoriesCtx, {
        type: 'bar',
        data: {
            labels: data.topCategories.map(item => item.categoryName),
            datasets: [
                {
                    data: data.topCategories.map(item => item.totalSales),
                    backgroundColor: chartColors.primary,
                    borderRadius: 6,
                    borderSkipped: false,
                },
            ],
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: { legend: { display: false } },
            scales: {
                x: { grid: { display: false }, ticks: { color: '#64748b' } },
                y: { grid: { color: '#f1f5f9' }, ticks: { color: '#64748b' } },
            },
        },
    });

    // Update Top Brands Chart
    if (brandsChartInstance) brandsChartInstance.destroy();
    const brandsCtx = document.getElementById('brandsChart').getContext('2d');
    brandsChartInstance = new Chart(brandsCtx, {
        type: 'bar',
        data: {
            labels: data.topBrands.map(item => item.brandName),
            datasets: [
                {
                    data: data.topBrands.map(item => item.totalSales),
                    backgroundColor: chartColors.primary,
                    borderRadius: 6,
                    borderSkipped: false,
                },
            ],
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: { legend: { display: false } },
            scales: {
                x: { grid: { display: false }, ticks: { color: '#64748b' } },
                y: { grid: { color: '#f1f5f9' }, ticks: { color: '#64748b' } },
            },
        },
    });

    // Update Top Selling Products Table
    const topSellingProductsTable = document.querySelector('#topSellingProductsTable tbody');
    topSellingProductsTable.innerHTML = data.topSellingProducts
        .map(
            product => `
            <tr>
                <td>${product.productName || 'N/A'}</td>
                <td class="fw-bold">${product.totalQuantity || 0}</td>
                <td class="fw-bold">₹${(product.totalSales || 0).toFixed(2)}</td>
            </tr>
        `
        )
        .join('');

    // Update Recent Orders Table
    const recentOrdersTable = document.querySelector('#recentOrdersTable tbody');
    recentOrdersTable.innerHTML = data.recentOrders
        .map(
            order => `
            <tr class="table-row">
                <td class="table-cell">
                    <span class="order-id">${order.orderId || 'N/A'}</span>
                </td>
                <td class="table-cell">
                    <span class="customer-name">${order.userId?.name || 'Unknown'}</span>
                </td>
                <td class="table-cell">${new Date(order.createdAt).toLocaleDateString('en-GB')}</td>
                <td class="table-cell">
                    <span class="amount">₹${(order.finalAmount || 0).toFixed(2)}</span>
                </td>
                <td class="table-cell text-center">
                    <span class="payment-method ${order.paymentMethod?.toLowerCase().replace(' ', '-') || 'unknown'}">
                        ${order.paymentMethod || 'Unknown'}
                    </span>
                </td>
                <td class="table-cell text-center">
                    <span class="status ${order.orderedItems[0]?.status?.toLowerCase().replace(' ', '-') || 'pending'}">
                        ${order.orderedItems[0]?.status || 'Pending'}
                    </span>
                </td>
                <td class="table-cell text-center">
                    <button class="view-btn" onclick="viewOrderDetails('${order._id}')">VIEW</button>
                </td>
            </tr>
        `
        )
        .join('');

    // Update Pagination
    const pagination = document.getElementById('pagination');
    const timePeriod = document.getElementById('timePeriod').value;
    const orderStatus = document.getElementById('orderStatus').value;
    const startDate = document.getElementById('startDate').value;
    const endDate = document.getElementById('endDate').value;

    let paginationParams = `timePeriod=${encodeURIComponent(timePeriod)}&status=${encodeURIComponent(orderStatus)}`;
    if (timePeriod === 'custom' && startDate && endDate) {
        paginationParams += `&startDate=${encodeURIComponent(toISODate(startDate))}&endDate=${encodeURIComponent(toISODate(endDate))}`;
    }

    pagination.innerHTML = `
        <li class="page-item ${data.currentPage === 1 ? 'disabled' : ''}">
            <a class="page-link" href="?page=${data.currentPage - 1}&${paginationParams}">
                <i class="fas fa-chevron-left"></i>
            </a>
        </li>
        ${Array.from({ length: data.totalPages }, (_, i) => i + 1)
            .map(
                i => `
                <li class="page-item ${data.currentPage === i ? 'active' : ''}">
                    <a class="page-link" href="?page=${i}&${paginationParams}">${i}</a>
                </li>
            `
            )
            .join('')}
        <li class="page-item ${data.currentPage === data.totalPages ? 'disabled' : ''}">
            <a class="page-link" href="?page=${data.currentPage + 1}&${paginationParams}">
                <i class="fas fa-chevron-right"></i>
            </a>
        </li>
    `;
}

// Handle custom date fields visibility
document.getElementById('timePeriod').addEventListener('change', function () {
    const customDateFields = document.getElementById('customDateFields');
    if (this.value === 'custom') {
        customDateFields.classList.add('active');
    } else {
        customDateFields.classList.remove('active');
        document.getElementById('startDateError').style.display = 'none';
        document.getElementById('endDateError').style.display = 'none';
        document.getElementById('startDate').value = '';
        document.getElementById('endDate').value = '';
    }
});

// Handle Apply Filters button
document.getElementById('applyFilters').addEventListener('click', function () {
    const timePeriod = document.getElementById('timePeriod').value;
    const orderStatus = document.getElementById('orderStatus').value;
    const startDate = document.getElementById('startDate').value;
    const endDate = document.getElementById('endDate').value;

    // Validate custom date range
    if (timePeriod === 'custom') {
        if (!validateDateRange(startDate, endDate)) {
            document.getElementById('startDateError').style.display = 'block';
            document.getElementById('startDateError').textContent = 'Invalid date range. Ensure start date is before or equal to end date and range is within 90 days.';
            document.getElementById('endDateError').style.display = 'block';
            return;
        }
        document.getElementById('startDateError').style.display = 'none';
        document.getElementById('endDateError').style.display = 'none';
    }

    // Show loading state
    const applyButton = document.getElementById('applyFilters');
    applyButton.disabled = true;
    applyButton.textContent = 'Loading...';

    // Prepare query parameters
    const params = new URLSearchParams();
    params.append('timePeriod', timePeriod);
    params.append('status', orderStatus);
    if (timePeriod === 'custom' && startDate && endDate) {
        params.append('startDate', toISODate(startDate));
        params.append('endDate', toISODate(endDate));
    }

    // Fetch filtered data
    fetch(`/admin/dashboard?${params.toString()}`, {
        method: 'GET',
        headers: {
            'Content-Type': 'application/json',
            'X-Requested-With': 'XMLHttpRequest',
        },
    })
        .then(response => response.json())
        .then(data => {
            if (data.success) {
                updateDashboard(data);
            } else {
                alert('Error fetching filtered data: ' + (data.message || 'Unknown error'));
            }
        })
        .catch(error => {
            console.error('Error:', error);
            alert('An error occurred while applying filters.');
        })
        .finally(() => {
            applyButton.disabled = false;
            applyButton.textContent = 'Apply Filters';
        });
});

// Handle Clear Filters button
document.getElementById('clearFilters').addEventListener('click', function () {
    // Reset filter inputs
    document.getElementById('timePeriod').value = 'all';
    document.getElementById('orderStatus').value = 'all';
    document.getElementById('startDate').value = '';
    document.getElementById('endDate').value = '';
    document.getElementById('customDateFields').classList.remove('active');
    document.getElementById('startDateError').style.display = 'none';
    document.getElementById('endDateError').style.display = 'none';

    // Show loading state
    const applyButton = document.getElementById('applyFilters');
    applyButton.disabled = true;
    applyButton.textContent = 'Loading...';

    // Fetch default data
    fetch('/admin/dashboard?timePeriod=all&status=all', {
        method: 'GET',
        headers: {
            'Content-Type': 'application/json',
            'X-Requested-With': 'XMLHttpRequest',
        },
    })
        .then(response => response.json())
        .then(data => {
            if (data.success) {
                updateDashboard(data);
            } else {
                alert('Error resetting filters: ' + (data.message || 'Unknown error'));
            }
        })
        .catch(error => {
            console.error('Error:', error);
            alert('An error occurred while resetting filters.');
        })
        .finally(() => {
            applyButton.disabled = false;
            applyButton.textContent = 'Apply Filters';
        });
});

// Handle pagination clicks
document.getElementById('pagination').addEventListener('click', function (e) {
    e.preventDefault();
    const target = e.target.closest('.page-link');
    if (!target || target.parentElement.classList.contains('disabled')) return;

    const url = new URL(target.href);
    const params = new URLSearchParams(url.search);

    // Ensure all filter parameters are included
    const timePeriod = document.getElementById('timePeriod').value;
    const orderStatus = document.getElementById('orderStatus').value;
    const startDate = document.getElementById('startDate').value;
    const endDate = document.getElementById('endDate').value;

    params.set('timePeriod', timePeriod);
    params.set('status', orderStatus);
    if (timePeriod === 'custom') {
        if (!validateDateRange(startDate, endDate)) {
            alert('Please enter a valid date range (within 90 days).');
            return;
        }
        params.set('startDate', toISODate(startDate));
        params.set('endDate', toISODate(endDate));
    }

    // Show loading state
    const applyButton = document.getElementById('applyFilters');
    applyButton.disabled = true;
    applyButton.textContent = 'Loading...';

    // Fetch paginated data
    fetch(`/admin/dashboard?${params.toString()}`, {
        method: 'GET',
        headers: {
            'Content-Type': 'application/json',
            'X-Requested-With': 'XMLHttpRequest',
        },
    })
        .then(response => response.json())
        .then(data => {
            if (data.success) {
                updateDashboard(data);
            } else {
                alert('Error fetching paginated data: ' + (data.message || 'Unknown error'));
            }
        })
        .catch(error => {
            console.error('Error:', error);
            alert('An error occurred while loading the page.');
        })
        .finally(() => {
            applyButton.disabled = false;
            applyButton.textContent = 'Apply Filters';
        });
});

// View Order Details function
function viewOrderDetails(orderId) {
    window.location.href = `/admin/order-view/${orderId}`;
}