document.addEventListener('DOMContentLoaded', function() {
    const searchInput = document.getElementById('userSearchInput');
    const searchBtn = document.getElementById('searchBtn');
    const searchLoadingIcon = document.getElementById('searchLoadingIcon');
    const tableContainer = document.querySelector('.table-container');

    function performSearch() {
        let searchTerm = searchInput.value.trim();
        searchLoadingIcon.style.display = 'block';
        
        const currentUrl = new URL(window.location.href);
        if (searchTerm.length > 0) {
            // Encode the search term for the URL
            currentUrl.searchParams.set('search', encodeURIComponent(searchTerm));
            currentUrl.searchParams.set('page', '1');
        } else {
            currentUrl.searchParams.delete('search');
            currentUrl.searchParams.set('page', '1');
        }
        
        window.location.href = currentUrl.toString();
    }

    searchBtn.addEventListener('click', function(e) {
        e.preventDefault();
        performSearch();
    });

    searchInput.addEventListener('keypress', function(e) {
        if (e.key === 'Enter') {
            e.preventDefault();
            performSearch();
        }
    });

    clearSearchBtn.addEventListener('click', function() {
        searchInput.value = '';
        toggleClearButton();
        const currentUrl = new URL(window.location.href);
        currentUrl.searchParams.delete('search');
        currentUrl.searchParams.set('page', '1');
        window.location.href = currentUrl.toString();
    });

    searchInput.addEventListener('input', toggleClearButton);

    function toggleClearButton() {
        clearButton.style.display = searchInput.value.trim() ? 'block' : 'none';
    }

    function adjustTableContainer() {
        if (window.innerWidth <= 1200) {
            tableContainer.style.overflowX = 'auto';
        } else {
            tableContainer.style.overflowX = 'visible';
        }
    }
    
    adjustTableContainer();
    window.addEventListener('resize', adjustTableContainer);

    // Restore the original search term in the input field
    const urlParams = new URLSearchParams(window.location.search);
    const searchTerm = urlParams.get('search');
    if (searchTerm) {
        searchInput.value = decodeURIComponent(searchTerm);
        toggleClearButton();
    }
});
async function handleBlockUserClick(userId) {
    const button = document.querySelector(`button[onclick="handleBlockUserClick('${userId}')"]`);
    button.setAttribute('aria-busy', 'true');
    button.disabled = true;

    const result = await Swal.fire({
        title: 'Are you sure?',
        text: 'This will block the user, logging them out and restricting their access.',
        icon: 'warning',
        showCancelButton: true,
        confirmButtonText: 'Yes, block user!',
        cancelButtonText: 'Cancel'
    });

    if (result.isConfirmed) {
        try {
            const response = await fetch(`/admin/blockUser/${userId}`, {
                method: 'PATCH',
                headers: {
                    'Content-Type': 'application/json'
                }
            });

            const contentType = response.headers.get('content-type');
            if (!contentType || !contentType.includes('application/json')) {
                const text = await response.text();
                console.error('Non-JSON response:', text);
                throw new Error('Server returned non-JSON response');
            }

            const data = await response.json();
            if (!response.ok) throw new Error(data.error || 'Failed to block user');

            Swal.fire({
                icon: 'success',
                title: 'User Blocked',
                text: data.message || 'User has been blocked successfully',
                timer: 1500,
                showConfirmButton: false
            }).then(() => location.reload());
        } catch (error) {
            console.error('Error blocking user:', error);
            Swal.fire({
                icon: 'error',
                title: 'Error',
                text: error.message || 'An error occurred while blocking the user'
            });
        } finally {
            button.setAttribute('aria-busy', 'false');
            button.disabled = false;
        }
    } else {
        button.setAttribute('aria-busy', 'false');
        button.disabled = false;
    }
}

async function handleUnblockUserClick(userId) {
    const button = document.querySelector(`button[onclick="handleUnblockUserClick('${userId}')"]`);
    button.setAttribute('aria-busy', 'true');
    button.disabled = true;

    const result = await Swal.fire({
        title: 'Are you sure?',
        text: 'This will unblock the user, restoring their access.',
        icon: 'question',
        showCancelButton: true,
        confirmButtonText: 'Yes, unblock user!',
        cancelButtonText: 'Cancel'
    });

    if (result.isConfirmed) {
        try {
            const response = await fetch(`/admin/unblockUser/${userId}`, {
                method: 'PATCH',
                headers: {
                    'Content-Type': 'application/json'
                }
            });

            const contentType = response.headers.get('content-type');
            if (!contentType || !contentType.includes('application/json')) {
                const text = await response.text();
                console.error('Non-JSON response:', text);
                throw new Error('Server returned non-JSON response');
            }

            const data = await response.json();
            if (!response.ok) throw new Error(data.error || 'Failed to unblock user');

            Swal.fire({
                icon: 'success',
                title: 'User Unblocked',
                text: data.message || 'User has been unblocked successfully',
                timer: 1500,
                showConfirmButton: false
            }).then(() => location.reload());
        } catch (error) {
            console.error('Error unblocking user:', error);
            Swal.fire({
                icon: 'error',
                title: 'Error',
                text: error.message || 'An error occurred while unblocking the user'
            });
        } finally {
            button.setAttribute('aria-busy', 'false');
            button.disabled = false;
        }
    } else {
        button.setAttribute('aria-busy', 'false');
        button.disabled = false;
    }
}