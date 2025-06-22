
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
                    // Price range slider implementation
                    const priceMin = document.getElementById('price-min');
                    const priceMax = document.getElementById('price-max');
                    
                    if (priceMin && priceMax) {
                        function updatePriceDisplay() {
                            const minVal = parseInt(priceMin.value);
                            const maxVal = parseInt(priceMax.value);
                            
                            if (minVal >= maxVal) {
                                priceMin.value = maxVal - 5000;
                            }
                            
                            document.querySelector('.price-inputs span:first-child').textContent = 
                                '₹' + parseInt(priceMin.value).toLocaleString('en-IN');
                            document.querySelector('.price-inputs span:last-child').textContent = 
                                '₹' + parseInt(priceMax.value).toLocaleString('en-IN');
                        }
                        
                        priceMin.addEventListener('input', updatePriceDisplay);
                        priceMax.addEventListener('input', updatePriceDisplay);
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
                        const selects = filterForm.querySelectorAll('select, input[type="range"]');
                        selects.forEach(select => {
                            select.addEventListener('change', () => {
                                filterForm.submit();
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

                // Updated initAddToCartButtons function with centered SweetAlert messages
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

                            // Disable button and show loading state
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
                                    // Success message with centered SweetAlert
                                    await Swal.fire({
                                        icon: 'success',
                                        title: 'Added to Cart!',
                                        text: `${productName} has been successfully added to your cart.`,
                                        position: 'center', // Changed from 'top-end' to 'center'
                                        showConfirmButton: true,
                                        confirmButtonText: 'OK',
                                        timer: 3000,
                                        timerProgressBar: true
                                    });
                                } else {
                                    // Error message with centered SweetAlert
                                    await Swal.fire({
                                        icon: 'error',
                                        title: 'Failed to Add',
                                        text: data.message || 'Something went wrong while adding to cart.',
                                        position: 'center', // Changed from 'top-end' to 'center'
                                        showConfirmButton: true,
                                        confirmButtonText: 'OK',
                                        timer: 4000,
                                        timerProgressBar: true
                                    });
                                }
                            } catch (err) {
                                console.error('Add to cart error:', err);
                                // Network error message with centered SweetAlert
                                await Swal.fire({
                                    icon: 'error',
                                    title: 'Network Error',
                                    text: 'Server error. Please try again later.',
                                    position: 'center', // Changed from 'top-end' to 'center'
                                    showConfirmButton: true,
                                    confirmButtonText: 'OK',
                                    timer: 4000,
                                    timerProgressBar: true
                                });
                            } finally {
                                // Re-enable button and restore original text
                                this.disabled = false;
                                this.innerHTML = originalText;
                            }
                        });
                    });
                }


              // Updated Wishlist Function
    function initAddToWishlistButton() {
        const buttons = document.querySelectorAll('.wishlist-btn'); // Corrected variable name
        buttons.forEach(button => {
            button.addEventListener('click', async function (e) {
                e.preventDefault(); // Prevent default navigation
                e.stopPropagation();

                const productId = this.dataset.productId;
                const productName = this.dataset.productName; // Now defined in HTML

                // Disable button and show loading state
                const originalContent = this.innerHTML;
                this.disabled = true;
                this.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Adding...';

                try {
                    const res = await fetch('/wishlist/add', {
                        method: 'POST',
                        headers: {
                            'Content-Type': 'application/json',
                        },
                        body: JSON.stringify({ productId }),
                    });

                    const data = await res.json();

                    if (data.success) {
                        // Toggle active class to show the product is in the wishlist
                        this.classList.add('active');

                        // Success message with centered SweetAlert
                        await Swal.fire({
                            icon: 'success',
                            title: 'Added to Wishlist!',
                            position: 'center',
                            showConfirmButton: true,
                            confirmButtonText: 'OK',
                            timer: 3000,
                            timerProgressBar: true
                        });
                    } else {
                        // Error message with centered SweetAlert
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
                    // Network error message with centered SweetAlert
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
                    // Re-enable button and restore original content
                    this.disabled = false;
                    this.innerHTML = originalContent;
                }
            });
        });
    }
                
        