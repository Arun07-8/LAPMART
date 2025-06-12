 document.addEventListener('DOMContentLoaded', function() {
            const showMoreBtn = document.getElementById('show-more-addresses');
            const showMoreText = document.getElementById('show-more-text');
            const showLessText = document.getElementById('show-less-text');
            const addressCards = document.querySelectorAll('.address-card');
            let isExpanded = false;

            if (showMoreBtn) {
                showMoreBtn.addEventListener('click', function() {
                    isExpanded = !isExpanded;
                    
                    addressCards.forEach((card, index) => {
                        if (index >= 2) {
                            if (isExpanded) {
                                card.classList.remove('hidden');
                            } else {
                                card.classList.add('hidden');
                            }
                        }
                    });

                    if (isExpanded) {
                        showMoreText.style.display = 'none';
                        showLessText.style.display = 'inline-flex';
                    } else {
                        showMoreText.style.display = 'inline-flex';
                        showLessText.style.display = 'none';
                    }
                });
            }
        });

        // Address selection
        document.querySelectorAll('.address-card').forEach(card => {
            card.addEventListener('click', function() {
                // Find the radio button in this card and check it
                const radioButton = this.querySelector('.address-radio-input');
                if (radioButton) {
                    radioButton.checked = true;
                }
                
                // Update visual selection
                document.querySelectorAll('.address-card').forEach(c => {
                    c.classList.remove('selected');
                });
                this.classList.add('selected');
            });
        });

        // Payment method selection
        document.querySelectorAll('.payment-option').forEach(option => {
            option.addEventListener('click', function() {
                // Find the radio button in this option and check it
                const radioButton = this.querySelector('.payment-radio-input');
                if (radioButton) {
                    radioButton.checked = true;
                }
                
                // Update visual selection
                document.querySelectorAll('.payment-option').forEach(opt => {
                    opt.classList.remove('selected');
                });
                this.classList.add('selected');
            });
        });
   document.addEventListener('DOMContentLoaded', function() {
    const showMoreBtn = document.getElementById('checkout-show-more-addresses');
    const showMoreText = document.getElementById('checkout-show-more-text');
    const showLessText = document.getElementById('checkout-show-less-text');
    const addressCards = document.querySelectorAll('.checkout-address-card');
    let isExpanded = false;

    if (showMoreBtn) {
        showMoreBtn.addEventListener('click', function() {
            isExpanded = !isExpanded;
            addressCards.forEach((card, index) => {
                if (index >= 2) {
                    if (isExpanded) {
                        card.classList.remove('checkout-address-hidden');
                    } else {
                        card.classList.add('checkout-address-hidden');
                    }
                }
            });
            showMoreText.style.display = isExpanded ? 'none' : 'inline-flex';
            showLessText.style.display = isExpanded ? 'inline-flex' : 'none';
        });
    }

    // Address selection
    document.querySelectorAll('.checkout-address-card').forEach(card => {
        card.addEventListener('click', function(e) {
            // Prevent clicking on edit link from selecting the card
            if (e.target.classList.contains('checkout-edit-link')) return;

            const radioButton = this.querySelector('.checkout-address-radio');
            if (radioButton) {
                radioButton.checked = true;
                document.querySelectorAll('.checkout-address-card').forEach(c => {
                    c.classList.remove('checkout-address-selected');
                });
                this.classList.add('checkout-address-selected');
            }
        });
    });

    // Payment method selection
    document.querySelectorAll('.checkout-payment-option').forEach(option => {
        option.addEventListener('click', function() {
            const radioButton = this.querySelector('.checkout-payment-radio');
            if (radioButton) {
                radioButton.checked = true;
                document.querySelectorAll('.checkout-payment-option').forEach(opt => {
                    opt.classList.remove('checkout-payment-selected');
                });
                this.classList.add('checkout-payment-selected');
            }
        });
    });

    // Place order
    document.getElementById("place-order").addEventListener("click", async () => {
        const selectedAddressId = document.querySelector('input[name="checkout-address"]:checked')?.value;
        const paymentMethod = document.querySelector('input[name="paymentMethod"]:checked')?.value;

        // Client-side validation
        if (!selectedAddressId || !paymentMethod) {
            Swal.fire({
                title: "Invalid Input",
                text: "Please select both address and payment method!",
                icon: "warning",
                confirmButtonText: "OK",
            });
            return;
        }

        try {
            const response = await fetch("/place-Order", {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                },
                body: JSON.stringify({
                    addressId: selectedAddressId, // Match backend expected key
                    paymentMethod,
                }),
            });

            const data = await response.json();

            Swal.fire({
                title: data.message.title,
                text: data.message.text,
                icon: data.message.icon,
                confirmButtonText: "OK",
            }).then(() => {
                if (data.success) {
                    window.location.href = `/order/${data.orderId}`;
                }
            });
        } catch (error) {
            Swal.fire({
                title: "Error",
                text: "⚠️ Failed to connect to the server. Please try again later.",
                icon: "warning",
                confirmButtonText: "OK",
            });
        }
    });
});