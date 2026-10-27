import { PayPalButtons, PayPalScriptProvider, usePayPalScriptReducer } from '@paypal/react-paypal-js';
import { useState } from 'react';
import { api } from '../../api/client';

// Real PayPal Checkout. The buyer logs in and approves in PayPal's own window;
// the backend then checks the amount and captures (charges) the payment.

function Buttons({ total, onPaid }) {
  const [{ isPending, isRejected }] = usePayPalScriptReducer();
  const [error, setError] = useState('');
  const [finishing, setFinishing] = useState(false);

  if (isRejected) {
    return <div className="alert alert-error">PayPal could not be loaded. Check your connection and try again.</div>;
  }

  return (
    <div>
      {error && <div className="alert alert-error">{error}</div>}
      {finishing && <p className="muted small">Confirming your PayPal payment…</p>}
      {isPending && <div className="skeleton paypal-skeleton" aria-label="Loading PayPal" />}
      <div className="paypal-buttons" hidden={finishing}>
        <PayPalButtons
          style={{ layout: 'vertical', shape: 'rect', label: 'pay', height: 48 }}
          forceReRender={[total]}
          createOrder={async () => {
            setError('');
            const order = await api.createPaypalOrder();
            return order.id;
          }}
          onApprove={async (data) => {
            setFinishing(true);
            try {
              await onPaid({ method: 'paypal', paypalOrderId: data.orderID });
            } catch (err) {
              setError(err.message);
              setFinishing(false);
            }
          }}
          onCancel={() => setError('PayPal payment was cancelled. You have not been charged.')}
          onError={(err) => setError(err?.message || 'PayPal could not complete the payment.')}
        />
      </div>
      <p className="muted small summary-note">
        You will log in to PayPal to approve the payment. You can pay with your PayPal balance, bank or a
        card linked to PayPal.
      </p>
    </div>
  );
}

export default function PayPalPayment({ clientId, total, onPaid }) {
  return (
    <PayPalScriptProvider options={{ clientId, currency: 'USD', intent: 'capture' }}>
      <Buttons total={total} onPaid={onPaid} />
    </PayPalScriptProvider>
  );
}
