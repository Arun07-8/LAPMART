document.addEventListener('DOMContentLoaded', () => {
  // Elements
  const showMoreBtn = document.getElementById('checkout-show-more-addresses');
  const showMoreText = document.getElementById('checkout-show-more-text');
  const showLessText = document.getElementById('checkout-show-less-text');
  const addressCards = document.querySelectorAll('.checkout-address-card');
  const placeOrderBtn = document.getElementById('place-order');
  const paymentRadios = document.getElementsByName('paymentMethod');
  const addressRadios = document.getElementsByName('checkout-address');
  const razorpayKey = document.getElementById('checkout-data')?.dataset.keyId;
  const rawAmount = document.getElementById('totalAmount')?.value || '0';
  const totalAmount = parseFloat(rawAmount.replace(/[₹,]/g, '').trim());
  let isExpanded = false;

  // Show/hide addresses
  if (showMoreBtn) {
    showMoreBtn.addEventListener('click', () => {
      isExpanded = !isExpanded;
      addressCards.forEach((card, index) => {
        if (index >= 2) {
          card.classList.toggle('checkout-address-hidden', !isExpanded);
        }
      });
      showMoreText.style.display = isExpanded ? 'none' : 'inline-flex';
      showLessText.style.display = isExpanded ? 'inline-flex' : 'none';
    });
  }

  // Address selection
  addressCards.forEach(card => {
    card.addEventListener('click', (e) => {
      if (e.target.classList.contains('checkout-edit-link')) return;
      const radioButton = card.querySelector('.checkout-address-radio');
      if (radioButton) {
        radioButton.checked = true;
        addressCards.forEach(c => c.classList.remove('checkout-address-selected'));
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
  if (placeOrderBtn) {
    placeOrderBtn.addEventListener('click', async (e) => {
      e.preventDefault();

      // Get selected values
      const selectedAddressId = document.querySelector('input[name="checkout-address"]:checked')?.value;
      const selectedPaymentMethod = document.querySelector('input[name="paymentMethod"]:checked')?.value;

      // Validate inputs
      if (!selectedAddressId) {
        Swal.fire({
          icon: 'warning',
          title: 'No Address Selected',
          text: 'Please select a delivery address.',
        });
        return;
      }

      if (!selectedPaymentMethod) {
        Swal.fire({
          icon: 'warning',
          title: 'No Payment Method Selected',
          text: 'Please select a payment method.',
        });
        return;
      }

      if (isNaN(totalAmount) || totalAmount <= 0) {
        Swal.fire({
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
            body: JSON.stringify({ amount: totalAmount, addressId: selectedAddressId }),
          });

          const data = await response.json();
          if (!data.success) {
            throw new Error(data.message || 'Failed to create order.');
          }

          // Initialize Razorpay
          const options = {
            key: razorpayKey,
            amount: data.order.amount,
            currency: 'INR',
            name: 'LAPKART',
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
                    addressId: selectedAddressId,
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
                  text: error.message || 'Something went wrong during verification.',
                });
              }
            },
            prefill: { name: '', email: '', contact: '' },
            theme: { color: '#1a73e8' },
            modal: {
              ondismiss: () => {
                Swal.fire({
                  icon: 'info',
                  title: 'Payment Cancelled',
                  text: 'You cancelled the payment process. Please try again.',
                });
              },
            },
          };

   
const rzp = new Razorpay(options);

// Handle payment failure and redirect to custom failure page
rzp.on('payment.failed', (error) => {
  const errorDetails = error.error || {};
  const metadata = errorDetails.metadata || {};

  const errorCode = errorDetails.code || 'UNKNOWN_ERROR';
  const paymentId = metadata.payment_id || 'N/A';
  const fullOrderId = metadata.order_id || 'N/A';
  const shortOrderId = fullOrderId?.slice(-24) || 'N/A';
  const amount = data.order.amount / 100; // ₹ conversion
  const status = errorDetails.step || 'Payment failed';
  const reason = errorDetails.reason || 'Unknown reason';

  // Optional alert
  Swal.fire({
    icon: 'error',
    title: 'Payment Failed',
    text: 'Redirecting to failure page...',
    showConfirmButton: false,
    timer: 1500
  });

  // Redirect with all fields as query string
  setTimeout(() => {
    const query = new URLSearchParams({
      errorCode,
      orderId: shortOrderId,
      fullOrderId,
      paymentId,
      amount,
      status,
      reason
    }).toString();

    window.location.href = `/payment/payment-failed?${query}`;
  }, 1600);
});

rzp.open();

        } else {
       const response = await fetch('/payment/verify-cod', {
           method: 'POST',
           headers: { 'Content-Type': 'application/json' },
           body: JSON.stringify({
           amount: totalAmount,
           addressId: selectedAddressId,
           paymentMethod: selectedPaymentMethod,
      }),
});

const data = await response.json();

if (!response.ok || !data.success) {
  // Show error Swal with message from backend
  Swal.fire({
    icon: 'error',
    title: 'Order Failed',
    text: data.message || 'Failed to place order.',
    confirmButtonText: 'OK',
  });
  return; // stop further execution
}

// Success Swal and redirect
Swal.fire({
  icon: 'success',
  title: 'Cash on Delivery Successful',
  text: 'Your order has been placed successfully!',
  confirmButtonText: 'Go to Orders',
}).then(() => {
  window.location.href = `/order/${data.orderId}`;
});

        }
      } catch (error) {
        Swal.fire({
          icon: 'error',
          title: 'Error',
          text: error.message || 'Something went wrong during checkout.',
        });
      }
    });
  }
});