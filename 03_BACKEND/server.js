/**
 * server.js
 * Servidor principal - Cauã Barbearia
 * Inicializa DB e sobe Express
 */

const express = require('express');
const cors = require('cors');
const path = require('path');
const { getDb } = require('./src/database/db');
const routes = require('./src/routes');

const app = express();
const PORT = process.env.PORT || 3001;

// Middlewares
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Servir arquivos estáticos (frontend e admin)
app.use('/site', express.static(path.join(__dirname, '../01_SITE_CLIENTE')));
app.use('/painel', express.static(path.join(__dirname, '../02_DASHBOARD_ADMIN')));

// Rota raiz redireciona para o site
app.get('/', (req, res) => {
  res.redirect('/site/index.html');
});

// Rotas da API com prefixo /api
app.use('/api', routes);

// Health check
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// Inicializar banco e subir servidor
(async () => {
  try {
    await getDb();
    console.log('✅ Banco de dados inicializado com sucesso');

    app.listen(PORT, () => {
      console.log(`\n🔥 Cauã Barbearia - Sistema rodando!`);
      console.log(`📡 API:      http://localhost:${PORT}/api`);
      console.log(`🌐 Site:     http://localhost:${PORT}/site/index.html`);
      console.log(`🔐 Admin:    http://localhost:${PORT}/painel/admin.html`);
      console.log(`\nCredenciais admin: admin / caua2024\n`);
    });
  } catch (err) {
    console.error('❌ Erro ao inicializar:', err);
    process.exit(1);
  }
})();
