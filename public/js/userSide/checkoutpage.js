document.addEventListener('DOMContentLoaded', () => {
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
    appliedCouponIdInput: document.getElementById('applied-coupon-id'),
    couponInput: document.getElementById('checkout-coupon-input'),
    applyBtn: document.getElementById('checkout-apply-coupon'),
  };

  if (!elements.placeOrderBtn || !elements.checkoutData || !elements.totalAmountInput || !elements.cartItemsInput) {
    console.error('Critical DOM elements are missing.');
    Swal?.fire({
      icon: 'error',
      title: 'Setup Error',
      text: 'Required elements are missing. Please contact support.',
    });
    return;
  }

  const razorpayKey = elements.checkoutData.dataset.keyId;
  const rawAmount = elements.totalAmountInput.value || '0';
  let totalAmount = parseFloat(rawAmount.replace(/[₹,]/g, '').trim());
  let originalTotal = totalAmount;
  let cartItems;
  const productId = elements.productIdInput?.value;
  let appliedCoupon = elements.appliedCouponIdInput?.value || null;
  const appliedCouponCode = elements.couponInput?.value || '';
  let discountAmount = parseFloat(elements.checkoutData.dataset.discountAmount || '0');

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

  if (!window.Razorpay && elements.paymentRadios.some(radio => radio.value === 'Razorpay')) {
    console.error('Razorpay library is not loaded.');
    Swal?.fire({
      icon: 'error',
      title: 'Setup Error',
      text: 'Payment service is unavailable. Please try another method.',
    });
    return;
  }

  if (appliedCoupon && appliedCouponCode) {
    updateCouponButton(appliedCouponCode, true);
    updatePriceDisplay(discountAmount, totalAmount);
  }

  let isExpanded = false;

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

  elements.placeOrderBtn.addEventListener('click', async (e) => {
    e.preventDefault();

    const selectedAddressId = document.querySelector('input[name="checkout-address"]:checked')?.value;
    const selectedPaymentMethod = document.querySelector('input[name="paymentMethod"]:checked')?.value;

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
            productId,
            couponId: appliedCoupon,
          }),
        });

        const data = await response.json();
        if (!data.success || !data.order?.id) {
          throw new Error(data.message || 'Failed to create Razorpay order.');
        }

        const options = {
          key: razorpayKey,
          amount: data.order.amount,
          currency: 'INR',
          name: 'Lapmart',
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
                  couponId: appliedCoupon,
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
          prefill: { name: '', email: '', contact: '' },
          theme: { color: '#1a73e8' },
        };

        const rzp = new Razorpay(options);
        rzp.on('payment.failed', (error) => {
          const errorDetails = error.error || {};
          const metadata = errorDetails.metadata || {};
          const errorCode = errorDetails.code || 'UNKNOWN_ERROR';
          const reason = errorDetails.reason || 'input_validation_failed';

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
              orderId: data.order.dbOrderId || '',
              amount: totalAmount,
            }).toString();
            window.location.href = `/payment/payment-failed?${query}`;
          }, 1600);
        });

        rzp.open();
      } else if (selectedPaymentMethod === 'Wallet') {
        const response = await fetch('/payment/order/pay-with-wallet', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            amount: totalAmount,
            addressId: selectedAddressId,
            cartItems,
            couponId: appliedCoupon,
          }),
        });

        const contentType = response.headers.get('content-type');
        if (!contentType || !contentType.includes('application/json')) {
          const html = await response.text();
          throw new Error('Server returned unexpected content:\n' + html.slice(0, 200));
        }

        const data = await response.json();
        if (!data.success) {
          throw new Error(data.message || 'Failed to process wallet payment.');
        }

        Swal?.fire({
          icon: 'success',
          title: 'Payment Successful',
          text: 'Your order has been placed successfully using your wallet!',
        }).then(() => {
          window.location.href = `/order/${data.orderId}`;
        });
      } else if (selectedPaymentMethod === 'Cash on Delivery') {
        const response = await fetch('/payment/verify-cod', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            amount: totalAmount,
            addressId: selectedAddressId,
            cartItems,
            paymentMethod: selectedPaymentMethod,
            couponId: appliedCoupon,
          }),
        });

        const contentType = response.headers.get('content-type');
        if (!contentType || !contentType.includes('application/json')) {
          const html = await response.text();
          throw new Error('Server returned unexpected content:\n' + html.slice(0, 200));
        }

        const data = await response.json();
        if (!data.success) {
          throw new Error(data.message || 'Failed to process cash on delivery payment.');
        }

        Swal?.fire({
          icon: 'success',
          title: 'Order Placed',
          text: 'Your order has been placed successfully using cash on delivery!',
          confirmButtonText: 'Go to Orders',
        }).then(() => {
          window.location.href = `/order/${data.orderId}`;
        });
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

  const totalElement = document.querySelector('.checkout-grand-total span:last-child');
  if (totalElement) {
    originalTotal = parseFloat(totalElement.textContent.replace(/[₹,]/g, '')) || totalAmount;
  } else {
    console.error('Total element not found');
  }

  setupCouponApplication();

  const viewBtn = document.getElementById('checkout-view-coupons');
  const closeBtn = document.getElementById('close-coupon-modal');
  const modal = document.getElementById('coupon-modal');
  if (viewBtn && modal && closeBtn) {
    viewBtn.addEventListener('click', () => {
      loadCoupons();
      modal.style.display = 'block';
      document.body.style.overflow = 'hidden';
    });

    closeBtn.addEventListener('click', () => {
      modal.style.display = 'none';
      document.body.style.overflow = 'auto';
    });

    window.addEventListener('click', (e) => {
      if (e.target === modal) {
        modal.style.display = 'none';
        document.body.style.overflow = 'auto';
      }
    });

    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape' && modal.style.display === 'block') {
        modal.style.display = 'none';
        document.body.style.overflow = 'auto';
      }
    });
  } else {
    console.error('Modal elements missing:', { viewBtn, modal, closeBtn });
  }

  function setupCouponApplication() {
    if (elements.applyBtn) {
      elements.applyBtn.addEventListener('click', () => {
        if (elements.applyBtn.textContent === 'Remove') {
          removeCoupon();
        } else {
          const code = elements.couponInput.value.trim();
          if (code) applyCoupon(code);
          else Swal.fire({ icon: 'warning', title: 'No Coupon Code', text: 'Please enter a coupon code.' });
        }
      });
    }

    if (elements.couponInput) {
      elements.couponInput.addEventListener('keypress', (e) => {
        if (e.key === 'Enter') {
          const code = elements.couponInput.value.trim();
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
        body: JSON.stringify({ code: couponCode, totalAmount: originalTotal }),
      });

      const data = await response.json();

      if (!response.ok || !data.success) {
        throw new Error(data.message || 'Failed to apply coupon');
      }

    

      appliedCoupon = data.couponId;
   
      totalAmount = data.newTotal;
      updatePriceDisplay(data.discount, data.newTotal);
      updateCouponButton(data.couponCode, true);

      elements.appliedCouponIdInput.value = data.couponId;
      elements.totalAmountInput.value = data.newTotal;

      Swal.fire({
        icon: 'success',
        title: 'Coupon Applied',
        text: `Coupon ${couponCode} applied successfully!`,
      });
    } catch (err) {
      console.error('Apply coupon error:', err);
      Swal.fire({ icon: 'error', title: 'Error', text: err.message || 'Failed to apply coupon' });
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

    try {
      if (!appliedCoupon) {
        throw new Error('No coupon applied');
      }
      const response = await fetch('/coupons/remove', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ couponId: appliedCoupon }),
      });

      const data = await response.json();
      if (!response.ok || !data.success) {
        throw new Error(data.message || 'Failed to remove coupon');
      }
 
      updatePriceDisplay(0, originalTotal);
      updateCouponButton('', false);

      elements.appliedCouponIdInput.value = '';
      elements.totalAmountInput.value = originalTotal;

      Swal.fire({  icon: 'success', title: 'Coupon Removed', text: 'Coupon removed successfully' });
    } catch (err) {
      console.error('Remove coupon error:', err);
      Swal.fire({ icon: 'error', title: 'Error', text: err.message || 'Failed to remove coupon' });
    } finally {
      applyBtn.disabled = false;
      applyBtn.textContent = 'Apply';
    }
  }

  function updatePriceDisplay(discount, finalAmount) {
    const breakdown = document.querySelector('.checkout-price-breakdown');
    const totalEl = document.querySelector('.checkout-grand-total span:last-child');
    const grandTotalEl = document.querySelector('.checkout-grand-total1 span:last-child');

    let couponRow = document.getElementById('coupon-discount-row');
    if (discount > 0) {
      if (!couponRow) {
        couponRow = document.createElement('div');
        couponRow.className = 'checkout-price-row';
        couponRow.id = 'coupon-discount-row';
        breakdown.insertBefore(couponRow, breakdown.children[1]);
      }
      couponRow.innerHTML = `
        <span class="checkout-price-label">Coupon Discount</span>
        <span class="checkout-price-value checkout-savings">- ₹${discount.toFixed(2)}</span>
      `;
    } else if (couponRow) {
      couponRow.remove();
    }

    if (totalEl) totalEl.textContent = `₹${finalAmount.toFixed(2)}`;
    if (grandTotalEl) grandTotalEl.textContent = `₹${finalAmount.toFixed(2)}`;
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

  async function loadCoupons() {
    try {
      const res = await fetch('/coupons/available', {
        method: 'GET',
        headers: { 'Content-Type': 'application/json' },
      });
      const data = await res.json();
  console.log(data.coupons,"data")
      if (data.coupons) {
        console.log(data.coupons,"hlkooooooooo")
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
    console.log(coupons)
    const list = document.getElementById('available-coupon-list');

    if (!list) {
      console.error('Coupon list element not found');
      return;
    }
    list.innerHTML = '';

    if (!coupons || coupons.length === 0) {
      list.innerHTML = '<li class="no-coupons">No coupons available.</li>';
      return;
    }
console.log(coupons,"heloooooo")
coupons.forEach(coupon => {
  const li = document.createElement('li');
  li.className = 'coupon-item';

  // ✅ Format date in dd/mm/yyyy
  const validUptoDate = new Date(coupon.validUpto);
  const formattedDate = `${validUptoDate.getDate().toString().padStart(2, '0')}/${(validUptoDate.getMonth() + 1).toString().padStart(2, '0')}/${validUptoDate.getFullYear()}`;

  li.innerHTML = `
    <div class="coupon-card">
      <div class="coupon-header">
        <div class="coupon-code">${coupon.couponCode}</div>
        <div class="coupon-discount">₹${coupon.offerPrice.toFixed(2)} OFF</div>
      </div>
      <div class="coupon-details">
        <p class="coupon-description">${coupon.description || 'Use this coupon to save more'}</p>
        <div class="coupon-terms">
          <span class="coupon-min-order">Min order: ₹${coupon.minPurchase.toFixed(2)}</span>
          <span class="coupon-max-discount">Max discount: ₹${coupon.maxDiscount?.toFixed(2) || coupon.offerPrice.toFixed(2)}</span>
        </div>
        <div class="coupon-validity">Valid till: ${formattedDate}</div>
      </div>
      <button class="apply-coupon-btn" onclick="applyCouponFromModal('${coupon.couponCode}')">Apply Coupon</button>
    </div>
  `;

  list.appendChild(li);
});


    const modalBody = document.querySelector('.modal-body');
    if (modalBody) {
      modalBody.scrollTop = 0;
    }
  }

  window.applyCouponFromModal = function (code) {
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
  };
});