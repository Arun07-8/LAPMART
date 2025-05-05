async function handleSoftDeleteClick(productId) {
    const result = await Swal.fire({
        title: 'Are you sure?',
        text: 'This will mark the product as deleted. You can restore it later.',
        icon: 'warning',
        showCancelButton: true,
        confirmButtonText: 'Yes, delete it!',
        cancelButtonText: 'Cancel',
        confirmButtonColor: '#D74742',
        cancelButtonColor: '#6B7280',
        customClass: {
            confirmButton: 'btn btn-danger',
            cancelButton: 'btn btn-secondary'
        },
        buttonsStyling: true
    });

    if (result.isConfirmed) {
        try {
            const response = await fetch(`/admin/deleteProducts/${productId}`, {
                method: 'PATCH',
                headers: {
                    'Content-Type': 'application/json',
                }
            });

            const data = await response.json();
            
            if (!response.ok) {
                throw new Error(data.error || 'Failed to soft delete product');
            }

            Swal.fire({
                icon: 'success',
                title: 'Deleted',
                text: data.message || 'Product has been soft deleted',
                confirmButtonColor: '#219653'
            }).then(() => {
                window.location.href = '/admin/products';
            });
        } catch (error) {
            Swal.fire({
                icon: 'error',
                title: 'Oops',
                text: error.message || 'An error occurred while deleting the product',
                confirmButtonColor: '#D74742'
            });
        }
    }
}

function triggerSearch() {
    const searchInput = document.getElementById('searchInput').value.trim();
    const url = new URL(window.location.href);
    url.searchParams.set('search', searchInput);
    url.searchParams.set('page', '1')
    window.location.href = url.toString();
}

function clearSearch() {
    const url = new URL(window.location.href);
    url.searchParams.delete('search');
    url.searchParams.set('page', '1');
    document.getElementById('searchInput').value = '';
    window.location.href = url.toString();
}

let searchTimeout;
document.getElementById('searchInput').addEventListener('input', function () {
    clearTimeout(searchTimeout);
    if (this.value.length >= 2) {
        searchTimeout = setTimeout(() => {
            triggerSearch();
        }, 500);
    }
});


document.getElementById('searchInput').addEventListener('keypress', function (e) {
    if (e.key === 'Enter') {
        e.preventDefault();
        triggerSearch();
    }
});


document.addEventListener('DOMContentLoaded', function() {
    const sidebarItems = document.querySelectorAll('.sidebar-item');
    sidebarItems.forEach(item => {
        if (item.getAttribute('href') === '/admin/products') {
            item.classList.add('active');
        }
    });
});
 
async function handleListProduct(productId) {
    console.log(productId,"is product id");
    
    const result = await Swal.fire({
        title: 'Are you sure?',
        text: 'This will list the product, making it visible.',
        icon: 'question',
        showCancelButton: true,
        confirmButtonText: 'Yes, list it!',
        cancelButtonText: 'Cancel'
    });
    if (result.isConfirmed) {
        try {
            const response = await fetch(`/admin/listedProduct/${productId}`, {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' }
            });
            const data = await response.json();
            if (!response.ok) throw new Error(data.error || 'Failed to list product');
            Swal.fire({
                icon: 'success',
                title: 'Product Listed',
                text: data.message || 'Product has been listed successfully',
                timer: 1500,
                showConfirmButton: false
            }).then(() => window.location="/admin/products");
        } catch (error) {
            Swal.fire({
                icon: 'error',
                title: 'Error',
                text: error.message || 'An error occurred while listing the Product'
            });
        }
    }
}

async function handleUnlistProduct(productId) {
    const result = await Swal.fire({
        title: 'Are you sure?',
        text: 'This will unlist the Product, making it hidden.',
        icon: 'warning',
        showCancelButton: true,
        confirmButtonText: 'Yes, unlist it!',
        cancelButtonText: 'Cancel'
    });
    if (result.isConfirmed) {
        try {
            const response = await fetch(`/admin/unlistedProduct/${productId}`, {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' }
            });
            
            const data = await response.json();
            if (!response.ok) throw new Error(data.error || 'Failed to unlist product');
            Swal.fire({
                icon: 'success',
                title: 'Product Unlisted',
                text: data.message || 'Product has been unlisted successfully',
                timer: 1500,
                showConfirmButton: false
            }).then(() => window.location="/admin/products");
        } catch (error) {
            Swal.fire({
                icon: 'error',
                title: 'Error',
                text: error.message || 'An error occurred while unlisting the  Product'
            });
        }
    }
}
