import { Elements, PaymentElement, useElements, useStripe } from '@stripe/react-stripe-js';
import { loadStripe } from '@stripe/stripe-js';
import { useEffect, useState } from 'react';
import { api } from '../../api/client';
import { LockIcon } from '../../components/Icons';
import { formatPrice } from '../../utils';

// Real card / Apple Pay / Google Pay payments through Stripe.
// Card details are typed into Stripe's own secure fields (an iframe served by
// Stripe), so they never touch this site or its backend.

const stripePromises = new Map();
function getStripe(publishableKey) {
  if (!stripePromises.has(publishableKey)) stripePromises.set(publishableKey, loadStripe(publishableKey));
  return stripePromises.get(publishableKey);
}

const APPEARANCE = {
  theme: 'stripe',
  variables: {
    colorPrimary: '#141414',
    colorText: '#141414',
    colorDanger: '#a52a2a',
    fontFamily: "'Instrument Sans', -apple-system, 'Segoe UI', Helvetica, Arial, sans-serif",
    borderRadius: '0px',
    spacingUnit: '4px',
  },
  rules: {
    '.Input': { borderColor: '#cfccc5', boxShadow: 'none', padding: '13px 14px' },
    '.Input:focus': { borderColor: '#141414', boxShadow: 'none' },
    '.Label': { fontWeight: '500', fontSize: '13.5px' },
    '.Tab': { borderColor: '#cfccc5', boxShadow: 'none' },
    '.Tab--selected': { borderColor: '#141414', boxShadow: '0 0 0 1px #141414' },
  },
};

const FONTS = [
  { cssSrc: 'https://fonts.googleapis.com/css2?family=Instrument+Sans:wght@400;500;600&display=swap' },
];

function PayForm({ total, onPaid }) {
  const stripe = useStripe();
  const elements = useElements();
  const [ready, setReady] = useState(false);
  const [paying, setPaying] = useState(false);
  const [error, setError] = useState('');

  async function handleSubmit(e) {
    e.preventDefault();
    if (!stripe || !elements) return;
    setError('');
    setPaying(true);

    const { error: stripeError, paymentIntent } = await stripe.confirmPayment({
      elements,
      // Only used by payment methods that must leave the page (e.g. some bank
      // redirects); cards and wallets finish here without a redirect.
      confirmParams: { return_url: `${window.location.origin}/checkout` },
      redirect: 'if_required',
    });

    if (stripeError) {
      setError(stripeError.message || 'The payment could not be completed.');
      setPaying(false);
      return;
    }
    if (paymentIntent?.status !== 'succeeded') {
      setError(
        paymentIntent?.status === 'processing'
          ? 'Your payment is processing. Please check your account in a few minutes.'
          : 'The payment was not completed. Please try again.'
      );
      setPaying(false);
      return;
    }

    try {
      await onPaid({ method: 'stripe', paymentIntentId: paymentIntent.id });
    } catch (err) {
      setError(err.message);
      setPaying(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} noValidate>
      {error && <div className="alert alert-error">{error}</div>}
      <div className="stripe-element">
        <PaymentElement
          options={{ layout: 'tabs', wallets: { applePay: 'auto', googlePay: 'auto' } }}
          onReady={() => setReady(true)}
          onLoadError={(e) => setError(e.error?.message || 'The payment form could not be loaded.')}
        />
        {!ready && <div className="skeleton stripe-skeleton" aria-label="Loading payment form" />}
      </div>
      <button className="btn btn-block pay-button" disabled={!stripe || !ready || paying}>
        <LockIcon size={16} />
        {paying ? 'Processing payment…' : `Pay ${formatPrice(total)}`}
      </button>
      <p className="muted small summary-note">
        Payments are processed securely by Stripe. Your card details are never stored on our servers.
      </p>
    </form>
  );
}

export default function StripePayment({ publishableKey, total, onPaid }) {
  const [clientSecret, setClientSecret] = useState(null);
  const [error, setError] = useState('');

  // A new PaymentIntent is created for the current cart total.
  useEffect(() => {
    let cancelled = false;
    setClientSecret(null);
    setError('');
    getStripe(publishableKey)
      .then((stripe) => {
        if (!stripe) throw new Error();
      })
      .catch(() => {
        if (!cancelled) setError('The secure payment form could not be loaded. Check your connection and try again.');
      });
    api.createStripeIntent().then(
      (res) => !cancelled && setClientSecret(res.clientSecret),
      (err) => !cancelled && setError(err.message)
    );
    return () => {
      cancelled = true;
    };
  }, [publishableKey, total]);

  if (error) return <div className="alert alert-error">{error}</div>;
  if (!clientSecret) return <div className="skeleton stripe-skeleton" aria-label="Loading payment form" />;

  return (
    <Elements
      key={clientSecret}
      stripe={getStripe(publishableKey)}
      options={{ clientSecret, appearance: APPEARANCE, fonts: FONTS }}
    >
      <PayForm total={total} onPaid={onPaid} />
    </Elements>
  );
}
