import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../api/client';
import { CATEGORIES } from '../catalog';
import { LockIcon, ReturnIcon, ShieldIcon, TruckIcon } from '../components/Icons';
import ProductCard from '../components/ProductCard';
import { FREE_SHIPPING_THRESHOLD } from '../utils';

const SERVICES = [
  { icon: TruckIcon, title: 'Free shipping', text: `On every order over $${FREE_SHIPPING_THRESHOLD}` },
  { icon: ReturnIcon, title: '30-day returns', text: 'Changed your mind? Send it back' },
  { icon: ShieldIcon, title: '2-year warranty', text: 'Included on everything we sell' },
  { icon: LockIcon, title: 'Secure checkout', text: 'Encrypted from cart to confirmation' },
];

export default function Home() {
  const [products, setProducts] = useState([]);
  const [error, setError] = useState('');

  useEffect(() => {
    api.getProducts().then(setProducts, (err) => setError(err.message));
  }, []);

  const featured = products.filter((p) => p.stock > 0).slice(0, 4);
  const newest = [...products].sort((a, b) => b.id - a.id).slice(0, 4);

  return (
    <>
      <section className="hero">
        <div className="hero-copy">
          <p className="eyebrow">The desk edit</p>
          <h1>Better tools for the way you work.</h1>
          <p className="hero-text">
            Keyboards, audio and accessories chosen for everyday use, with free shipping over $
            {FREE_SHIPPING_THRESHOLD} and a two-year warranty on every order.
          </p>
          <div className="hero-actions">
            <Link to="/shop" className="btn btn-dark">
              Shop all products
            </Link>
            <Link to="/shop?category=audio" className="btn btn-outline">
              Shop audio
            </Link>
          </div>
        </div>
        <div className="hero-media">
          <img src="/images/site/hero.jpg" alt="Minimal white desk with a keyboard and drawing tablet" />
        </div>
      </section>

      <section className="container section">
        <div className="section-head">
          <h2>Shop by category</h2>
        </div>
        <div className="category-grid">
          {CATEGORIES.map((c) => (
            <Link key={c.slug} to={`/shop?category=${c.slug}`} className="category-tile">
              <img src={c.image} alt="" loading="lazy" />
              <span>{c.label}</span>
            </Link>
          ))}
        </div>
      </section>

      <section className="container section">
        <div className="section-head">
          <h2>Bestsellers</h2>
          <Link to="/shop" className="link-underline">
            View all
          </Link>
        </div>
        {error && <div className="alert alert-error">{error}</div>}
        <div className="product-grid">
          {featured.map((p) => (
            <ProductCard key={p.id} product={p} />
          ))}
        </div>
      </section>

      <section className="editorial">
        <div className="editorial-media">
          <img src="/images/site/editorial.jpg" alt="Laptop on a wooden desk next to a plant" loading="lazy" />
        </div>
        <div className="editorial-copy">
          <p className="eyebrow">Built to last</p>
          <h2>Fewer, better things.</h2>
          <p>
            We test everything we stock for a month before it goes on sale. If it doesn't hold up to daily
            use, it doesn't make the cut. That's why every product ships with a two-year warranty.
          </p>
          <Link to="/shop" className="btn btn-dark">
            Explore the range
          </Link>
        </div>
      </section>

      {newest.length > 0 && (
        <section className="container section">
          <div className="section-head">
            <h2>New arrivals</h2>
            <Link to="/shop?sort=newest" className="link-underline">
              View all
            </Link>
          </div>
          <div className="product-grid">
            {newest.map((p) => (
              <ProductCard key={p.id} product={p} />
            ))}
          </div>
        </section>
      )}

      <section className="services">
        <div className="container services-grid">
          {SERVICES.map(({ icon: Icon, title, text }) => (
            <div key={title} className="service">
              <Icon size={26} />
              <div>
                <strong>{title}</strong>
                <span>{text}</span>
              </div>
            </div>
          ))}
        </div>
      </section>
    </>
  );
}
