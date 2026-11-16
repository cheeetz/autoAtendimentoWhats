import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import { abrirBanco } from '../src/db.js';
import { converterPedido, criar } from '../src/lojas/nuvemshop.js';
import { dentroDoHorario } from '../src/notificador.js';
import { detectarEventos, sincronizar } from '../src/sync.js';

const bot = JSON.parse(readFileSync('config/bot.example.json', 'utf8'));
const silencioso = { info() {} };
const DIA = 24 * 60 * 60 * 1000;
const T0 = Date.parse('2026-11-10T12:00:00Z');

const base = {
  id: '1', numero: '100', cliente_nome: 'Maria Silva', telefone: '5511999998888',
  pagamento: 'pendente', envio: 'nao_enviado', cancelado: false,
  criado_em: '2026-11-09T12:00:00Z', atualizado_em: '2026-11-09T12:00:00Z',
};

test('detectarEventos cobre as transições', () => {
  assert.deepEqual(detectarEventos(null, base), ['pedido_recebido']);
  assert.deepEqual(detectarEventos(null, { ...base, pagamento: 'pago' }), ['pedido_recebido', 'pagamento_aprovado']);
  assert.deepEqual(detectarEventos(base, { ...base, pagamento: 'pago' }), ['pagamento_aprovado']);
  assert.deepEqual(detectarEventos({ ...base, pagamento: 'pago' }, { ...base, pagamento: 'pago', envio: 'enviado' }), ['pedido_enviado']);
  assert.deepEqual(detectarEventos({ ...base, envio: 'enviado' }, { ...base, envio: 'entregue' }), ['pedido_entregue']);
  assert.deepEqual(detectarEventos(base, { ...base, cancelado: true }), ['pedido_cancelado']);
  assert.deepEqual(detectarEventos(base, base), []);
});

test('carga inicial não avisa; mudanças seguintes avisam uma única vez', async () => {
  const db = abrirBanco(':memory:');
  let pedidos = [base];
  const loja = { listarPedidosAtualizados: async () => pedidos };

  const r1 = await sincronizar({ db, loja, bot, agora: T0, log: silencioso });
  assert.equal(r1.enfileiradas, 0);

  pedidos = [{ ...base, pagamento: 'pago', envio: 'enviado', rastreio_codigo: 'BR1' }];
  const r2 = await sincronizar({ db, loja, bot, agora: T0 + 60_000, log: silencioso });
  assert.equal(r2.enfileiradas, 2);
  const fila = db.sql.prepare('SELECT evento, texto FROM notificacoes ORDER BY id').all();
  assert.deepEqual(fila.map((f) => f.evento), ['pagamento_aprovado', 'pedido_enviado']);
  assert.match(fila[1].texto, /Maria, seu pedido #100 foi enviado!\nCódigo de rastreio: BR1/);

  const r3 = await sincronizar({ db, loja, bot, agora: T0 + 120_000, log: silencioso });
  assert.equal(r3.enfileiradas, 0);
});

test('pedido novo depois da carga inicial avisa; pedido antigo desconhecido não', async () => {
  const db = abrirBanco(':memory:');
  let pedidos = [];
  const loja = { listarPedidosAtualizados: async () => pedidos };
  await sincronizar({ db, loja, bot, agora: T0, log: silencioso });

  pedidos = [
    { ...base, id: '2', numero: '101', criado_em: new Date(T0 + 1000).toISOString() },
    { ...base, id: '3', numero: '50', envio: 'entregue', criado_em: new Date(T0 - 90 * DIA).toISOString() },
  ];
  const r = await sincronizar({ db, loja, bot, agora: T0 + 60_000, log: silencioso });
  assert.equal(r.enfileiradas, 1);
  assert.equal(db.proximaNotificacao().evento, 'pedido_recebido');
  assert.ok(db.buscarPedido('3'));
});

test('evento com mensagem nula no config não é enviado', async () => {
  const db = abrirBanco(':memory:');
  const semRecebido = structuredClone(bot);
  semRecebido.notificacoes.mensagens.pedido_recebido = null;
  let pedidos = [];
  const loja = { listarPedidosAtualizados: async () => pedidos };
  await sincronizar({ db, loja, bot: semRecebido, agora: T0, log: silencioso });
  pedidos = [{ ...base, criado_em: new Date(T0 + 1000).toISOString() }];
  const r = await sincronizar({ db, loja, bot: semRecebido, agora: T0 + 60_000, log: silencioso });
  assert.equal(r.enfileiradas, 0);
});

test('nuvemshop: converte o pedido e segue a paginação', async () => {
  const p = converterPedido({
    id: 871254203, number: 306, status: 'open', payment_status: 'paid', shipping_status: 'shipped',
    contact_name: 'Maria Silva', contact_phone: '+55 (11) 99999-8888', shipping_tracking_number: 'BR9',
    total: '199.90', created_at: '2026-11-09T12:00:00+0000', updated_at: '2026-11-09T13:00:00+0000',
  });
  assert.equal(p.numero, '306');
  assert.equal(p.telefone, '5511999998888');
  assert.equal(p.pagamento, 'pago');
  assert.equal(p.envio, 'enviado');
  assert.equal(p.rastreio_codigo, 'BR9');

  const chamadas = [];
  const paginas = {
    1: { corpo: [{ id: 1, number: 1 }], link: '<https://api.nuvemshop.com.br/2025-03/9/orders?page=2>; rel="next"' },
    2: { corpo: [{ id: 2, number: 2 }], link: null },
  };
  const buscar = async (url, { headers }) => {
    chamadas.push({ url, headers });
    const pagina = paginas[/\?page=2/.test(url) ? 2 : 1];
    return { ok: true, status: 200, json: async () => pagina.corpo, headers: { get: () => pagina.link } };
  };
  const loja = criar({ NUVEMSHOP_STORE_ID: '9', NUVEMSHOP_TOKEN: 't', NUVEMSHOP_USER_AGENT: 'x (a@b.c)' }, buscar);
  const pedidos = await loja.listarPedidosAtualizados(new Date(T0));
  assert.equal(pedidos.length, 2);
  assert.match(chamadas[0].url, /\/2025-03\/9\/orders\?per_page=200&updated_at_min=2026-11-10/);
  assert.equal(chamadas[0].headers.Authorization, 'Bearer t');
});

test('horário de envio', () => {
  assert.equal(dentroDoHorario([8, 21], new Date(2026, 10, 10, 9)), true);
  assert.equal(dentroDoHorario([8, 21], new Date(2026, 10, 10, 22)), false);
  assert.equal(dentroDoHorario(undefined), true);
});
