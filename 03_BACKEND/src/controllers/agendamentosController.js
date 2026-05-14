/**
 * controllers/agendamentosController.js
 * Toda a lógica de negócio de agendamentos
 */

const { query, run } = require('../database/db');

// Tabela de preços por serviço
const PRECOS = {
  'Corte Degradê': 45,
  'Corte Social': 40,
  'Corte Navalhado': 50,
  'Corte + Barba': 70,
  'Barba Completa': 35,
  'Sobrancelha': 25,
  'Pigmentação': 90,
  'Relaxamento': 80,
};

// GET /agendamentos - lista com filtros opcionais
function listar(req, res) {
  const { data, status } = req.query;
  let sql = `
    SELECT a.*, c.nome as cliente_nome, c.email as cliente_email, c.telefone as cliente_telefone
    FROM agendamentos a
    JOIN clientes c ON a.cliente_id = c.id
  `;
  const params = [];
  const where = [];

  if (data) { where.push('a.data = ?'); params.push(data); }
  if (status) { where.push('a.status = ?'); params.push(status); }
  if (where.length) sql += ' WHERE ' + where.join(' AND ');
  sql += ' ORDER BY a.data DESC, a.horario ASC';

  try {
    const rows = query(sql, params);
    res.json({ success: true, data: rows });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
}

// GET /agendamentos/disponibilidade?data=YYYY-MM-DD
function disponibilidade(req, res) {
  const { data } = req.query;
  if (!data) return res.status(400).json({ success: false, error: 'Data obrigatória' });

  const HORARIOS = ['09:00','09:30','10:00','10:30','11:00','11:30',
                    '14:00','14:30','15:00','15:30','16:00','16:30','17:00','17:30'];

  try {
    const ocupados = query(
      `SELECT horario FROM agendamentos WHERE data = ? AND status IN ('agendado','confirmado')`,
      [data]
    ).map(r => r.horario);

    const resultado = HORARIOS.map(h => ({
      horario: h,
      disponivel: !ocupados.includes(h)
    }));

    res.json({ success: true, data: resultado });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
}

// POST /agendar
function criar(req, res) {
  const { nome, email, telefone, servico, data, horario } = req.body;

  // Validações
  if (!nome || !email || !servico || !data || !horario) {
    return res.status(400).json({ success: false, error: 'Todos os campos são obrigatórios' });
  }

  // Validar formato de email
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return res.status(400).json({ success: false, error: 'Email inválido' });
  }

  // Verificar se data não é passado
  const dataAgendamento = new Date(data + 'T00:00:00');
  const hoje = new Date(); hoje.setHours(0, 0, 0, 0);
  if (dataAgendamento < hoje) {
    return res.status(400).json({ success: false, error: 'Não é possível agendar para datas passadas' });
  }

  try {
    // Verificar disponibilidade
    const ocupado = query(
      `SELECT id FROM agendamentos WHERE data = ? AND horario = ? AND status IN ('agendado','confirmado')`,
      [data, horario]
    );
    if (ocupado.length > 0) {
      return res.status(409).json({ success: false, error: 'Horário já ocupado. Escolha outro horário.' });
    }

    // Criar ou buscar cliente
    let cliente = query('SELECT * FROM clientes WHERE email = ?', [email]);
    let clienteId;

    if (cliente.length === 0) {
      clienteId = run(
        'INSERT INTO clientes (nome, email, telefone) VALUES (?, ?, ?)',
        [nome, email, telefone || '']
      );
    } else {
      clienteId = cliente[0].id;
      // Atualizar nome/telefone se necessário
      run('UPDATE clientes SET nome = ?, telefone = ? WHERE id = ?', [nome, telefone || cliente[0].telefone, clienteId]);
    }

    const preco = PRECOS[servico] || 0;

    // Criar agendamento
    const agendamentoId = run(
      `INSERT INTO agendamentos (cliente_id, servico, data, horario, status, preco) VALUES (?, ?, ?, ?, 'agendado', ?)`,
      [clienteId, servico, data, horario, preco]
    );

    const agendamento = query(
      `SELECT a.*, c.nome as cliente_nome FROM agendamentos a JOIN clientes c ON a.cliente_id = c.id WHERE a.id = ?`,
      [agendamentoId]
    )[0];

    res.status(201).json({
      success: true,
      message: 'Agendamento realizado com sucesso!',
      data: agendamento
    });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
}

// PUT /agendamento/:id - atualizar status
function atualizar(req, res) {
  const { id } = req.params;
  const { status } = req.body;

  const statusValidos = ['agendado', 'confirmado', 'concluido', 'cancelado'];
  if (!statusValidos.includes(status)) {
    return res.status(400).json({ success: false, error: 'Status inválido' });
  }

  try {
    const existe = query('SELECT id FROM agendamentos WHERE id = ?', [id]);
    if (existe.length === 0) return res.status(404).json({ success: false, error: 'Agendamento não encontrado' });

    run('UPDATE agendamentos SET status = ? WHERE id = ?', [status, id]);
    res.json({ success: true, message: `Agendamento ${status} com sucesso.` });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
}

// DELETE /agendamento/:id - cancelar
function cancelar(req, res) {
  const { id } = req.params;
  try {
    const existe = query('SELECT id FROM agendamentos WHERE id = ?', [id]);
    if (existe.length === 0) return res.status(404).json({ success: false, error: 'Agendamento não encontrado' });

    run("UPDATE agendamentos SET status = 'cancelado' WHERE id = ?", [id]);
    res.json({ success: true, message: 'Agendamento cancelado. Horário liberado.' });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
}

// GET /agendamentos/stats - dados para o dashboard
function stats(req, res) {
  try {
    const totalClientes = query('SELECT COUNT(*) as total FROM clientes')[0].total;
    const totalAgendamentos = query("SELECT COUNT(*) as total FROM agendamentos WHERE status != 'cancelado'")[0].total;
    const faturamentoTotal = query("SELECT SUM(preco) as total FROM agendamentos WHERE status = 'concluido'")[0].total || 0;

    const faturamento30dias = query(`
      SELECT SUM(preco) as total FROM agendamentos 
      WHERE status = 'concluido' AND data >= date('now', '-30 days')
    `)[0].total || 0;

    const por_dia = query(`
      SELECT data, COUNT(*) as total FROM agendamentos
      WHERE status != 'cancelado' AND data >= date('now', '-14 days')
      GROUP BY data ORDER BY data ASC
    `);

    const por_servico = query(`
      SELECT servico, COUNT(*) as total FROM agendamentos
      WHERE status != 'cancelado'
      GROUP BY servico ORDER BY total DESC
    `);

    const crescimento_clientes = query(`
      SELECT substr(criado_em, 1, 7) as mes, COUNT(*) as total
      FROM clientes GROUP BY mes ORDER BY mes ASC LIMIT 12
    `);

    res.json({
      success: true,
      data: { totalClientes, totalAgendamentos, faturamentoTotal, faturamento30dias, por_dia, por_servico, crescimento_clientes }
    });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
}

module.exports = { listar, disponibilidade, criar, atualizar, cancelar, stats };
