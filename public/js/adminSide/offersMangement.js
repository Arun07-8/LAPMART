  function searchOffers() {
    const searchTerm = document.getElementById('searchInput').value.trim();
    const sortBy = document.getElementById('sortSelect').value;

    // Basic validation
    if (searchTerm.length > 0 && searchTerm.length < 2) {
      Swal.fire({
        icon: 'warning',
        title: 'Invalid Search',
        text: 'Search term must be at least 2 characters long.',
      });
      return;
    }

    const currentUrl = new URL(window.location);
    if (searchTerm) {
      currentUrl.searchParams.set('search', searchTerm);
    } else {
      currentUrl.searchParams.delete('search');
    }
    currentUrl.searchParams.set('sort', sortBy);
    currentUrl.searchParams.set('page', 1); // Reset to first page

    window.location.href = currentUrl.toString();
  }

  function clearSearch() {
    document.getElementById('searchInput').value = '';
    document.getElementById('sortSelect').value = 'Newest First';

    const currentUrl = new URL(window.location);
    currentUrl.searchParams.delete('search');
    currentUrl.searchParams.delete('sort');
    currentUrl.searchParams.set('page', 1);

    window.location.href = currentUrl.toString();
  }

  // Allow Enter key to trigger search
  document.getElementById('searchInput').addEventListener('keypress', function (e) {
    if (e.key === 'Enter') {
      searchOffers();
    }
  });
        // Search functionality
        function searchOffers() {
            const searchTerm = document.getElementById('searchInput').value;
            const sortBy = document.getElementById('sortSelect').value;
            
            // You can implement AJAX search here or redirect with query parameters
            const currentUrl = new URL(window.location);
            if (searchTerm) {
                currentUrl.searchParams.set('search', searchTerm);
            } else {
                currentUrl.searchParams.delete('search');
            }
            currentUrl.searchParams.set('sort', sortBy);
            currentUrl.searchParams.set('page', 1); // Reset to first page
            
            window.location.href = currentUrl.toString();
        }

        function clearSearch() {
            document.getElementById('searchInput').value = '';
            document.getElementById('sortSelect').selectedIndex = 0;
            
            // Remove search parameters
            const currentUrl = new URL(window.location);
            currentUrl.searchParams.delete('search');
            currentUrl.searchParams.delete('sort');
            currentUrl.searchParams.set('page', 1);
            
            window.location.href = currentUrl.toString();
        }

        // Offer management functions
        function editOffer(offerId) {
            window.location.href = `/admin/edit-offer/${offerId}`;
        }

    async function deleteOffer(offerId) {
  try {
    // Validate offerId
    if (!offerId) {
      throw new Error('Invalid offer ID');
    }

    // Show SweetAlert2 confirmation dialog
    const result = await Swal.fire({
      title: 'Are you sure?',
      text: 'Do you want to delete this offer?',
      icon: 'warning',
      showCancelButton: true,
      confirmButtonColor: '#3085d6',
      cancelButtonColor: '#d33',
      confirmButtonText: 'Yes, delete it!',
      cancelButtonText: 'Cancel',
    });

    // If user cancels, exit the function
    if (!result.isConfirmed) {
      return;
    }

    // Optional: Add loading state to button (if applicable)
    const button = document.querySelector(`[data-offer-id="${offerId}"]`);
    if (button) {
      button.disabled = true;
      button.textContent = 'Deleting...';
    }

 
    const response = await fetch(`/admin/offerdelete/${offerId}`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
      },
    });


    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    const data = await response.json();

    if (data.success) {
      await Swal.fire({
        title: 'Deleted!',
        text: 'The offer has been deleted successfully.',
        icon: 'success',
        confirmButtonText: 'OK',
      });
      window.location.href="/admin/offers"
    } else {
      throw new Error(data.message || 'Failed to delete offer');
    }
  } catch (error) {
    console.error('Error deleting offer:', error);
    await Swal.fire({
      title: 'Error!',
      text: `Error deleting offer: ${error.message}`,
      icon: 'error',
      confirmButtonText: 'OK',
    });
  } finally {
    // Reset loading state
    const button = document.querySelector(`[data-offer-id="${offerId}"]`);
    if (button) {
      button.disabled = false;
      button.textContent = 'Delete';
    }
  }
}
// Allow Enter key to trigger search
document.getElementById('searchInput').addEventListener('keypress', function(e) {
    if (e.key === 'Enter') {
        searchOffers();
    }
});


 async function handleActiveOffer(offerId) {
            const result = await Swal.fire({
                title: 'Are you sure?',
                text: 'This will Active the Offer, making it visible and add offer products.',
                icon: 'question',
                showCancelButton: true,
                confirmButtonText: 'Yes, Active it!',
                cancelButtonText: 'Cancel'
            });
            if (result.isConfirmed) {
                try {
                    const response = await fetch(`/admin/active-offers/${offerId}`, {
                        method: 'PATCH',
                        headers: { 'Content-Type': 'application/json' }
                    });
                    const data = await response.json();
                    if (!response.ok) throw new Error(data.error || 'Failed to Active offer');
                    Swal.fire({
                        icon: 'success',
                        title: 'Offer  is Active',
                        text: data.message || 'Offer  has been Active successfully',
                        timer: 1500,
                        showConfirmButton: false
                    }).then(() => window.location.href="/admin/offers")
                } catch (error) {
                    Swal.fire({
                        icon: 'error',
                        title: 'Error',
                        text: error.message || 'An error occurred while active the offer'
                    });
                }
            }
        }

         async function handleInActiveOffer(offerId) {
            const result = await Swal.fire({
                title: 'Are you sure?',
                text: 'This will is inActive the offer  , making it hidden. can not apply',
                icon: 'warning',
                showCancelButton: true,
                confirmButtonText: 'Yes, is inaActive it!',
                cancelButtonText: 'Cancel'
            });
            if (result.isConfirmed) {
                try {
                    const response = await fetch(`/admin/inactive-offers/${offerId}`, {
                        method: 'PATCH',
                        headers: { 'Content-Type': 'application/json' }
                    });
                    const data = await response.json();
                    if (!response.ok) throw new Error(data.error || 'Failed to inActive offer');
                    Swal.fire({
                        icon: 'success',
                        title: 'Offer inActive',
                        text: data.message || 'Offer has been inActive successfully',
                        timer: 1500,
                        showConfirmButton: false
                    }).then(() => location.reload());
                } catch (error) {
                    Swal.fire({
                        icon: 'error',
                        title: 'Error',
                        text: error.message || 'An error occurred while inactive the coupon'
                    });
                }
            }
        }

       