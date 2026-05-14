/**
 * controllers/clientesController.js
 */

const { query } = require('../database/db');

function listar(req, res) {
  try {
    const clientes = query(`
      SELECT c.*, 
        COUNT(a.id) as total_agendamentos,
        SUM(CASE WHEN a.status = 'concluido' THEN a.preco ELSE 0 END) as total_gasto,
        MAX(a.data) as ultimo_corte
      FROM clientes c
      LEFT JOIN agendamentos a ON a.cliente_id = c.id
      GROUP BY c.id
      ORDER BY c.nome ASC
    `);
    res.json({ success: true, data: clientes });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
}

function historico(req, res) {
  const { id } = req.params;
  try {
    const cliente = query('SELECT * FROM clientes WHERE id = ?', [id]);
    if (cliente.length === 0) return res.status(404).json({ success: false, error: 'Cliente não encontrado' });

    const agendamentos = query(
      `SELECT * FROM agendamentos WHERE cliente_id = ? ORDER BY data DESC, horario DESC`,
      [id]
    );
    res.json({ success: true, data: { cliente: cliente[0], agendamentos } });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
}

module.exports = { listar, historico };
