// Initialize Flatpickr for date inputs with proper configuration
  flatpickr("#fromDate", {
    dateFormat: "d/m/Y",
    maxDate: "today",
    onChange: function (selectedDates, dateStr) {
      if (selectedDates[0]) {
        const toDateInput = document.getElementById('toDate');
        if (toDateInput._flatpickr) {
          toDateInput._flatpickr.set('minDate', selectedDates[0]);
        }
      }
      triggerSearch();
    },
  });

  flatpickr("#toDate", {
    dateFormat: "d/m/Y",
    maxDate: "today",
    onChange: function (selectedDates, dateStr) {
      if (selectedDates[0]) {
        const fromDateInput = document.getElementById('fromDate');
        if (fromDateInput._flatpickr) {
          fromDateInput._flatpickr.set('maxDate', selectedDates[0]);
        }
      }
      triggerSearch();
    },
  });


  function debounce(func, delay) {
    let timeoutId;
    return function (...args) {
      clearTimeout(timeoutId);
      timeoutId = setTimeout(() => func.apply(this, args), delay);
    };
  }

  function formatDateForBackend(dateStr) {
    if (!dateStr) return '';
    const [day, month, year] = dateStr.split('/');
    if (!day || !month || !year) return '';
    return `${year}-${month.padStart(2, '0')}-${day.padStart(2, '0')}`;
  }


  let totalPages = parseInt('<%= totalPages %>') || 1;

  // Function to get all search parameters
  function getSearchParams() {
    const searchInput = document.getElementById('searchInput').value.trim();
    const fromDate = formatDateForBackend(document.getElementById('fromDate').value);
    const toDate = formatDateForBackend(document.getElementById('toDate').value);
    const status = document.getElementById('statusFilter').value;
    const paymentMethod = document.getElementById('paymentMethodFilter').value;


    return {
      search: searchInput,
      fromDate,
      toDate,
      status,
      paymentMethod,
      page: 1
    };
  }

  // Function to show loading state
  function showLoading() {
    const tbody = document.querySelector('.orders-table tbody');
    tbody.innerHTML = `
      <tr class="table-row">
        <td colspan="8" class="table-cell text-center">
          <div class="d-flex justify-content-center align-items-center">
            <div class="spinner-border text-primary" role="status">
              <span class="visually-hidden">Loading...</span>
            </div>
          </div>
        </td>
      </tr>
    `;
  }

  // Function to show error state
  function showError(message) {
    const tbody = document.querySelector('.orders-table tbody');
    const errorRow = document.createElement('tr');
    errorRow.innerHTML = `
      <td colspan="8" class="text-center py-4 text-red-500">
        ${message}
      </td>
    `;
    tbody.innerHTML = '';
    tbody.appendChild(errorRow);
  }

  // Function to show no results state
  function showNoResults() {
    const tbody = document.querySelector('.orders-table tbody');
    tbody.innerHTML = `
      <tr class="table-row">
        <td colspan="8" class="table-cell text-center">
          <div class="text-muted">
            <i class="fas fa-search fa-2x mb-2"></i>
            <p>No orders found matching your search criteria</p>
          </div>
        </td>
      </tr>
    `;
  }

  const triggerSearch = debounce(function () {
    const params = getSearchParams();
    const queryParams = new URLSearchParams(params);

    console.log('Search URL:', `/admin/order-management?${queryParams.toString()}`);

    showLoading();

    fetch(`/admin/order-management?${queryParams.toString()}`, {
      method: 'GET',
      headers: {
        'Accept': 'application/json',
        'X-Requested-With': 'XMLHttpRequest',
        'X-CSRF-Token': document.querySelector('meta[name="csrf-token"]')?.content || ''
      },
      credentials: 'include'
    })
    .then(response => {
      if (!response.ok) {
        throw new Error(`HTTP error! Status: ${response.status}`);
      }
      return response.json();
    })
    .then(data => {
      console.log('Search results:', data);
      
      if (data.error) {
        throw new Error(data.message || 'An error occurred while searching');
      }
      
      totalPages = data.totalPages;
      if (data.orders && data.orders.length > 0) {
        updateTable(data.orders);
        updatePagination(data.currentPage, data.totalPages, queryParams);
      } else {
        showNoResults();
      }
    })
    .catch(error => {
      console.error('Search error:', error);
      showError(error.message || 'An error occurred while searching. Please try again.');
    });
  }, 400);

  // Update the orders table with new data
  function updateTable(orders) {
    const tbody = document.querySelector('.orders-table tbody');
    tbody.innerHTML = '';

    orders.forEach((order) => {
      if (!order) return;
      
      const row = document.createElement('tr');
      row.classList.add('table-row');

      // Get the main status from orderedItems
      let mainStatus = 'Pending';
      if (order.orderedItems && order.orderedItems.length > 0) {
        const statuses = order.orderedItems.map(item => item.status);
        if (statuses.includes('Cancelled')) mainStatus = 'Cancelled';
        else if (statuses.includes('Pending')) mainStatus = 'Pending';
        else if(statuses.includes('Shipped')) mainStatus = 'Shipped'
        else if (statuses.includes('Return Request')) mainStatus = 'Return Request';
        else if (statuses.includes('Returned')) mainStatus = 'Returned';
        else if (statuses.every(status => status === 'Delivered')) mainStatus = 'Delivered';
      }

      const statusClass = 
        mainStatus === 'Pending' ? 'bg-warning' : 
        mainStatus === 'Cancelled' ? 'bg-danger' : 
        mainStatus === 'Shipped'  ? 'bg-info':
        mainStatus === 'Delivered' ? 'bg-success' : 
        mainStatus === 'Return Request' ? 'bg-warning' :
        mainStatus === 'Returned' ? 'bg-secondary' :
        'bg-info';

      row.innerHTML = `
        <td class="table-cell">
          <div class="product-image">
            <% if (orders.orderedItems && order.orderedItems.length > 0 && order.orderedItems[0].product && order.orderedItems[0].product.images && order.orderedItems[0].product.images.length > 0) { %>
                <img src="/<%= order.orderedItems[0].product.images[0] %>" alt="Product Image" style="width: 50px; height: 50px; object-fit: cover; border-radius: 8px;">
            <% } else { %>
                📦
            <% } %>
          </div>
        </td>
        <td class="table-cell">
          <span class="order-id">${order.orderId || 'N/A'}</span>
        </td>
        <td class="table-cell">
          <span class="customer-name">${order.shippingAddress?.name || 'N/A'}</span>
        </td>
        <td class="table-cell">${order.createdAt ? new Date(order.createdAt).toDateString() : 'N/A'}</td>
        <td class="table-cell">
          <span class="amount">₹${order.totalPrice || '0'}</span>
        </td>
        <td class="table-cell">
          <span class="payment-method ${(order.paymentMethod || 'card').toLowerCase()}">${order.paymentMethod || 'N/A'}</span>
        </td>
        <td class="table-cell">
          <div class="product-list">
            ${(order.orderedItems || []).map(item => `
              <div class="mb-1">
                <span class="d-block fw-bold">${item.product?.name || ''}</span>
              </div>
            `).join('')}
          </div>
          <div class="status-display mt-2">
            <span class="status badge ${statusClass}">${mainStatus}</span>
          </div>
        </td>
        <td class="table-cell">
          <button class="view-btn" onclick="viewOrderDetails('${order._id}')">VIEW</button>
        </td>
      `;
      tbody.appendChild(row);
    });
  }

  // Update pagination controls
  function updatePagination(currentPage, totalPagesLocal, queryParams) {
    const pagination = document.querySelector('.pagination');
    pagination.innerHTML = '';

    const prevLi = document.createElement('li');
    prevLi.classList.add('page-item');
    if (currentPage === 1) prevLi.classList.add('disabled');
    prevLi.innerHTML = `
      <a class="page-link" href="#" aria-label="Previous" onclick="changePage(${currentPage - 1}, event)">
        <i class="fas fa-chevron-left"></i>
      </a>
    `;
    pagination.appendChild(prevLi);

    let startPage = Math.max(1, currentPage - 2);
    let endPage = Math.min(totalPagesLocal, startPage + 4);
    if (endPage - startPage < 4 && totalPagesLocal > 5) {
      startPage = Math.max(1, endPage - 4);
    }

    for (let i = startPage; i <= endPage; i++) {
      const pageLi = document.createElement('li');
      pageLi.classList.add('page-item');
      if (i === currentPage) pageLi.classList.add('active');
      pageLi.innerHTML = `
        <a class="page-link" href="#" onclick="changePage(${i}, event)">${i}</a>
      `;
      pagination.appendChild(pageLi);
    }

    const nextLi = document.createElement('li');
    nextLi.classList.add('page-item');
    if (currentPage === totalPagesLocal) nextLi.classList.add('disabled');
    nextLi.innerHTML = `
      <a class="page-link" href="#" aria-label="Next" onclick="changePage(${currentPage + 1}, event)">
        <i class="fas fa-chevron-right"></i>
      </a>
    `;
    pagination.appendChild(nextLi);
  }

  // Change page
  function changePage(page, event) {
    event.preventDefault();
    if (page < 1 || page > totalPages) return;

    const params = getSearchParams();
    params.page = page;
    const queryParams = new URLSearchParams(params);

    showLoading();

    fetch(`/admin/order-management?${queryParams.toString()}`, {
      method: 'GET',
      headers: {
        'Accept': 'application/json',
        'X-Requested-With': 'XMLHttpRequest',
        'X-CSRF-Token': document.querySelector('meta[name="csrf-token"]')?.content || ''
      },
      credentials: 'include'
    })
    .then(response => {
      if (!response.ok) {
        throw new Error(`HTTP error! Status: ${response.status}`);
      }
      return response.json();
    })
    .then(data => {
      if (data.error) {
        throw new Error(data.message || 'An error occurred while loading the page');
      }
      totalPages = data.totalPages;
      updateTable(data.orders);
      updatePagination(data.currentPage, data.totalPages, queryParams);
    })
    .catch(error => {
      console.error('Page change error:', error);
      showError(error.message || 'An error occurred while loading the page. Please try again.');
    });
  }

  // Clear search
  function clearSearch() {
    document.getElementById('searchInput').value = '';
    document.getElementById('fromDate').value = '';
    document.getElementById('toDate').value = '';
    document.getElementById('statusFilter').value = 'All Orders';
    document.getElementById('paymentMethodFilter').value = 'All';
    triggerSearch();
  }

  // Event listeners for live search
  document.getElementById('searchInput').addEventListener('input', triggerSearch);
  document.getElementById('statusFilter').addEventListener('change', triggerSearch);
  document.getElementById('paymentMethodFilter').addEventListener('change', triggerSearch);
  document.getElementById('clearBtn').addEventListener('click', clearSearch);

  // View order details
  function viewOrderDetails(orderId) {
    window.location.href = `/admin/order-view/${orderId}`;
  }

  // Toggle sidebar for mobile
  function toggleSidebar() {
    const sidebar = document.getElementById('sidebar');
    sidebar.classList.toggle('open');
  }

  // Close sidebar when clicking outside on mobile
  document.addEventListener('click', function (event) {
    const sidebar = document.getElementById('sidebar');
    const toggleBtn = document.querySelector('.mobile-menu-toggle');
    if (
      window.innerWidth <= 768 &&
      !sidebar.contains(event.target) &&
      !toggleBtn.contains(event.target) &&
      sidebar.classList.contains('open')
    ) {
      sidebar.classList.remove('open');
    }
  });