import { useState } from 'react';
import { Link } from 'react-router-dom';
import { CATEGORIES } from '../catalog';

export default function Footer() {
  const [email, setEmail] = useState('');
  const [subscribed, setSubscribed] = useState(false);

  return (
    <footer className="site-footer">
      <div className="container footer-grid">
        <div className="footer-newsletter">
          <h3>Stay in the loop</h3>
          <p>New arrivals, restocks and the occasional offer. No spam.</p>
          {subscribed ? (
            <p className="footer-thanks">Thanks, you're on the list.</p>
          ) : (
            <form
              className="newsletter-form"
              onSubmit={(e) => {
                e.preventDefault();
                setSubscribed(true);
              }}
            >
              <input
                type="email"
                required
                placeholder="Email address"
                aria-label="Email address"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
              />
              <button className="btn btn-light">Subscribe</button>
            </form>
          )}
        </div>

        <div>
          <h4>Shop</h4>
          <ul>
            <li>
              <Link to="/shop">All products</Link>
            </li>
            {CATEGORIES.map((c) => (
              <li key={c.slug}>
                <Link to={`/shop?category=${c.slug}`}>{c.label}</Link>
              </li>
            ))}
          </ul>
        </div>

        <div>
          <h4>Help</h4>
          <ul>
            <li>
              <Link to="/account">Order status</Link>
            </li>
            <li>
              <span>Shipping &amp; delivery</span>
            </li>
            <li>
              <span>Returns &amp; exchanges</span>
            </li>
            <li>
              <span>Warranty</span>
            </li>
          </ul>
        </div>

        <div>
          <h4>Company</h4>
          <ul>
            <li>
              <span>About us</span>
            </li>
            <li>
              <span>Careers</span>
            </li>
            <li>
              <span>Contact</span>
            </li>
          </ul>
        </div>
      </div>

      <div className="container footer-bottom">
        <span>© {new Date().getFullYear()} Kestrel. All rights reserved.</span>
        <span>Privacy · Terms</span>
      </div>
    </footer>
  );
}
