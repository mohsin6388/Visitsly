import { showDialog } from '../components/ui/index.jsx';

/** Razorpay Checkout wrapped in a promise: resolves {status: 'success'|'dismissed'}, rejects on failure. */
export function openCheckout(options) {
  return new Promise((resolve, reject) => {
    const rzp = new window.Razorpay({
      ...options,
      theme: { color: '#059669' },
      handler: (resp) => resolve({ status: 'success', resp }),
      modal: { ondismiss: () => resolve({ status: 'dismissed' }), confirm_close: true },
    });
    rzp.on('payment.failed', (resp) => reject(Object.assign(new Error(resp?.error?.description || 'Payment failed'), { reason: resp?.error?.reason, paymentFailed: true })));
    rzp.open();
  });
}

export function paymentFailedDialog(err) {
  showDialog({
    tone: 'error',
    title: 'Payment failed ❌',
    message: `${err.message || 'The bank declined the payment.'}\n\nIf money was deducted, it is refunded automatically in 5–7 days. Try another card or UPI.`,
  });
}
