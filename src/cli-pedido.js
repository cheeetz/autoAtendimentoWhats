// Gerencia os pedidos feitos pelo WhatsApp:
//
//   npm run pedido                        lista os últimos pedidos
//   npm run pedido -- W1                  mostra um pedido
//   npm run pedido -- W1 pago             marca como pago e avisa o cliente
//   npm run pedido -- W1 enviado BR123BR  marca como enviado (código de rastreio opcional)
//   npm run pedido -- W1 entregue
//   npm run pedido -- W1 cancelado
//
// O aviso entra na fila e sai pelo bot que estiver rodando (em até 15 segundos).
import { carregarConfig } from './config.js';
import { abrirBanco } from './db.js';
import { STATUS_ACEITOS, atualizarPedidoLocal } from './pedidos-locais.js';

const [numero, status, codigo] = process.argv.slice(2);
const { bot } = carregarConfig();
const db = abrirBanco();

const situacao = (p) => (p.cancelado ? 'cancelado' : `${p.pagamento} / ${p.envio}`);

if (!numero || numero === 'listar') {
  const pedidos = db.listarPedidosLocais();
  if (!pedidos.length) console.log('Nenhum pedido feito pelo WhatsApp ainda.');
  for (const p of pedidos) {
    console.log(`${p.numero.padEnd(6)} ${situacao(p).padEnd(24)} ${p.produto ?? ''} | ${p.cliente_nome} | ${p.telefone}`);
  }
} else if (!status) {
  const p = db.buscarPedidoPorNumero(numero.toUpperCase().replace(/^#/, ''));
  if (!p) {
    console.error(`Pedido "${numero}" não encontrado`);
    process.exitCode = 1;
  } else {
    console.log(`Pedido #${p.numero} (${situacao(p)})`);
    console.log(`Produto:  ${p.produto ?? '-'} ${p.total ? `(${p.total})` : ''}`);
    console.log(`Cliente:  ${p.cliente_nome}`);
    console.log(`Telefone: ${p.telefone}`);
    console.log(`Endereço: ${p.endereco ?? '-'}`);
    if (p.rastreio_codigo) console.log(`Rastreio: ${p.rastreio_codigo}`);
    console.log(`Criado:   ${p.criado_em}`);
    console.log(`\nPara mudar o status: npm run pedido -- ${p.numero} <${STATUS_ACEITOS.join('|')}>`);
  }
} else {
  try {
    const r = atualizarPedidoLocal({ db, bot, numero, status: status.toLowerCase(), codigo });
    console.log(`Pedido #${r.pedido.numero}: ${situacao(r.pedido)}`);
    console.log(r.enfileiradas ? `${r.enfileiradas} aviso(s) ao cliente na fila` : 'Nenhum aviso novo para o cliente');
  } catch (erro) {
    console.error(erro.message);
    process.exitCode = 1;
  }
}
