/**
 * routes/index.js
 * Todas as rotas da API
 */

const express = require('express');
const router = express.Router();
const ag = require('../controllers/agendamentosController');
const cl = require('../controllers/clientesController');

// Agendamentos
router.get('/agendamentos', ag.listar);
router.get('/agendamentos/disponibilidade', ag.disponibilidade);
router.get('/agendamentos/stats', ag.stats);
router.post('/agendar', ag.criar);
router.put('/agendamento/:id', ag.atualizar);
router.delete('/agendamento/:id', ag.cancelar);

// Clientes
router.get('/clientes', cl.listar);
router.get('/cliente/:id/historico', cl.historico);

module.exports = router;
