import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import { DatabaseSync } from 'node:sqlite';
import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { abrirBanco } from '../src/db.js';
import { atualizarPedidoLocal, criarPedidoLocal } from '../src/pedidos-locais.js';

const bot = JSON.parse(readFileSync('config/bot.example.json', 'utf8'));
const produto = bot.catalogo.produtos[0];
const cliente = { nome: 'Maria Silva', endereco: 'Rua das Flores, 100, São Paulo, SP', telefone: '5511999998888' };

function comPedido() {
  const db = abrirBanco(':memory:');
  criarPedidoLocal({ db, produto, ...cliente, agora: 1_000_000_000_000 });
  db.marcarNotificacao(db.proximaNotificacao().id, 'enviada'); // aviso ao dono
  return db;
}

test('pago, enviado e entregue geram um aviso cada, com o código de rastreio', () => {
  const db = comPedido();
  const pago = atualizarPedidoLocal({ db, bot, numero: 'w1', status: 'pago' });
  assert.deepEqual(pago.eventos, ['pagamento_aprovado']);
  assert.equal(pago.enfileiradas, 1);
  assert.match(db.proximaNotificacao().texto, /Maria, o pagamento do pedido #W1 foi aprovado/);
  db.marcarNotificacao(db.proximaNotificacao().id, 'enviada');

  const enviado = atualizarPedidoLocal({ db, bot, numero: '#W1', status: 'enviado', codigo: 'BR123BR' });
  assert.deepEqual(enviado.eventos, ['pedido_enviado']);
  const aviso = db.proximaNotificacao();
  assert.equal(aviso.telefone, '5511999998888');
  assert.match(aviso.texto, /pedido #W1 foi enviado!\nCódigo de rastreio: BR123BR/);
  db.marcarNotificacao(aviso.id, 'enviada');

  assert.deepEqual(atualizarPedidoLocal({ db, bot, numero: 'W1', status: 'entregue' }).eventos, ['pedido_entregue']);
  // repetir o mesmo status não avisa de novo
  assert.equal(atualizarPedidoLocal({ db, bot, numero: 'W1', status: 'entregue' }).enfileiradas, 0);
  // nome e endereço continuam no pedido depois das atualizações
  assert.equal(db.buscarPedidoPorNumero('W1').endereco, cliente.endereco);
});

test('cancelado avisa o cliente', () => {
  const db = comPedido();
  assert.deepEqual(atualizarPedidoLocal({ db, bot, numero: 'W1', status: 'cancelado' }).eventos, ['pedido_cancelado']);
});

test('erros legíveis: pedido inexistente, status inválido, pedido da plataforma', () => {
  const db = comPedido();
  assert.throws(() => atualizarPedidoLocal({ db, bot, numero: 'W9', status: 'pago' }), /não encontrado/);
  assert.throws(() => atualizarPedidoLocal({ db, bot, numero: 'W1', status: 'pagou' }), /inválido/);
  db.salvarPedido({ id: '55', numero: '306', cliente_nome: 'João', telefone: '5511988887777', pagamento: 'pendente', envio: 'nao_enviado' });
  assert.throws(() => atualizarPedidoLocal({ db, bot, numero: '306', status: 'pago' }), /plataforma/);
});

test('banco criado por versão anterior ganha as colunas novas', () => {
  const caminho = join(mkdtempSync(join(tmpdir(), 'bot-')), 'antigo.db');
  const antigo = new DatabaseSync(caminho);
  antigo.exec(`
    CREATE TABLE pedidos (id TEXT PRIMARY KEY, numero TEXT, cliente_nome TEXT, telefone TEXT, telefone_chave TEXT,
      pagamento TEXT, envio TEXT, cancelado INTEGER NOT NULL DEFAULT 0, rastreio_codigo TEXT, rastreio_url TEXT,
      total TEXT, criado_em TEXT, atualizado_em TEXT);
    CREATE TABLE conversas (jid TEXT PRIMARY KEY, estado TEXT NOT NULL, invalidas INTEGER NOT NULL DEFAULT 0,
      atualizado_em INTEGER NOT NULL, pausado_ate INTEGER NOT NULL DEFAULT 0);
    INSERT INTO conversas (jid, estado, atualizado_em) VALUES ('a@s.whatsapp.net', 'menu', 1);
  `);
  antigo.close();
  const db = abrirBanco(caminho);
  assert.equal(criarPedidoLocal({ db, produto, ...cliente }).numero, 'W1');
  assert.equal(db.lerConversa('a@s.whatsapp.net').dados, null);
  db.sql.close();
});
