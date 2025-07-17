 document.addEventListener('DOMContentLoaded', () => {
        // Session Check for Cart and Wishlist
        const checkSession = async (url, action) => {
            try {
                const res = await fetch('/check-session', {
                    method: 'GET',
                    headers: { 'Accept': 'application/json' }
                });
                const data = await res.json();
                if (data.loggedIn) {
                    window.location.href = url;
                } else {
                    Swal.fire({
                        icon: 'warning',
                        title: 'Login Required',
                        text: `Please login to view your ${action}`,
                        confirmButtonText: 'OK'
                    });
                }
            } catch (error) {
                console.error(`Error checking ${action}:`, error);
                Swal.fire({
                    icon: 'error',
                    title: 'Something went wrong',
                    text: `Unable to access ${action}. Try again later.`
                });
            }
        };

        // Cart and Wishlist Button Handlers
        ['cart-btn', 'cart-btn-sidebar'].forEach(id => {
            const btn = document.getElementById(id);
            if (btn) {
                btn.addEventListener('click', e => {
                    e.preventDefault();
                    checkSession('/cart', 'cart');
                });
            }
        });

        ['header-wishlist-btn', 'Wishlist-btn-sidebar'].forEach(id => {
            const btn = document.getElementById(id);
            if (btn) {
                btn.addEventListener('click', e => {
                    e.preventDefault();
                    checkSession('/wishlist', 'wishlist');
                });
            }
        });

        // Sidebar and Navigation Logic
        (function() {
            const debounce = (func, wait) => {
                let timeout;
                return (...args) => {
                    clearTimeout(timeout);
                    timeout = setTimeout(() => func.apply(null, args), wait);
                };
            };

            const menuToggle = document.querySelector('.menu-toggle');
            const sidebar = document.getElementById('sidebar');
            const sidebarOverlay = document.getElementById('sidebarOverlay');
            const profileButton = document.getElementById('profileButton');
            const logo = document.querySelector('.logo');
            const navLinks = document.querySelectorAll('.nav-link');

            // Debug: Log DOM elements
            console.log('Profile Button:', profileButton);
            console.log('Dropdown:', document.getElementById('profileDropdown'));

            // Set active link based on current URL
            const currentPath = window.location.pathname;
            navLinks.forEach(link => {
                if (link.getAttribute('href') === currentPath) {
                    link.classList.add('active');
                    logo.classList.toggle('home-active', currentPath === '/');
                }
                link.addEventListener('click', function() {
                    navLinks.forEach(l => l.classList.remove('active'));
                    this.classList.add('active');
                    logo.classList.toggle('home-active', this.getAttribute('href') === '/');
                });
            });

            // Sidebar toggle
            if (menuToggle && sidebar && sidebarOverlay) {
                const toggleSidebar = () => {
                    menuToggle.classList.toggle('active');
                    sidebar.classList.toggle('active');
                    sidebarOverlay.classList.toggle('active');
                    const dropdown = document.getElementById('profileDropdown');
                    if (dropdown) {
                        dropdown.classList.remove('active');
                        console.log('Dropdown closed due to sidebar toggle');
                    }
                };

                menuToggle.addEventListener('click', toggleSidebar);
                sidebarOverlay.addEventListener('click', toggleSidebar);

                sidebar.querySelectorAll('.sidebar-menu a').forEach(link => {
                    link.addEventListener('click', toggleSidebar);
                });

                menuToggle.addEventListener('keydown', e => {
                    if (e.key === 'Enter' || e.key === ' ') {
                        e.preventDefault();
                        toggleSidebar();
                    }
                });
            }

            // Profile dropdown toggle
            if (profileButton) {
                profileButton.addEventListener('click', e => {
                    e.stopPropagation();
                    if (window.innerWidth > 900) {
                        const dropdown = document.getElementById('profileDropdown');
                        if (dropdown) {
                            console.log('Toggling dropdown, current state:', dropdown.classList.contains('active'));
                            dropdown.classList.toggle('active');
                            console.log('Dropdown classes after toggle:', dropdown.classList.toString());
                        } else {
                            console.error('Dropdown element not found');
                        }
                    } else {
                        console.log('Opening sidebar on mobile');
                        if (menuToggle && sidebar && sidebarOverlay) {
                            menuToggle.classList.toggle('active');
                            sidebar.classList.toggle('active');
                            sidebarOverlay.classList.toggle('active');
                        }
                    }
                });

                profileButton.addEventListener('keydown', e => {
                    if (e.key === 'Enter' || e.key === ' ') {
                        e.preventDefault();
                        e.stopPropagation();
                        if (window.innerWidth > 900) {
                            const dropdown = document.getElementById('profileDropdown');
                            if (dropdown) {
                                console.log('Toggling dropdown via keyboard, current state:', dropdown.classList.contains('active'));
                                dropdown.classList.toggle('active');
                                console.log('Dropdown classes after keyboard toggle:', dropdown.classList.toString());
                            } else {
                                console.error('Dropdown element not found');
                            }
                        } else {
                            console.log('Opening sidebar via keyboard on mobile');
                            if (menuToggle && sidebar && sidebarOverlay) {
                                menuToggle.classList.toggle('active');
                                sidebar.classList.toggle('active');
                                sidebarOverlay.classList.toggle('active');
                            }
                        }
                    }
                });
            }

            // Close dropdown when clicking outside
            document.addEventListener('click', e => {
                const dropdown = document.getElementById('profileDropdown');
                const container = document.querySelector('.profile-container');
                if (dropdown && container && !container.contains(e.target) && dropdown.classList.contains('active')) {
                    console.log('Closing dropdown due to outside click');
                    dropdown.classList.remove('active');
                    console.log('Dropdown classes after close:', dropdown.classList.toString());
                }
            });

            // Close sidebar and dropdown on resize
            window.addEventListener('resize', debounce(() => {
                if (window.innerWidth > 900 && sidebar && sidebarOverlay) {
                    sidebar.classList.remove('active');
                    sidebarOverlay.classList.remove('active');
                    menuToggle.classList.remove('active');
                    const dropdown = document.getElementById('profileDropdown');
                    if (dropdown) {
                        dropdown.classList.remove('active');
                        console.log('Dropdown and sidebar closed on resize');
                    }
                }
            }, 100));
        })();
    });