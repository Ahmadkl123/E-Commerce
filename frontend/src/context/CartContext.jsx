import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { api } from '../api/client';
import { useAuth } from './AuthContext';

const EMPTY_CART = { items: [], total: 0 };
const CartContext = createContext(null);

export function CartProvider({ children }) {
  const { user } = useAuth();
  const [cart, setCart] = useState(EMPTY_CART);
  const [loading, setLoading] = useState(false);
  const [drawerOpen, setDrawerOpen] = useState(false);

  const refresh = useCallback(async () => {
    if (!user) {
      setCart(EMPTY_CART);
      return;
    }
    setLoading(true);
    try {
      setCart(await api.getCart());
    } finally {
      setLoading(false);
    }
  }, [user]);

  useEffect(() => {
    refresh().catch(() => setCart(EMPTY_CART));
  }, [refresh]);

  const add = useCallback(
    async (productId, quantity = 1) => {
      await api.addToCart(productId, quantity);
      await refresh();
    },
    [refresh]
  );

  const remove = useCallback(
    async (productId) => {
      await api.removeFromCart(productId);
      await refresh();
    },
    [refresh]
  );

  // The backend only supports "add N" and "remove item", so lowering a
  // quantity is done by removing the line and re-adding the new amount.
  const setQuantity = useCallback(
    async (productId, quantity) => {
      const current = cart.items.find((i) => i.productId === productId)?.quantity ?? 0;
      if (quantity === current) return;
      if (quantity > current) {
        await api.addToCart(productId, quantity - current);
      } else {
        await api.removeFromCart(productId);
        if (quantity > 0) await api.addToCart(productId, quantity);
      }
      await refresh();
    },
    [cart.items, refresh]
  );

  const checkout = useCallback(async () => {
    const result = await api.checkout();
    await refresh();
    return result.order;
  }, [refresh]);

  const value = useMemo(
    () => ({
      items: cart.items,
      total: cart.total,
      count: cart.items.reduce((sum, i) => sum + i.quantity, 0),
      loading,
      drawerOpen,
      openDrawer: () => setDrawerOpen(true),
      closeDrawer: () => setDrawerOpen(false),
      add,
      remove,
      setQuantity,
      checkout,
      refresh,
    }),
    [cart, loading, drawerOpen, add, remove, setQuantity, checkout, refresh]
  );

  return <CartContext.Provider value={value}>{children}</CartContext.Provider>;
}

export function useCart() {
  return useContext(CartContext);
}
