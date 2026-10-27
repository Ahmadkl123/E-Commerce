const pool = require('../db');

// Maximum stored size of an uploaded photo (base64 data URL), about 3 MB of text.
const MAX_IMAGE_LENGTH = 3 * 1024 * 1024;
const DATA_URL_RE = /^data:image\/(png|jpe?g|webp|gif);base64,[A-Za-z0-9+/=]+$/;

/**
 * Validates the optional image_url field of a product.
 * Accepts a site path (/images/...), an http(s) URL, or an uploaded photo
 * sent as a base64 data URL. Returns { value } or { error }.
 * value is undefined when the field was not sent, null when it was cleared.
 */
function parseImage(imageUrl) {
  if (imageUrl === undefined) return { value: undefined };
  if (imageUrl === null) return { value: null };
  if (typeof imageUrl !== 'string') return { error: 'Image must be a string.' };

  const value = imageUrl.trim();
  if (value === '') return { value: null };
  if (value.length > MAX_IMAGE_LENGTH) {
    return { error: 'Image is too large. Please use a picture under 2 MB.' };
  }
  if (value.startsWith('data:')) {
    return DATA_URL_RE.test(value)
      ? { value }
      : { error: 'Image must be a PNG, JPEG, WebP or GIF picture.' };
  }
  if (value.startsWith('/') || /^https?:\/\//i.test(value)) return { value };
  return { error: 'Image must be an uploaded picture, a /path or an http(s) URL.' };
}

/**
 * GET /api/products
 * Retrieves all products from the catalog, with optional search filtering.
 * Query Params: ?search=keyword (matches product name or description)
 */
async function getAllProducts(req, res, next) {
  try {
    const { search } = req.query;

    let sql = 'SELECT id, name, description, price, stock, image_url, created_at FROM products';
    const params = [];

    // Parameterized search query prevents SQL injection attacks
    if (search && search.trim() !== '') {
      sql += ' WHERE name LIKE ? OR description LIKE ?';
      const searchPattern = `%${search.trim()}%`;
      params.push(searchPattern, searchPattern);
    }

    sql += ' ORDER BY id ASC';

    const [rows] = await pool.query(sql, params);

    // Ensure price is formatted as a number in the JSON response
    const products = rows.map((p) => ({
      ...p,
      price: Number(p.price)
    }));

    return res.status(200).json(products);
  } catch (error) {
    next(error);
  }
}

/**
 * GET /api/products/:id
 * Retrieves a single product by its primary key ID.
 */
async function getProductById(req, res, next) {
  try {
    const productId = parseInt(req.params.id, 10);

    // Validate that the ID parameter is a positive integer
    if (isNaN(productId) || productId <= 0) {
      return res.status(400).json({ error: 'Invalid product ID. Must be a positive integer.' });
    }

    // Parameterized query ensures safe lookup
    const [rows] = await pool.query(
      'SELECT id, name, description, price, stock, image_url, created_at FROM products WHERE id = ?',
      [productId]
    );

    if (rows.length === 0) {
      return res.status(404).json({ error: 'Product not found' });
    }

    const product = {
      ...rows[0],
      price: Number(rows[0].price)
    };

    return res.status(200).json(product);
  } catch (error) {
    next(error);
  }
}

/**
 * POST /api/products (Admin only)
 * Creates a new product in the catalog.
 */
async function createProduct(req, res, next) {
  try {
    const { name, description, price, stock, image_url } = req.body;

    if (!name || typeof name !== 'string' || name.trim() === '') {
      return res.status(400).json({ error: 'Product name is required.' });
    }

    const parsedPrice = parseFloat(price);
    if (isNaN(parsedPrice) || parsedPrice <= 0) {
      return res.status(400).json({ error: 'Price must be a positive number.' });
    }

    const parsedStock = parseInt(stock, 10);
    if (isNaN(parsedStock) || parsedStock < 0) {
      return res.status(400).json({ error: 'Stock must be a non-negative integer.' });
    }

    const image = parseImage(image_url);
    if (image.error) {
      return res.status(400).json({ error: image.error });
    }
    const trimmedImageUrl = image.value ?? null;

    const [result] = await pool.query(
      'INSERT INTO products (name, description, price, stock, image_url) VALUES (?, ?, ?, ?, ?)',
      [name.trim(), description || null, parsedPrice, parsedStock, trimmedImageUrl]
    );

    return res.status(201).json({
      message: 'Product created successfully',
      product: {
        id: result.insertId,
        name: name.trim(),
        description: description || null,
        price: Number(parsedPrice.toFixed(2)),
        stock: parsedStock,
        image_url: trimmedImageUrl
      }
    });
  } catch (error) {
    next(error);
  }
}

/**
 * PUT /api/products/:id (Admin only)
 * Updates an existing product in the catalog.
 */
async function updateProduct(req, res, next) {
  try {
    const productId = parseInt(req.params.id, 10);
    if (isNaN(productId) || productId <= 0) {
      return res.status(400).json({ error: 'Invalid product ID.' });
    }

    const { name, description, price, stock, image_url } = req.body;

    if (!name || typeof name !== 'string' || name.trim() === '') {
      return res.status(400).json({ error: 'Product name is required.' });
    }

    const parsedPrice = parseFloat(price);
    if (isNaN(parsedPrice) || parsedPrice <= 0) {
      return res.status(400).json({ error: 'Price must be a positive number.' });
    }

    const parsedStock = parseInt(stock, 10);
    if (isNaN(parsedStock) || parsedStock < 0) {
      return res.status(400).json({ error: 'Stock must be a non-negative integer.' });
    }

    const image = parseImage(image_url);
    if (image.error) {
      return res.status(400).json({ error: image.error });
    }
    // undefined means "not sent": keep the current image untouched.
    const trimmedImageUrl = image.value;

    let result;
    if (trimmedImageUrl !== undefined) {
      [result] = await pool.query(
        'UPDATE products SET name = ?, description = ?, price = ?, stock = ?, image_url = ? WHERE id = ?',
        [name.trim(), description || null, parsedPrice, parsedStock, trimmedImageUrl, productId]
      );
    } else {
      [result] = await pool.query(
        'UPDATE products SET name = ?, description = ?, price = ?, stock = ? WHERE id = ?',
        [name.trim(), description || null, parsedPrice, parsedStock, productId]
      );
    }

    if (result.affectedRows === 0) {
      return res.status(404).json({ error: 'Product not found.' });
    }

    return res.status(200).json({
      message: 'Product updated successfully',
      product: {
        id: productId,
        name: name.trim(),
        description: description || null,
        price: Number(parsedPrice.toFixed(2)),
        stock: parsedStock,
        ...(trimmedImageUrl !== undefined ? { image_url: trimmedImageUrl } : {})
      }
    });
  } catch (error) {
    next(error);
  }
}

/**
 * DELETE /api/products/:id (Admin only)
 * Deletes a product from the catalog.
 */
async function deleteProduct(req, res, next) {
  try {
    const productId = parseInt(req.params.id, 10);
    if (isNaN(productId) || productId <= 0) {
      return res.status(400).json({ error: 'Invalid product ID.' });
    }

    const [result] = await pool.query(
      'DELETE FROM products WHERE id = ?',
      [productId]
    );

    if (result.affectedRows === 0) {
      return res.status(404).json({ error: 'Product not found.' });
    }

    return res.status(200).json({
      message: 'Product deleted successfully'
    });
  } catch (error) {
    next(error);
  }
}

module.exports = {
  getAllProducts,
  getProductById,
  createProduct,
  updateProduct,
  deleteProduct
};
