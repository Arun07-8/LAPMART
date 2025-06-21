async function updateQuantity(productId) {
    const quantityInput = document.getElementById(`quantity-${productId}`);
    const newQuantity = parseInt(quantityInput?.value || 1);
    const increaseButton = document.querySelector(`.cart-qty-button[onclick="increaseQuantity('${productId}')"]`);
    const decreaseButton = document.querySelector(`.cart-qty-button[onclick="decreaseQuantity('${productId}')"]`);

    // Validate input
    if (isNaN(newQuantity) || newQuantity < 1) {
        quantityInput.value = quantityInput.dataset.previousValue || 1;
        Swal.fire({
            icon: 'warning',
            title: 'Invalid Quantity',
            text: 'Please enter a valid quantity (1 or more).',
            timer: 1500,
            showConfirmButton: false,
        });
        return;
    }

    // Disable buttons during request
    quantityInput.disabled = true;
    if (increaseButton) increaseButton.disabled = true;
    if (decreaseButton) decreaseButton.disabled = true;

    try {
        const response = await fetch('/cart/update-quantity', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ productId, quantity: newQuantity }),
        });

        const data = await response.json();

        Swal.fire({
            icon: response.ok ? 'success' : 'error',
            title: response.ok ? 'Success' : 'Error',
            text: data.message,
            timer: 1500,
            showConfirmButton: false,
        });

        if (response.ok) {
            quantityInput.value = data.newQuantity;
            quantityInput.dataset.previousValue = data.newQuantity;

            // ✅ SUBTOTAL update using data-price (offer price)
            const subtotalElement = document.getElementById(`subtotal-${productId}`);
            const finalPrice = parseFloat(quantityInput.dataset.price);  // ✅ Get offer price
            if (subtotalElement && !isNaN(finalPrice)) {
                const subtotal = finalPrice * data.newQuantity;
                subtotalElement.textContent = `₹${subtotal.toLocaleString('en-IN')}`;
            }

            // ✅ Update order summary (from backend total)
            updateOrderSummary({ totalPrice: data.newTotalPrice });

        } else {
            // Revert quantity input
            quantityInput.value = quantityInput.dataset.previousValue || 1;
        }
    } catch (err) {
        console.error('Error updating quantity:', err);
        Swal.fire({
            icon: 'error',
            title: 'Error',
            text: 'Something went wrong. Please try again.',
            timer: 1500,
            showConfirmButton: false,
        });
        quantityInput.value = quantityInput.dataset.previousValue || 1;
    } finally {
        // Re-enable buttons
        quantityInput.disabled = false;
        if (increaseButton) increaseButton.disabled = false;
        if (decreaseButton) decreaseButton.disabled = false;
    }
}


async function increaseQuantity(productId) {
    const quantityInput = document.getElementById(`quantity-${productId}`);
    quantityInput.dataset.previousValue = quantityInput.value;
    const newValue = parseInt(quantityInput?.value || 1) + 1;
    quantityInput.value = newValue;
    await updateQuantity(productId);
}

async function decreaseQuantity(productId) {
    const quantityInput = document.getElementById(`quantity-${productId}`);
    const currentValue = parseInt(quantityInput?.value || 1);
    if (currentValue > 1) {
        quantityInput.dataset.previousValue = quantityInput.value;
        const newValue = currentValue - 1;
        quantityInput.value = newValue;
        await updateQuantity(productId);
    }
}


async function removeItem(productId) {
    const result = await Swal.fire({
        title: 'Remove Item',
        text: 'Are you sure you want to remove this item from your cart?',
        icon: 'warning',
        showCancelButton: true,
        confirmButtonColor: '#d33',
        cancelButtonColor: '#3085d6',
        confirmButtonText: 'Yes, remove it!',
        cancelButtonText: 'Cancel'
    });

    if (result.isConfirmed) {
        try {
            // Send AJAX request to remove item
            const response = await fetch('/cart/remove', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({ productId }),
            });

            const data = await response.json();

            if (response.ok) {
                // Remove the specific item from DOM
                const itemElement = document.querySelector(`.cart-product-item[data-product-id="${productId}"]`);
                if (itemElement) {
                    itemElement.remove();
                }

                // Check if cart is empty and update product list container
                const productContainer = document.querySelector('.cart-items-container');
                const remainingItems = document.querySelectorAll('.cart-product-item');
                if (!remainingItems.length) {
                    productContainer.innerHTML = '<div class="cart-empty-message">Your cart is empty.</div>';
                }

                // Update order summary with server data
                updateOrderSummary(data.cart);

                Swal.fire({
                    icon: 'success',
                    title: 'Removed!',
                    text: 'Item removed from cart!',
                    timer: 2000
                });
            } else {
                Swal.fire({
                    icon: 'error',
                    title: 'Removal Failed',
                    text: data.message || 'Failed to remove item.',
                    confirmButtonText: 'OK'
                });
            }
        } catch (error) {
            console.error('Error removing item:', error);
            Swal.fire({
                icon: 'error',
                title: 'Error',
                text: 'An error occurred while removing the item.',
                confirmButtonText: 'OK'
            });
        }
    }
}

function updateOrderSummary(cart) {
    const orderTotalElement = document.getElementById('orderTotal');
    const grandTotalElement = document.getElementById('grandTotal');

    if (cart && cart.totalPrice) {
        const total = cart.totalPrice.toLocaleString();
        orderTotalElement.textContent = `₹${total}`;
        grandTotalElement.textContent = `₹${total}`;
    } else {
        orderTotalElement.textContent = '₹0';
        grandTotalElement.textContent = '₹0';
    }
}

function proceedToCheckout() {
    window.location.href = '/checkout';
}

document.addEventListener('DOMContentLoaded', function () {
    document.querySelectorAll('.cart-qty-input').forEach(input => {
        input.addEventListener('input', function () {
            const productId = this.id.replace('quantity-', '');
            updateQuantity(productId);
        });
    });
});

//checkout validation 
document.getElementById("checkoutBtn").addEventListener("click", async () => {

    try {
        const res = await fetch("/checkout", {
            method: "POST",
            headers: {
                "Content-Type": "application/json"
            },
        });
        const result = await res.json();

        if (res.ok && result.success) {
            window.location.href = "/checkout";
        } else {
            Swal.fire({
                icon: 'error',
                title: 'Checkout Blocked',
                text: result.message || "Some products are unavailable",
            });
        }

    } catch (err) {
        Swal.fire({
            icon: 'error',
            title: 'Error',
            text: "Something went wrong!",
        });
    }
});


