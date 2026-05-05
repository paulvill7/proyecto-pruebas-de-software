/* ═══════════════════════════════════════
   642 APP — Express Server
   ═══════════════════════════════════════ */

require('dotenv').config();
const express = require('express');
const cors    = require('cors');
const path    = require('path');

const authMiddleware = require('./middleware/auth');

const app  = express();
const PORT = process.env.PORT || 3000;

// ── Middleware ──
app.use(cors());
app.use(express.json());

// ── Public routes (no auth) ──
app.use('/api/auth', require('./routes/auth'));

// ── Protected routes ──
app.use('/api/dashboard',  authMiddleware, require('./routes/dashboard'));
app.use('/api/clientes',   authMiddleware, require('./routes/clientes'));
app.use('/api/inventario',  authMiddleware, require('./routes/inventario'));
app.use('/api/reservas',   authMiddleware, require('./routes/reservas'));
app.use('/api/turnos',     authMiddleware, require('./routes/turnos'));
app.use('/api/facturas',   authMiddleware, require('./routes/facturas'));

// ── Serve React client in production ──
if (process.env.NODE_ENV === 'production') {
  app.use(express.static(path.join(__dirname, '..', 'client', 'dist')));
  app.get('*', (req, res) => {
    res.sendFile(path.join(__dirname, '..', 'client', 'dist', 'index.html'));
  });
}

// ── Start (only when run directly, not when required by tests) ──
if (require.main === module) {
  app.listen(PORT, () => {
    console.log(`\n🚀 642 APP Server running on http://localhost:${PORT}`);
    console.log(`📡 API available at http://localhost:${PORT}/api\n`);
  });
}

module.exports = app;
