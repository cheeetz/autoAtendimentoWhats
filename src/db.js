import { DatabaseSync } from 'node:sqlite';
import { mkdirSync } from 'node:fs';
import { dirname } from 'node:path';
import { chaveTelefone } from './util.js';

const ESQUEMA = `
CREATE TABLE IF NOT EXISTS pedidos (
  id            TEXT PRIMARY KEY,
  numero        TEXT,
  cliente_nome  TEXT,
  telefone      TEXT,
  telefone_chave TEXT,
  pagamento     TEXT,   -- pendente | pago | reembolsado | cancelado
  envio         TEXT,   -- nao_enviado | enviado | entregue
  cancelado     INTEGER NOT NULL DEFAULT 0,
  rastreio_codigo TEXT,
  rastreio_url  TEXT,
  total         TEXT,
  criado_em     TEXT,
  atualizado_em TEXT,
  produto       TEXT,   -- pedidos feitos pelo WhatsApp
  endereco      TEXT,
  origem        TEXT    -- 'whatsapp' = pedido criado pelo bot; nulo = veio da plataforma
);
CREATE INDEX IF NOT EXISTS idx_pedidos_tel ON pedidos (telefone_chave);
CREATE INDEX IF NOT EXISTS idx_pedidos_num ON pedidos (numero);

CREATE TABLE IF NOT EXISTS conversas (
  jid           TEXT PRIMARY KEY,
  estado        TEXT NOT NULL,      -- menu | catalogo | produto:<n> | compra:<passo>:<n> | aguardando_pedido | atendente | humano | encerrada
  invalidas     INTEGER NOT NULL DEFAULT 0,
  atualizado_em INTEGER NOT NULL,   -- epoch ms
  pausado_ate   INTEGER NOT NULL DEFAULT 0,
  dados         TEXT                -- JSON com o que o cliente já informou no meio de uma compra
);

CREATE TABLE IF NOT EXISTS notificacoes (
  id         INTEGER PRIMARY KEY AUTOINCREMENT,
  pedido_id  TEXT NOT NULL,
  evento     TEXT NOT NULL,
  telefone   TEXT NOT NULL,
  texto      TEXT NOT NULL,
  status     TEXT NOT NULL DEFAULT 'pendente',  -- pendente | enviada | falhou | ignorada
  criado_em  INTEGER NOT NULL,
  enviado_em INTEGER,
  erro       TEXT,
  UNIQUE (pedido_id, evento)
);

CREATE TABLE IF NOT EXISTS meta (chave TEXT PRIMARY KEY, valor TEXT);
`;

export function abrirBanco(caminho = 'data/bot.db') {
  if (caminho !== ':memory:') mkdirSync(dirname(caminho), { recursive: true });
  const sql = new DatabaseSync(caminho);
  sql.exec('PRAGMA busy_timeout = 5000'); // o bot e o "npm run pedido" podem abrir o banco ao mesmo tempo
  sql.exec(ESQUEMA);
  // Bancos criados por versões anteriores ganham as colunas novas.
  const garantirColuna = (tabela, coluna, tipo) => {
    const existentes = sql.prepare(`PRAGMA table_info(${tabela})`).all().map((c) => c.name);
    if (!existentes.includes(coluna)) sql.exec(`ALTER TABLE ${tabela} ADD COLUMN ${coluna} ${tipo}`);
  };
  garantirColuna('pedidos', 'produto', 'TEXT');
  garantirColuna('pedidos', 'endereco', 'TEXT');
  garantirColuna('pedidos', 'origem', 'TEXT');
  garantirColuna('conversas', 'dados', 'TEXT');

  return {
    sql,

    // --- meta ---
    lerMeta(chave) {
      return sql.prepare('SELECT valor FROM meta WHERE chave = ?').get(chave)?.valor ?? null;
    },
    gravarMeta(chave, valor) {
      sql.prepare('INSERT INTO meta (chave, valor) VALUES (?, ?) ON CONFLICT(chave) DO UPDATE SET valor = excluded.valor')
        .run(chave, String(valor));
    },

    // --- pedidos ---
    buscarPedido(id) {
      return sql.prepare('SELECT * FROM pedidos WHERE id = ?').get(String(id)) ?? null;
    },
    buscarPedidoPorNumero(numero) {
      return sql.prepare('SELECT * FROM pedidos WHERE numero = ? ORDER BY criado_em DESC LIMIT 1').get(String(numero)) ?? null;
    },
    buscarUltimoPedidoPorTelefone(telefone) {
      const chave = chaveTelefone(telefone);
      if (!chave) return null;
      return sql.prepare('SELECT * FROM pedidos WHERE telefone_chave = ? ORDER BY criado_em DESC LIMIT 1').get(chave) ?? null;
    },
    salvarPedido(p) {
      sql.prepare(`
        INSERT INTO pedidos (id, numero, cliente_nome, telefone, telefone_chave, pagamento, envio, cancelado,
                             rastreio_codigo, rastreio_url, total, criado_em, atualizado_em,
                             produto, endereco, origem)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        ON CONFLICT(id) DO UPDATE SET
          numero = excluded.numero, cliente_nome = excluded.cliente_nome, telefone = excluded.telefone,
          telefone_chave = excluded.telefone_chave, pagamento = excluded.pagamento, envio = excluded.envio,
          cancelado = excluded.cancelado, rastreio_codigo = excluded.rastreio_codigo,
          rastreio_url = excluded.rastreio_url, total = excluded.total, atualizado_em = excluded.atualizado_em,
          produto = COALESCE(excluded.produto, produto), endereco = COALESCE(excluded.endereco, endereco),
          origem = COALESCE(excluded.origem, origem)
      `).run(
        String(p.id), String(p.numero ?? ''), p.cliente_nome ?? '', p.telefone ?? '', chaveTelefone(p.telefone),
        p.pagamento, p.envio, p.cancelado ? 1 : 0, p.rastreio_codigo ?? null, p.rastreio_url ?? null,
        p.total ?? null, p.criado_em ?? null, p.atualizado_em ?? null,
        p.produto ?? null, p.endereco ?? null, p.origem ?? null,
      );
    },

    // --- conversas ---
    lerConversa(jid) {
      return sql.prepare('SELECT * FROM conversas WHERE jid = ?').get(jid) ?? null;
    },
    gravarConversa(jid, { estado, invalidas = 0, atualizado_em, pausado_ate = 0, dados = null }) {
      sql.prepare(`
        INSERT INTO conversas (jid, estado, invalidas, atualizado_em, pausado_ate, dados) VALUES (?, ?, ?, ?, ?, ?)
        ON CONFLICT(jid) DO UPDATE SET estado = excluded.estado, invalidas = excluded.invalidas,
          atualizado_em = excluded.atualizado_em, pausado_ate = excluded.pausado_ate, dados = excluded.dados
      `).run(jid, estado, invalidas, atualizado_em, pausado_ate, dados);
    },
    // estado 'atendente' = o bot passou a conversa; 'humano' = alguém já respondeu pelo celular.
    // Conversas no meio de um atendimento do bot, paradas desde antes de `limite`.
    listarConversasInativas(limite, agora) {
      return sql.prepare(`
        SELECT jid FROM conversas
        WHERE estado NOT IN ('encerrada', 'atendente', 'humano') AND pausado_ate <= ? AND atualizado_em < ?
      `).all(agora, limite);
    },
    encerrarConversa(jid) {
      sql.prepare("UPDATE conversas SET estado = 'encerrada', invalidas = 0, dados = NULL WHERE jid = ?").run(jid);
    },
    pausarConversa(jid, ate, agora, estado = 'humano') {
      this.gravarConversa(jid, { estado, invalidas: 0, atualizado_em: agora, pausado_ate: ate });
    },

    // --- fila de notificações ---
    enfileirarNotificacao({ pedido_id, evento, telefone, texto, agora }) {
      const r = sql.prepare(`
        INSERT OR IGNORE INTO notificacoes (pedido_id, evento, telefone, texto, criado_em) VALUES (?, ?, ?, ?, ?)
      `).run(String(pedido_id), evento, telefone, texto, agora);
      return r.changes > 0;
    },
    // soDono: fora do horário de envio, só saem os avisos para o dono da loja.
    proximaNotificacao({ soDono = false } = {}) {
      const filtro = soDono ? "AND telefone = 'dono'" : '';
      return sql.prepare(`SELECT * FROM notificacoes WHERE status = 'pendente' ${filtro} ORDER BY id LIMIT 1`).get() ?? null;
    },
    listarPedidosLocais(limite = 20) {
      return sql.prepare("SELECT * FROM pedidos WHERE origem = 'whatsapp' ORDER BY criado_em DESC LIMIT ?").all(limite);
    },
    marcarNotificacao(id, status, { agora, erro = null } = {}) {
      sql.prepare('UPDATE notificacoes SET status = ?, enviado_em = ?, erro = ? WHERE id = ?')
        .run(status, agora ?? Date.now(), erro, id);
    },
  };
}
