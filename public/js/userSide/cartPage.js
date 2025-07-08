async function updateQuantity(productId) {
    const quantityInput = document.getElementById(`quantity-${productId}`);
    const newQuantity = parseInt(quantityInput?.value || 1);
    const increaseButton = document.querySelector(`.cart-qty-button[onclick="increaseQuantity('${productId}')"]`);
    const decreaseButton = document.querySelector(`.cart-qty-button[onclick="decreaseQuantity('${productId}')"]`);

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

            const price = parseFloat(quantityInput.dataset.price);
            const salePrice = parseFloat(quantityInput.dataset.salePrice);
            const hasOffer = quantityInput.dataset.hasOffer === 'true';

            const subtotal = price * data.newQuantity;
            const originalSubtotal = salePrice * data.newQuantity;

            const subtotalElement = document.getElementById(`subtotal-${productId}`);
            if (subtotalElement) {
                subtotalElement.innerHTML = hasOffer
                    ? `₹${subtotal.toLocaleString('en-IN')} <span class="text-muted" style="text-decoration: line-through; font-size: 0.85em;">₹${originalSubtotal.toLocaleString('en-IN')}</span>`
                    : `₹${originalSubtotal.toLocaleString('en-IN')}`;
            }

            recalculateCartTotals(); // Recalculate total, discount, grand total
        } else {
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

function recalculateCartTotals() {
    const items = document.querySelectorAll('[data-product-id]');
    let total = 0;
    let discount = 0;

    items.forEach(item => {
        const productId = item.getAttribute('data-product-id');
        const qty = parseInt(document.getElementById(`quantity-${productId}`).value || 1);
        const price = parseFloat(document.getElementById(`quantity-${productId}`).dataset.price);
        const salePrice = parseFloat(document.getElementById(`quantity-${productId}`).dataset.salePrice);
        const hasOffer = document.getElementById(`quantity-${productId}`).dataset.hasOffer === 'true';

        total += price * qty;
        if (hasOffer) discount += (salePrice - price) * qty;
    });

    document.getElementById('orderTotal').textContent = `₹${(total + discount).toLocaleString('en-IN')}`;
    document.getElementById('totalDiscount').textContent = `-₹${discount.toLocaleString('en-IN')}`;
    document.getElementById('grandTotal').textContent = `₹${total.toLocaleString('en-IN')}`;
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
      const response = await fetch('/cart/remove', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ productId }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.message || 'Failed to remove item from cart.');
      }

      // Remove the item from the DOM
      const itemElement = document.querySelector(`.cart-product-item[data-product-id="${productId}"]`);
      if (itemElement) {
        itemElement.remove();
      } else {
        console.warn(`Item with productId ${productId} not found in DOM.`);
      }

      const productContainer = document.querySelector('.cart-items-container');
      const remainingItems = document.querySelectorAll('.cart-product-item');

      if (!data.cart || data.cart.totalItems === 0) {
        // Cart is empty
        if (productContainer) {
          productContainer.innerHTML = '<div class="cart-empty-message">Your cart is empty.</div>';
        }
        updateOrderSummary({ newTotalPrice: 0, totalDiscount: 0 });
      } else {
        // Update cart totals with server-provided data
        updateOrderSummary({
          newTotalPrice: data.cart.totalPrice || 0,
          totalDiscount: data.cart.totalDiscount || 0
        });
      }

      Swal.fire({
        icon: 'success',
        title: 'Removed!',
        text: 'Item removed from cart!',
        timer: 1500,
        showConfirmButton: false
      });

    } catch (error) {
      console.error('Error removing item:', error);
      Swal.fire({
        icon: 'error',
        title: 'Removal Failed',
        text: error.message || 'An error occurred while removing the item.',
        confirmButtonText: 'OK'
      });
    }
  }
}

function updateOrderSummary({ newTotalPrice, totalDiscount }) {
  const subtotalElement = document.querySelector('.cart-price-subtotal');
  const discountElement = document.querySelector('.cart-price-discount');
  const totalElement = document.querySelector('.cart-grand-total');

  if (subtotalElement) {
    subtotalElement.textContent = `₹${newTotalPrice.toFixed(2)}`;
  }
  if (discountElement) {
    discountElement.textContent = totalDiscount ? `-₹${totalDiscount.toFixed(2)}` : '₹0.00';
  }
  if (totalElement) {
    totalElement.textContent = `₹${(newTotalPrice - (totalDiscount || 0)).toFixed(2)}`;
  }
}

document.addEventListener('DOMContentLoaded', function () {
    document.querySelectorAll('.cart-qty-input').forEach(input => {
        input.addEventListener('input', function () {
            const productId = this.id.replace('quantity-', '');
            updateQuantity(productId);
        });
    });

    document.getElementById("checkoutBtn").addEventListener("click", async () => {
        try {
            const res = await fetch("/checkout", {
                method: "POST",
                headers: { "Content-Type": "application/json" }
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
});
