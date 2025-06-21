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
        // Create Razorpay order
        const response = await fetch('/payment/create-order', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ amount: totalAmount, addressId: selectedAddressId, cartItems, productId }),
        });

        if (!response.ok) {
          throw new Error(`HTTP error: ${response.status}`);
        }

        const data = await response.json();
        if (!data.success || !data.order?.id) {
          throw new Error(data.message || 'Failed to create order.');
        }

        // Razorpay options setup
        const options = {
          key: razorpayKey,
          amount: data.order.amount,
          currency: 'INR',
          name: 'Lapkart',
          description: 'Order Payment',
          order_id: data.order.id,
          handler: async (response) => {
            try {
              // Verify payment and save order
              const verifyResponse = await fetch('/payment/verify', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                  razorpay_order_id: response.razorpay_order_id,
                  razorpay_payment_id: response.razorpay_payment_id,
                  razorpay_signature: response.razorpay_signature,
                  cartItems,
                  addressId: selectedAddressId,
                  amount: totalAmount,
                  productId,
                }),
              });

              if (!verifyResponse.ok) {
                throw new Error(`HTTP error: ${verifyResponse.status}`);
              }

              const verifyData = await verifyResponse.json();
              if (verifyData.success) {
                Swal?.fire({
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
              Swal?.fire({
                icon: 'error',
                title: 'Payment Failed',
                text: error.message || 'Something went wrong during verification.',
              });
            }
          },
          prefill: { name: '', email: '', contact: '' },
          theme: { color: '#1a73e8' },
          modal: {
            ondismiss: () => {
              Swal?.fire({
                icon: 'info',
                title: 'Payment Cancelled',
                text: 'You cancelled the payment process. Please try again.',
              });
            },
          },
        };

        const rzp = new window.Razorpay(options);

        rzp.on('payment.failed', (error) => {
          const errorDetails = error.error || {};
          const metadata = errorDetails.metadata || {};
          const errorCode = errorDetails.code || 'UNKNOWN_ERROR';
          const paymentId = metadata.payment_id || 'N/A';
          const reason = errorDetails.reason || 'Unknown reason';

          Swal?.fire({
            icon: 'error',
            title: 'Payment Failed',
            text: 'Redirecting to failure page...',
            showConfirmButton: false,
            timer: 1500,
          });

          setTimeout(() => {
            const query = new URLSearchParams({
              errorCode,
              productId: productId || 'N/A',
              paymentId,
              reason,
            }).toString();

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

    // ✅ Show success alert and redirect
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