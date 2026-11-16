import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import { abrirBanco } from '../src/db.js';
import { encerrarInativas, processarMensagem, responder } from '../src/triagem.js';

// Menu do exemplo: 1 Comprar, 2 Status do pedido, 3 Trocas, 4 Prazo e frete, 5 Atendente
const bot = JSON.parse(readFileSync('config/bot.example.json', 'utf8'));
const jid = '5511999998888@s.whatsapp.net';
const HORA = 60 * 60 * 1000;
const V = '\n\n0 - Voltar ao início';
const PRAZO = bot.menu.opcoes[3].resposta;
const MENU = /1 - Comprar\n2 - Status do meu pedido/;

function cenario(config = bot) {
  const db = abrirBanco(':memory:');
  let agora = 1_000_000_000_000;
  // cepEncontrado simula o resultado da consulta do CEP (objeto, null ou undefined)
  const enviar = (texto, telefone = '5511999998888', cepEncontrado) => {
    agora += 1000;
    return processarMensagem({ db, bot: config, jid, telefone, texto, cepEncontrado, agora });
  };
  return { db, enviar, avancar: (ms) => (agora += ms), encerrar: () => encerrarInativas({ db, bot: config, agora }) };
}

const pedido = {
  id: '10', numero: '123', cliente_nome: 'Maria Silva', telefone: '5511999998888',
  pagamento: 'pago', envio: 'enviado', cancelado: false, rastreio_codigo: 'BR123',
  criado_em: '2026-11-01T10:00:00Z', atualizado_em: '2026-11-02T10:00:00Z',
};

test('primeira mensagem recebe o menu', () => {
  const { enviar } = cenario();
  const [menu] = enviar('oi');
  assert.match(menu, /Minha Loja/);
  assert.match(menu, MENU);
});

test('opção de texto responde o texto configurado', () => {
  const { enviar } = cenario();
  enviar('oi');
  assert.deepEqual(enviar('4'), [PRAZO + V]);
});

test('status do pedido é achado pelo telefone, mesmo sem o nono dígito', () => {
  const { db, enviar } = cenario();
  db.salvarPedido(pedido);
  enviar('oi', '551199998888');
  const [resposta] = enviar('2', '551199998888');
  assert.match(resposta, /Pedido #123/);
  assert.match(resposta, /enviado/);
  assert.match(resposta, /BR123/);
});

test('sem pedido no telefone, pede o número e consulta', () => {
  const { db, enviar } = cenario();
  db.salvarPedido({ ...pedido, telefone: '5511988887777' });
  enviar('oi');
  assert.deepEqual(enviar('2'), [bot.menu.pedir_numero_pedido + V]);
  assert.match(enviar('pedido 123')[0], /Pedido #123/);
});

test('pedido inexistente passa para atendente e o bot se cala', () => {
  const { enviar } = cenario();
  enviar('oi');
  enviar('2');
  assert.deepEqual(enviar('999'), [bot.menu.pedido_nao_encontrado + V]);
  assert.deepEqual(enviar('alguém aí?'), []);
});

test('opção atendente pausa o bot até a pausa vencer', () => {
  const { enviar, avancar } = cenario();
  enviar('oi');
  assert.deepEqual(enviar('5'), [bot.menu.atendente + V]);
  assert.deepEqual(enviar('olá'), []);
  avancar((bot.pausa_atendente_horas + 1) * HORA);
  assert.match(enviar('oi')[0], MENU);
});

test('duas respostas fora do menu passam para atendente', () => {
  const { enviar } = cenario();
  enviar('oi');
  assert.equal(enviar('quero falar de outra coisa')[0], bot.menu.invalida);
  assert.deepEqual(enviar('????'), [bot.menu.atendente + V]);
  assert.deepEqual(enviar('oi'), []);
});

test('0 volta ao início de qualquer ponto', () => {
  const { enviar } = cenario();
  enviar('oi');
  enviar('4');
  assert.match(enviar('0')[0], MENU);
  enviar('2'); // sem pedido: fica aguardando o número
  assert.match(enviar('voltar')[0], MENU);
  enviar('1');
  enviar('1'); // dentro da ficha do produto
  assert.match(enviar('0')[0], MENU);
  assert.deepEqual(enviar('4'), [PRAZO + V]);
});

test('depois de pedir atendente, 0 volta ao menu; se um humano já respondeu, não', () => {
  const { db, enviar } = cenario();
  enviar('oi');
  enviar('5');
  assert.match(enviar('0')[0], MENU);
  enviar('5');
  db.pausarConversa(jid, 2_000_000_000_000, 1_000_000_000_000); // dono respondeu pelo celular
  assert.deepEqual(enviar('0'), []);
});

test('"voltar": false desliga a opção', () => {
  const semVoltar = structuredClone(bot);
  semVoltar.menu.voltar = false;
  const { enviar } = cenario(semVoltar);
  enviar('oi');
  assert.deepEqual(enviar('4'), [PRAZO]);
});

test('catálogo: lista os produtos e mostra a ficha com foto', () => {
  const { enviar } = cenario();
  enviar('oi');
  const [lista] = enviar('1');
  assert.equal(lista, 'Escolha um produto:\n\n1 - Produto A (R$ 200,00)\n2 - Produto B (R$ 150,00)\n3 - Produto C (R$ 90,00)' + V);
  const [ficha] = enviar('1');
  assert.equal(ficha.imagem, 'config/fotos/produto-a.jpg');
  assert.equal(ficha.texto, '*Produto A*\nDescrição do produto A.\n\nR$ 200,00\n\n1 - Comprar\n2 - Voltar aos produtos' + V);
});

test('catálogo: produto sem foto vai como texto; 2 volta aos produtos', () => {
  const { enviar } = cenario();
  enviar('oi');
  enviar('1');
  const [ficha] = enviar('2');
  assert.equal(typeof ficha, 'string');
  assert.match(ficha, /\*Produto B\*/);
  assert.match(enviar('2')[0], /1 - Produto A/);
});

const CEP = { cep: '01001-000', logradouro: 'Rua das Flores', bairro: 'Centro', cidade: 'São Paulo', uf: 'SP' };
const ENDERECO = 'Rua das Flores, 100, apto 2 - Centro, São Paulo - SP, CEP 01001-000';
const TEL = '5511999998888';

// Leva a conversa até a confirmação dos dados do produto escolhido.
function ateConfirmacao(enviar, produto, telefone) {
  enviar('oi', telefone);
  enviar('1', telefone);
  enviar(produto, telefone);
  assert.deepEqual(enviar('1', telefone), ['Para finalizar, qual é o seu nome completo?' + V]);
  assert.deepEqual(enviar('Maria Silva', telefone), ['Qual é o CEP de entrega?' + V]);
  const [pedeNumero] = enviar('01001-000', telefone, CEP);
  assert.equal(pedeNumero, 'Entrega em:\nRua das Flores, Centro\nSão Paulo - SP\n\nQual é o número? Se tiver complemento, mande junto (ex.: 120, apto 301).' + V);
  return enviar('100, apto 2', telefone);
}

test('compra: pede nome e endereço, confirma, registra o pedido e manda o link', () => {
  const { db, enviar } = cenario();
  const [resumo] = ateConfirmacao(enviar, '1');
  assert.equal(resumo, `Confira os dados:\n\nProduto: Produto A (R$ 200,00)\nNome: Maria Silva\nEndereço: ${ENDERECO}\nTelefone: 5511999998888\n\n1 - Confirmar\n2 - Corrigir` + V);
  const respostas = enviar('1');
  assert.equal(respostas[0], 'Pedido #W1 registrado! Avisamos por aqui a cada atualização.');
  assert.equal(respostas[1], 'Para finalizar a compra de Produto A (R$ 200,00), acesse:\nhttps://minhaloja.com.br/produtos/produto-a');
  assert.equal(respostas[2], bot.catalogo.depois_da_compra + V);

  const pedido = db.buscarPedidoPorNumero('W1');
  assert.equal(pedido.cliente_nome, 'Maria Silva');
  assert.equal(pedido.endereco, ENDERECO);
  assert.equal(pedido.telefone, '5511999998888');
  assert.equal(pedido.produto, 'Produto A');
  assert.equal(pedido.pagamento, 'pendente');
  assert.equal(pedido.origem, 'whatsapp');

  const aviso = db.proximaNotificacao({ soDono: true });
  assert.equal(aviso.telefone, 'dono');
  assert.match(aviso.texto, /Novo pedido #W1\nProduto A \(R\$ 200,00\)\n\nMaria Silva/);

  // de volta ao menu, e o status já é achado pelo telefone
  assert.match(enviar('2')[0], /Pedido #W1\nPagamento: aguardando pagamento/);
});

test('compra: Pix manda o código sozinho em uma mensagem', () => {
  const comQr = structuredClone(bot);
  comQr.catalogo.produtos[1].pix_qr = 'config/fotos/pix-b.png';
  const { enviar } = cenario(comQr);
  ateConfirmacao(enviar, '2');
  const respostas = enviar('1');
  assert.match(respostas[0], /Pedido #W1 registrado/);
  assert.match(respostas[1], /Pix de Produto B \(R\$ 150,00\)/);
  assert.deepEqual(respostas[2], { imagem: 'config/fotos/pix-b.png', texto: '' });
  assert.equal(respostas[3], 'COLE-AQUI-O-CODIGO-PIX-COPIA-E-COLA');
  assert.equal(respostas.length, 5);
});

test('compra: produto sem link nem Pix registra o pedido e chama atendente', () => {
  const { db, enviar } = cenario();
  ateConfirmacao(enviar, '3');
  const respostas = enviar('1');
  assert.match(respostas[0], /Pedido #W1 registrado/);
  assert.match(respostas[1], /atendente vai combinar o pagamento de Produto C/);
  assert.ok(db.buscarPedidoPorNumero('W1'));
  assert.deepEqual(enviar('oi'), []);
});

test('compra: sem telefone no WhatsApp, o bot pergunta', () => {
  const { db, enviar } = cenario();
  const [pergunta] = ateConfirmacao(enviar, '1', '');
  assert.equal(pergunta, 'Qual é o seu telefone com DDD?' + V);
  assert.match(enviar('(11) 99999-8888', '')[0], /Telefone: 5511999998888/);
  enviar('1', '');
  assert.equal(db.buscarPedidoPorNumero('W1').telefone, '5511999998888');
});

test('compra: corrigir recomeça pelo nome; 0 cancela sem registrar', () => {
  const { db, enviar } = cenario();
  ateConfirmacao(enviar, '1');
  assert.deepEqual(enviar('2'), ['Para finalizar, qual é o seu nome completo?' + V]);
  enviar('Maria Souza');
  enviar('01001000', TEL, CEP);
  assert.match(enviar('100, apto 2')[0], /Nome: Maria Souza/);
  assert.match(enviar('0')[0], MENU);
  assert.equal(db.buscarPedidoPorNumero('W1'), null);
});

function ateOCep(config) {
  const c = cenario(config);
  c.enviar('oi'); c.enviar('1'); c.enviar('1'); c.enviar('1'); c.enviar('Maria Silva');
  return c;
}

test('compra: CEP mal digitado ou inexistente é pedido de novo, sem perder o nome', () => {
  const { enviar } = ateOCep();
  assert.deepEqual(enviar('0100'), ['Não encontrei esse CEP. Confira os 8 números e envie de novo.' + V]);
  enviar('01001000', TEL, CEP);
  assert.match(enviar('100')[0], /Nome: Maria Silva\nEndereço: Rua das Flores, 100 - Centro/);
});

test('compra: dois CEPs errados seguidos passam para atendente', () => {
  const { db, enviar } = ateOCep();
  enviar('00000000', TEL, null);
  assert.deepEqual(enviar('minha rua é a das flores', TEL), [bot.menu.atendente + V]);
  assert.equal(db.lerConversa(jid).estado, 'atendente');
});

test('compra: número sem nenhum dígito é pedido de novo; "s/n" vale', () => {
  const { enviar } = ateOCep();
  enviar('01001000', TEL, CEP);
  assert.match(enviar('perto da padaria')[0], /Preciso do número do endereço/);
  assert.match(enviar('s/n')[0], /Endereço: Rua das Flores, s\/n - Centro, São Paulo - SP, CEP 01001-000/);
});

test('compra: CEP geral (sem rua) pede rua, número e bairro e completa cidade e UF', () => {
  const { enviar } = ateOCep();
  const geral = { cep: '17380-000', logradouro: '', bairro: '', cidade: 'Brotas', uf: 'SP' };
  assert.deepEqual(enviar('17380000', TEL, geral), ['CEP de Brotas - SP. Qual é a rua, o número, o complemento e o bairro?' + V]);
  assert.match(enviar('Rua A, 50, Centro')[0], /Endereço: Rua A, 50, Centro - Brotas - SP, CEP 17380-000/);
});

test('compra: se a consulta do CEP falhar, pede o endereço por extenso', () => {
  const { enviar } = ateOCep();
  assert.match(enviar('01001000')[0], /endereço completo para entrega/);
  assert.equal(enviar('casa')[0], bot.menu.invalida);
  assert.match(enviar('Rua das Flores, 100, Centro, São Paulo, SP')[0], /Endereço: Rua das Flores, 100, Centro, São Paulo, SP\n/);
});

test('"endereco_por_cep": false pede o endereço por extenso direto', () => {
  const semCep = structuredClone(bot);
  semCep.catalogo.endereco_por_cep = false;
  const c = cenario(semCep);
  c.enviar('oi'); c.enviar('1'); c.enviar('1'); c.enviar('1');
  assert.match(c.enviar('Maria Silva')[0], /endereço completo para entrega/);
});

test('responder consulta o CEP só quando a conversa espera um', async () => {
  const { db } = ateOCep();
  const consultados = [];
  const buscarCep = async (cep) => { consultados.push(cep); return CEP; };
  const base = { db, bot, jid, telefone: TEL, agora: 1_000_000_010_000 };
  const [pedeNumero] = await responder({ ...base, texto: '01.001-000' }, { buscarCep });
  assert.match(pedeNumero, /Rua das Flores, Centro/);
  await responder({ ...base, texto: '12345678', agora: base.agora + 1000 }, { buscarCep });
  assert.deepEqual(consultados, ['01001000']);
});

test('responder: serviço de CEP fora do ar cai no endereço por extenso', async () => {
  const { db } = ateOCep();
  const erro = console.error;
  console.error = () => {};
  try {
    const [resposta] = await responder(
      { db, bot, jid, telefone: TEL, texto: '01001000', agora: 1_000_000_010_000 },
      { buscarCep: async () => { throw new Error('fora do ar'); } },
    );
    assert.match(resposta, /endereço completo para entrega/);
  } finally {
    console.error = erro;
  }
});

test('compra: números seguem a sequência W1, W2', () => {
  const { db, enviar } = cenario();
  ateConfirmacao(enviar, '1');
  enviar('1');
  enviar('1'); enviar('1'); enviar('1'); enviar('Maria Silva'); enviar('01001000', TEL, CEP); enviar('100, apto 2');
  assert.match(enviar('1')[0], /Pedido #W2 registrado/);
  assert.equal(db.listarPedidosLocais().length, 2);
});

test('"pedir_dados": false manda o pagamento direto, sem registrar pedido', () => {
  const direto = structuredClone(bot);
  direto.catalogo.pedir_dados = false;
  const { db, enviar } = cenario(direto);
  enviar('oi');
  enviar('1');
  enviar('1');
  const respostas = enviar('1');
  assert.match(respostas[0], /Para finalizar a compra de Produto A/);
  assert.equal(db.listarPedidosLocais().length, 0);
});

test('status pelo número aceita o formato W1', () => {
  const { db, enviar } = cenario();
  db.salvarPedido({ ...pedido, id: 'w-7', numero: 'W7', telefone: '5511988887777', origem: 'whatsapp' });
  enviar('oi');
  enviar('2');
  assert.match(enviar('w7')[0], /Pedido #W7/);
});

test('catálogo: opção inexistente repete a lista; na ficha repete sem reenviar a foto', () => {
  const { enviar } = cenario();
  enviar('oi');
  enviar('1');
  const invalida = enviar('9');
  assert.equal(invalida[0], bot.menu.invalida);
  assert.match(invalida[1], /1 - Produto A/);
  enviar('1');
  const naFicha = enviar('talvez');
  assert.equal(typeof naFicha[1], 'string');
  assert.match(naFicha[1], /1 - Comprar/);
});

test('sem produtos cadastrados, a opção Comprar chama um atendente', () => {
  const vazio = structuredClone(bot);
  vazio.catalogo.produtos = [];
  const { enviar } = cenario(vazio);
  enviar('oi');
  assert.deepEqual(enviar('1'), [bot.menu.atendente + V]);
});

const MINUTO = 60 * 1000;

test('sem interação pelo tempo de sessão, encerra, avisa e a próxima mensagem recebe o menu', () => {
  const { enviar, avancar, encerrar } = cenario();
  enviar('oi');
  enviar('2'); // fica aguardando o número do pedido
  avancar(10 * MINUTO);
  assert.deepEqual(encerrar(), []);
  avancar(6 * MINUTO);
  assert.deepEqual(encerrar(), [{ jid, texto: bot.menu.encerramento }]);
  assert.deepEqual(encerrar(), []); // avisa uma vez só
  assert.match(enviar('quero comprar')[0], MENU);
});

test('mesmo sem o encerramento ter rodado, mensagem depois do tempo de sessão recebe o menu', () => {
  const { enviar, avancar } = cenario();
  enviar('oi');
  enviar('1');
  avancar(16 * MINUTO);
  assert.match(enviar('2')[0], MENU);
});

test('conversa com atendente não é encerrada pelo bot', () => {
  const { enviar, avancar, encerrar } = cenario();
  enviar('oi');
  enviar('5');
  avancar(60 * MINUTO);
  assert.deepEqual(encerrar(), []);
  assert.deepEqual(enviar('alguém?'), []);
});

test('compra abandonada é encerrada sem registrar pedido', () => {
  const { db, enviar, avancar, encerrar } = cenario();
  enviar('oi'); enviar('1'); enviar('1'); enviar('1'); enviar('Maria Silva');
  avancar(16 * MINUTO);
  assert.equal(encerrar().length, 1);
  assert.equal(db.lerConversa(jid).dados, null);
  assert.match(enviar('oi')[0], MENU);
  assert.equal(db.listarPedidosLocais().length, 0);
});

test('sem "menu.encerramento", encerra em silêncio; "sessao_horas" antigo ainda vale', () => {
  const antigo = structuredClone(bot);
  delete antigo.sessao_minutos;
  delete antigo.menu.encerramento;
  antigo.sessao_horas = 1;
  const { db, enviar, avancar, encerrar } = cenario(antigo);
  enviar('oi');
  avancar(30 * MINUTO);
  assert.deepEqual(encerrar(), []);
  assert.equal(db.lerConversa(jid).estado, 'menu');
  avancar(31 * MINUTO);
  assert.deepEqual(encerrar(), []);
  assert.equal(db.lerConversa(jid).estado, 'encerrada');
});
