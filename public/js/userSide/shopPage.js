document.addEventListener('DOMContentLoaded', function () {
    initPriceRangeSlider();
    initFilterToggle();
    initWishlistButtons();
    initAddToCartButtons();
    initFilterForm();
    initSortSelect();
    initSearchInput();
    checkMobileView();
    initAddToWishlistButton();

    let resizeTimeout;
    window.addEventListener('resize', () => {
        clearTimeout(resizeTimeout);
        resizeTimeout = setTimeout(checkMobileView, 100);
    });
});

function initPriceRangeSlider() {
    const priceMin = document.getElementById('price-min');
    const priceMax = document.getElementById('price-max');
    const priceMinDisplay = document.querySelector('.price-inputs span:first-child');
    const priceMaxDisplay = document.querySelector('.price-inputs span:last-child');

    if (priceMin && priceMax && priceMinDisplay && priceMaxDisplay) {
        function updatePriceDisplay() {
            let minVal = parseInt(priceMin.value);
            let maxVal = parseInt(priceMax.value);

            // Ensure minVal is not greater than maxVal
            if (minVal > maxVal - 5000) {
                minVal = maxVal - 5000;
                priceMin.value = minVal;
            }

            priceMinDisplay.textContent = `₹${minVal.toLocaleString('en-IN')}`;
            priceMaxDisplay.textContent = `₹${maxVal.toLocaleString('en-IN')}`;
        }

        priceMin.addEventListener('input', updatePriceDisplay);
        priceMax.addEventListener('input', updatePriceDisplay);
        updatePriceDisplay(); // Initialize display
    }
}

function initFilterToggle() {
    const filterToggle = document.getElementById('filter-toggle');
    const filtersContent = document.querySelector('.filters-content');

    if (filterToggle && filtersContent) {
        filterToggle.addEventListener('click', () => {
            filtersContent.classList.toggle('show');
        });
    }
}

function initWishlistButtons() {
    const wishlistBtns = document.querySelectorAll('.wishlist-btn');
    wishlistBtns.forEach(btn => {
        btn.addEventListener('click', (e) => {
            e.preventDefault();
            e.stopPropagation();
            btn.classList.toggle('active');
        });
    });
}

function initFilterForm() {
    const filterForm = document.getElementById('filter-form');
    if (filterForm) {
        const inputs = filterForm.querySelectorAll('select, input[type="range"]');
        let debounceTimeout;

        inputs.forEach(input => {
            input.addEventListener('change', () => {
                clearTimeout(debounceTimeout);
                debounceTimeout = setTimeout(() => {
                    console.log('Submitting filter form with:', new URLSearchParams(new FormData(filterForm)).toString());
                    filterForm.submit();
                }, 300); // Debounce to prevent rapid submissions
            });
        });
    }
}

function initSortSelect() {
    const sortSelect = document.getElementById('sort-select');
    if (sortSelect) {
        sortSelect.addEventListener('change', () => {
            const params = new URLSearchParams(window.location.search);
            params.set('sort', sortSelect.value);
            params.set('page', '1');
            console.log('Navigating to:', `/shop?${params.toString()}`);
            window.location.href = `/shop?${params.toString()}`;
        });
    }
}

function initSearchInput() {
    const searchInput = document.getElementById('search-input');
    const searchBtn = document.getElementById('search-btn');
    if (!searchInput || !searchBtn) return;

    let debounceTimeout;
    const debounceSearch = (value) => {
        clearTimeout(debounceTimeout);
        debounceTimeout = setTimeout(() => {
            const searchTerm = value.trim();
            if (searchTerm.length === 0) {
                Swal.fire({
                    icon: 'warning',
                    title: 'Search Required',
                    text: 'Please enter a search term',
                    toast: true,
                    position: 'top-end',
                    showConfirmButton: false,
                    timer: 3000
                });
                return;
            }
            const params = new URLSearchParams(window.location.search);
            params.set('search', searchTerm);
            params.set('page', '1');
            console.log('Navigating to:', `/shop?${params.toString()}`);
            window.location.href = `/shop?${params.toString()}`;
        }, 500);
    };

    searchInput.addEventListener('keypress', (e) => {
        if (e.key === 'Enter') {
            e.preventDefault();
            debounceSearch(searchInput.value);
        }
    });

    searchBtn.addEventListener('click', (e) => {
        e.preventDefault();
        debounceSearch(searchInput.value);
    });
}

function checkMobileView() {
    const filtersContent = document.querySelector('.filters-content');
    const filterToggle = document.getElementById('filter-toggle');

    if (window.innerWidth <= 768) {
        if (filtersContent) filtersContent.classList.remove('show');
        if (filterToggle) filterToggle.style.display = 'block';
    } else {
        if (filtersContent) filtersContent.classList.add('show');
        if (filterToggle) filterToggle.style.display = 'none';
    }
}

function initAddToCartButtons() {
    const buttons = document.querySelectorAll('.add-to-cart-btn');
    buttons.forEach(button => {
        button.addEventListener('click', async function (e) {
            e.preventDefault();
            e.stopPropagation();

            const productId = this.dataset.productId;
            const productName = this.dataset.productName;
            const price = parseFloat(this.dataset.productPrice);
            const quantity = 1;

            const originalText = this.innerHTML;
            this.disabled = true;
            this.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Adding...';

            try {
                const res = await fetch('/cart/add', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                    },
                    body: JSON.stringify({ productId, price, quantity }),
                });

                const data = await res.json();

                if (data.success) {
                    await Swal.fire({
                        icon: 'success',
                        title: 'Added to Cart!',
                        text: `${productName} has been successfully added to your cart.`,
                        position: 'center',
                        showConfirmButton: true,
                        confirmButtonText: 'OK',
                        timer: 2000,
                        timerProgressBar: true
                    });
                } else if (data.redirectUrl) {
                    await Swal.fire({
                        icon: 'warning',
                        title: 'Please log in',
                        text: data.message || 'You need to be logged in to use this feature.',
                        confirmButtonText: 'Go to Login',
                        showCancelButton: true
                    }).then(result => {
                        if (result.isConfirmed) {
                            window.location.href = data.redirectUrl;
                        }
                    });
                    return;
                } else {
                    await Swal.fire({
                        icon: 'error',
                        title: 'Failed to Add',
                        text: data.message || 'Something went wrong while adding to cart.',
                        position: 'center',
                        showConfirmButton: true,
                        confirmButtonText: 'OK',
                        timer: 4000,
                        timerProgressBar: true
                    });
                }
            } catch (err) {
                console.error('Add to cart error:', err);
                await Swal.fire({
                    icon: 'error',
                    title: 'Network Error',
                    text: 'Server error. Please try again later.',
                    position: 'center',
                    showConfirmButton: true,
                    confirmButtonText: 'OK',
                    timer: 4000,
                    timerProgressBar: true
                });
            } finally {
                this.disabled = false;
                this.innerHTML = originalText;
            }
        });
    });
}

function initAddToWishlistButton() {
    const buttons = document.querySelectorAll('.wishlist-btn');
    buttons.forEach(button => {
        button.addEventListener('click', async function (e) {
            e.preventDefault();
            e.stopPropagation();

            const Id = this.dataset.productId;
            const productName = this.dataset.productName;

            const originalContent = this.innerHTML;
            this.disabled = true;
            this.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Adding...';

            try {
                const res = await fetch(`/wishlist/add/${Id}`, {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                    }
                });

                const data = await res.json();

                if (data.success) {
                    this.classList.add('active');
                    await Swal.fire({
                        icon: 'success',
                        title: 'Added to Wishlist!',
                        position: 'center',
                        showConfirmButton: true,
                        confirmButtonText: 'OK',
                        timer: 3000,
                        timerProgressBar: true
                    });
                } else if (data.redirectUrl) {
                    await Swal.fire({
                        icon: 'warning',
                        title: 'Please log in',
                        text: data.message || 'You need to be logged in to use this feature.',
                        confirmButtonText: 'Go to Login',
                        showCancelButton: true
                    }).then(result => {
                        if (result.isConfirmed) {
                            window.location.href = data.redirectUrl;
                        }else {
                             window.location.reload()
                        }
                    })
                    return;
                } else {
                    await Swal.fire({
                        icon: 'error',
                        title: 'Failed to Add',
                        text: data.message || 'Something went wrong while adding to wishlist.',
                        position: 'center',
                        showConfirmButton: true,
                        confirmButtonText: 'OK',
                        timer: 4000,
                        timerProgressBar: true
                    });
                }
            } catch (err) {
                console.error('Add to wishlist error:', err);
                await Swal.fire({
                    icon: 'error',
                    title: 'Network Error',
                    text: 'Server error. Please try again later.',
                    position: 'center',
                    showConfirmButton: true,
                    confirmButtonText: 'OK',
                    timer: 4000,
                    timerProgressBar: true
                });
            } finally {
                this.disabled = false;
                this.innerHTML = originalContent;
            }
        });
    });
}