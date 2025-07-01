document.addEventListener('DOMContentLoaded', () => {
  // Elements
  const elements = {
    showMoreBtn: document.getElementById('checkout-show-more-addresses'),
    showMoreText: document.getElementById('checkout-show-more-text'),
    showLessText: document.getElementById('checkout-show-less-text'),
    addressCards: document.querySelectorAll('.checkout-address-card'),
    placeOrderBtn: document.getElementById('place-order'),
    paymentRadios: document.getElementsByName('paymentMethod'),
    addressRadios: document.getElementsByName('checkout-address'),
    checkoutData: document.getElementById('checkout-data'),
    totalAmountInput: document.getElementById('totalAmount'),
    cartItemsInput: document.getElementById('cart-items'),
    productIdInput: document.getElementById('productId'),
  };

  // Check if critical elements exist
  if (!elements.placeOrderBtn || !elements.checkoutData || !elements.totalAmountInput || !elements.cartItemsInput) {
    console.error('Critical DOM elements are missing.');
    Swal?.fire({
      icon: 'error',
      title: 'Setup Error',
      text: 'Required elements are missing. Please contact support.',
    });
    return;
  }

  // Initialize variables
  const razorpayKey = elements.checkoutData.dataset.keyId;
  const rawAmount = elements.totalAmountInput.value || '0';
  const totalAmount = parseFloat(rawAmount.replace(/[₹,]/g, '').trim());
  let cartItems;
  const productId = elements.productIdInput?.value;

  // Validate cartItems JSON
  try {
    cartItems = JSON.parse(elements.cartItemsInput.value);
    if (!Array.isArray(cartItems) || cartItems.length === 0) {
      throw new Error('Cart is empty or invalid.');
    }
  } catch (error) {
    console.error('Error parsing cart items:', error);
    Swal?.fire({
      icon: 'error',
      title: 'Invalid Cart',
      text: 'Cart data is invalid. Please refresh and try again.',
    });
    return;
  }

  // Check if Razorpay is loaded
  if (!window.Razorpay && elements.paymentRadios.some(radio => radio.value === 'Razorpay')) {
    console.error('Razorpay library is not loaded.');
    Swal?.fire({
      icon: 'error',
      title: 'Setup Error',
      text: 'Payment service is unavailable. Please try another method.',
    });
    return;
  }

  let isExpanded = false;

  // Show/hide addresses
  if (elements.showMoreBtn) {
    elements.showMoreBtn.addEventListener('click', () => {
      isExpanded = !isExpanded;
      elements.addressCards.forEach((card, index) => {
        if (index >= 2) {
          card.classList.toggle('checkout-address-hidden', !isExpanded);
        }
      });
      elements.showMoreText.style.display = isExpanded ? 'none' : 'inline-flex';
      elements.showLessText.style.display = isExpanded ? 'inline-flex' : 'none';
    });
  }

  // Address selection
  elements.addressCards.forEach(card => {
    card.addEventListener('click', (e) => {
      if (e.target.classList.contains('checkout-edit-link')) return;
      const radioButton = card.querySelector('.checkout-address-radio');
      if (radioButton) {
        radioButton.checked = true;
        elements.addressCards.forEach(c => c.classList.remove('checkout-address-selected'));
        card.classList.add('checkout-address-selected');
      }
    });
  });

  // Payment method selection
  document.querySelectorAll('.checkout-payment-option').forEach(option => {
    option.addEventListener('click', () => {
      const radioButton = option.querySelector('.checkout-payment-radio');
      if (radioButton) {
        radioButton.checked = true;
        document.querySelectorAll('.checkout-payment-option').forEach(opt => {
          opt.classList.remove('checkout-payment-selected');
        });
        option.classList.add('checkout-payment-selected');
      }
    });
  });

  // Place order
  elements.placeOrderBtn.addEventListener('click', async (e) => {
    e.preventDefault();

    // Get selected values
    const selectedAddressId = document.querySelector('input[name="checkout-address"]:checked')?.value;
    const selectedPaymentMethod = document.querySelector('input[name="paymentMethod"]:checked')?.value;

    // Validate inputs
    if (!selectedAddressId) {
      Swal?.fire({
        icon: 'warning',
        title: 'No Address Selected',
        text: 'Please select a delivery address.',
      });
      return;
    }

    if (!selectedPaymentMethod) {
      Swal?.fire({
        icon: 'warning',
        title: 'No Payment Method Selected',
        text: 'Please select a payment method.',
      });
      return;
    }

    if (isNaN(totalAmount) || totalAmount <= 0) {
      Swal?.fire({
        icon: 'error',
        title: 'Invalid Amount',
        text: 'Order amount is invalid.',
      });
      return;
    }

    try {
 if (selectedPaymentMethod === 'Razorpay') {
  const response = await fetch('/payment/create-order', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      amount: totalAmount,
      addressId: selectedAddressId,
      cartItems,
    }),
  });

  if (!response.ok) {
    throw new Error(`HTTP error: ${response.status}`);
  }

  const data = await response.json();
  if (!data.success || !data.order?.id) {
    throw new Error(data.message || 'Failed to create Razorpay order.');
  }

  const options = {
    key: razorpayKey,
    amount: data.order.amount,
    currency: 'INR',
    name: 'Lapkart',
    description: 'Order Payment',
    order_id: data.order.id,
    handler: async (response) => {
      try {
        const verifyResponse = await fetch('/payment/verify', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            razorpay_order_id: response.razorpay_order_id,
            razorpay_payment_id: response.razorpay_payment_id,
            razorpay_signature: response.razorpay_signature,
            orderId: data.order.dbOrderId,
          }),
        });

        const verifyData = await verifyResponse.json();
        if (verifyData.success) {
          Swal.fire({
            icon: 'success',
            title: 'Payment Successful',
            text: 'Your order has been placed successfully!',
            confirmButtonText: 'Go to Orders',
          }).then(() => {
            window.location.href = `/order/${verifyData.orderId}`;
          });
        } else {
          throw new Error(verifyData.message || 'Payment verification failed.');
        }
      } catch (error) {
        Swal.fire({
          icon: 'error',
          title: 'Payment Failed',
          text: error.message || 'Something went wrong.',
        });
      }
    },
    modal: {
      ondismiss: () => {
        Swal.fire({
          icon: 'info',
          title: 'Payment Cancelled',
          text: 'You cancelled the payment process.',
          showConfirmButton: false,
          timer: 1500,
        });

        setTimeout(() => {
          const query = new URLSearchParams({
            reason: 'payment_cancelled',
            orderId: data.order.dbOrderId || '',
          }).toString();
          window.location.href = `/payment/payment-failed?${query}`;
        }, 1600);
      },
    },
    prefill: {
      name: '',
      email: '',
      contact: '',
    },
    theme: {
      color: '#1a73e8',
    },
  };

  const rzp = new Razorpay(options);

  rzp.on('payment.failed', (error) => {
    const errorDetails = error.error || {};
    const metadata = errorDetails.metadata || {};
    const errorCode = errorDetails.code || 'UNKNOWN_ERROR';
    const paymentId = metadata.payment_id || 'N/A';
    const reason = errorDetails.reason || 'input_validation_failed';
    const amount=totalAmount

    Swal.fire({
      icon: 'error',
      title: 'Payment Failed',
      text: 'Redirecting to failure page...',
      showConfirmButton: false,
      timer: 1500,
    });

    setTimeout(() => {
      const query = new URLSearchParams({
        errorCode,
        reason,
        paymentId,
        orderId: data.order.dbOrderId || '',
        amount,
      }).toString();
      console.log()
      window.location.href = `/payment/payment-failed?${query}`;
    }, 1600);
  });

  rzp.open();
}

else if (selectedPaymentMethod === 'Wallet') {
  try {
    const response = await fetch('/payment/order/pay-with-wallet', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
 body: JSON.stringify({
    amount: totalAmount,
    addressId: selectedAddressId,
    cartItems,
  }),

    });

    const contentType = response.headers.get("content-type");
    if (!contentType || !contentType.includes("application/json")) {
      const html = await response.text();
      throw new Error("Server returned unexpected content:\n" + html.slice(0, 200));
    }

    const data = await response.json();
    if (!data.success) {
      throw new Error(data.message || 'Failed to process wallet payment.');
    }

    Swal?.fire({
      icon: 'success',
      title: 'Payment Successful',
      text: 'Your order has been placed successfully using your wallet!',
      confirmButtonText: 'Go to Orders',
    }).then(() => {
      window.location.href = `/order/${data.orderId}`;
    });

  } catch (error) {
    console.error('Checkout error:', error);
    Swal?.fire({
      icon: 'error',
      title: 'Error',
      text: error.message || 'Something went wrong during wallet checkout.',
    });
  }
}
else if (selectedPaymentMethod === 'Cash on Delivery') {
  try {
    const response = await fetch('/payment/verify-cod', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
 body: JSON.stringify({
    amount: totalAmount,
    paymentMethod:selectedPaymentMethod,
    addressId: selectedAddressId,
    cartItems,
  }),

    });

    const contentType = response.headers.get("content-type");
    if (!contentType || !contentType.includes("application/json")) {
      const html = await response.text();
      throw new Error("Server returned unexpected content:\n" + html.slice(0, 200));
    }

    const data = await response.json();
    if (!data.success) {
      throw new Error(data.message || 'Failed to process cash on delivery payment.');
    }

    Swal?.fire({
      icon: 'success',
      title: 'Payment Successful',
      text: 'Your order has been placed successfully using cash on delivery!',
      confirmButtonText: 'Go to Orders',
    }).then(() => {
      window.location.href = `/order/${data.orderId}`;
    });

  } catch (error) {
    console.error('Checkout error:', error);
    Swal?.fire({
      icon: 'error',
      title: 'Error',
      text: error.message || 'Something went wrong during cash on delivery checkout.',
    });
  }
}


    } catch (error) {
      console.error('Checkout error:', error);
      Swal?.fire({
        icon: 'error',
        title: 'Error',
        text: error.message || 'Something went wrong during checkout.',
      });
    }
  });
});

let appliedCoupon = null;
let originalTotal = 0;

window.addEventListener('DOMContentLoaded', () => {
  const totalElement = document.querySelector('.checkout-grand-total span:last-child');
  if (totalElement) {
    originalTotal = parseFloat(totalElement.textContent.replace(/[₹,]/g, '')) || 0;
  } else {
    console.error('Total element not found');
  }

  setupCouponApplication();

  const viewBtn = document.getElementById('checkout-view-coupons');
  const closeBtn = document.getElementById('close-coupon-modal');
  const modal = document.getElementById('coupon-modal');
  if (viewBtn && modal && closeBtn) {
    console.log('Modal elements found:', { viewBtn, modal, closeBtn });
    viewBtn.addEventListener('click', () => {
      console.log('View coupons button clicked');
      loadCoupons();
      modal.style.display = 'block';
      document.body.style.overflow = 'hidden';
    });

    closeBtn.addEventListener('click', () => {
      console.log('Close modal clicked');
      modal.style.display = 'none';
      document.body.style.overflow = 'auto';
    });

    window.addEventListener('click', (e) => {
      if (e.target === modal) {
        console.log('Clicked outside modal');
        modal.style.display = 'none';
        document.body.style.overflow = 'auto';
      }
    });

    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape' && modal.style.display === 'block') {
        console.log('Escape key pressed');
        modal.style.display = 'none';
        document.body.style.overflow = 'auto';
      }
    });
  } else {
    console.error('Modal elements missing:', { viewBtn, modal, closeBtn });
  }
});

function setupCouponApplication() {
  const applyBtn = document.getElementById('checkout-apply-coupon');
  const couponInput = document.getElementById('checkout-coupon-input');

  if (applyBtn) {
    applyBtn.addEventListener('click', () => {
      const code = couponInput.value.trim();
      if (code) applyCoupon(code);
      else Swal.fire({ icon: 'warning', title: 'No Coupon Code', text: 'Please enter a coupon code.' });
    });
  }

  if (couponInput) {
    couponInput.addEventListener('keypress', (e) => {
      if (e.key === 'Enter') {
        const code = couponInput.value.trim();
        if (code) applyCoupon(code);
      }
    });
  }
}

async function applyCoupon(couponCode) {
  try {
    const response = await fetch('/coupons/apply', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ code: couponCode, totalAmount: originalTotal })
    });

    const data = await response.json();

    if (!response.ok || !data.success) throw new Error(data.message || 'Failed to apply coupon');

    appliedCoupon = data.couponId;
    console.log('Set appliedCoupon:', appliedCoupon);
    updatePriceDisplay(data.discount, data.finalAmount);
    updateCouponButton(couponCode, true);

    Swal.fire({ icon: 'success', title: 'Coupon Applied!', text: `You saved ₹${data.discount}` });
  } catch (err) {
    console.error('Apply coupon error:', err);
    Swal.fire({ icon: 'error', title: 'Error', text: err.message || 'Failed to apply coupon' });
  }
}

function updatePriceDisplay(discountAmount, finalAmount) {
  const breakdown = document.querySelector('.checkout-price-breakdown');
  const totalEl = document.querySelector('.checkout-grand-total span:last-child');

  let couponRow = document.getElementById('coupon-discount-row');
  if (discountAmount > 0) {
    if (!couponRow) {
      couponRow = document.createElement('div');
      couponRow.className = 'checkout-price-row';
      couponRow.id = 'coupon-discount-row';
      breakdown.appendChild(couponRow);
    }
    couponRow.innerHTML = `
      <span class="checkout-price-label">Coupon Discount</span>
      <span class="checkout-price-value checkout-savings">- ₹${discountAmount.toFixed(2)}</span>
    `;
  } else if (couponRow) {
    couponRow.remove();
  }

  if (totalEl) totalEl.textContent = `₹${finalAmount.toFixed(2)}`;

  const totalInput = document.getElementById('totalAmount');
  if (totalInput) totalInput.value = finalAmount;
}

function updateCouponButton(code, applied) {
  const applyBtn = document.getElementById('checkout-apply-coupon');
  const input = document.getElementById('checkout-coupon-input');

  applyBtn.replaceWith(applyBtn.cloneNode(true));
  const newApplyBtn = document.getElementById('checkout-apply-coupon');

  if (applied) {
    newApplyBtn.textContent = 'Remove';
    newApplyBtn.classList.add('remove-coupon');
    input.disabled = true;
    input.value = code;
    newApplyBtn.addEventListener('click', removeCoupon);
  } else {
    newApplyBtn.textContent = 'Apply';
    newApplyBtn.classList.remove('remove-coupon');
    input.disabled = false;
    input.value = '';
    newApplyBtn.addEventListener('click', () => {
      const code = input.value.trim();
      if (code) applyCoupon(code);
      else Swal.fire({ icon: 'warning', title: 'No Coupon Code', text: 'Please enter a coupon code.' });
    });
  }
}

async function removeCoupon() {
  const applyBtn = document.getElementById('checkout-apply-coupon');
  if (!applyBtn) {
    console.error('Apply button not found');
    return;
  }
  applyBtn.disabled = true;
  applyBtn.textContent = 'Removing...';
  console.log('Removing coupon with ID:', appliedCoupon);

  try {
    if (!appliedCoupon) {
      throw new Error('No coupon applied');
    }
    const response = await fetch('/coupons/remove', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ couponId: appliedCoupon })
    });

    const data = await response.json();
    console.log('Remove coupon response:', data);
    if (!response.ok || !data.success) {
      throw new Error(data.message || 'Failed to remove coupon');
    }

    appliedCoupon = null;
    updatePriceDisplay(0, originalTotal);
    updateCouponButton('', false);

    const input = document.getElementById('checkout-coupon-input');
    if (input) {
      input.disabled = false;
      input.value = '';
    }

    const couponRow = document.getElementById('coupon-discount-row');
    if (couponRow) couponRow.remove();

    Swal.fire({ icon: 'info', title: 'Coupon Removed', text: 'Coupon removed successfully' });
  } catch (err) {
    console.error('Remove coupon error:', err);
    Swal.fire({ icon: 'error', title: 'Error', text: err.message || 'Failed to remove coupon' });
  } finally {
    applyBtn.disabled = false;
    applyBtn.textContent = 'Apply';
  }
}

async function loadCoupons() {
  console.log('Loading coupons...');
  try {
    const res = await fetch('/coupons/available', {
      method: 'GET',
      headers: { 'Content-Type': 'application/json' }
    });
    const data = await res.json();
    console.log('Coupons response:', data);
    if (data.success) {
      displayCoupons(data.coupons);
    } else {
      throw new Error(data.message || 'No coupons found');
    }
  } catch (err) {
    console.error('Load coupons error:', err);
    Swal.fire({ icon: 'error', title: 'Error', text: err.message || 'Failed to load coupons' });
  }
}

function displayCoupons(coupons) {
  const list = document.getElementById('available-coupon-list');
  list.innerHTML = '';

  if (!coupons || coupons.length === 0) {
    list.innerHTML = '<li class="no-coupons">No coupons available.</li>';
    return;
  }

  coupons.forEach(coupon => {
    const li = document.createElement('li');
    li.className = 'coupon-item';
    li.innerHTML = `
      <div class="coupon-card">
        <div class="coupon-header">
          <div class="coupon-code">${coupon.couponCode}</div>
          <div class="coupon-discount">₹${coupon.offerPrice} OFF</div>
        </div>
        <div class="coupon-details">
          <p>${coupon.description || 'Use this coupon to save more'}</p>
          <div>Min order: ₹${coupon.minPurchase}</div>
          <div>Valid till: ${new Date(coupon.validUpto).toLocaleDateString()}</div>
        </div>
        <button class="apply-coupon-btn" onclick="applyCouponFromModal('${coupon.couponCode}')">Apply</button>
      </div>
    `;
    list.appendChild(li);
  });
}

function applyCouponFromModal(code) {
  console.log('Applying coupon from modal:', code);
  const input = document.getElementById('checkout-coupon-input');
  const modal = document.getElementById('coupon-modal');
  if (input && modal) {
    input.value = code;
    modal.style.display = 'none';
    document.body.style.overflow = 'auto';
    applyCoupon(code);
  } else {
    console.error('Coupon input or modal not found');
    Swal.fire({ icon: 'error', title: 'Error', text: 'Unable to apply coupon' });
  }
}