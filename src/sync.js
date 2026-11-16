import { linhaRastreio, preencher, primeiroNome } from './util.js';

const BASE = { pagamento: 'pendente', envio: 'nao_enviado', cancelado: 0 };

/**
 * Compara o pedido salvo com o que veio da plataforma e devolve os eventos ocorridos.
 * `anterior` nulo = pedido novo.
 */
export function detectarEventos(anterior, atual) {
  const antes = anterior ?? BASE;
  const eventos = [];
  if (!anterior) eventos.push('pedido_recebido');

  if (atual.cancelado) {
    if (!antes.cancelado) eventos.push('pedido_cancelado');
    return anterior ? eventos : ['pedido_cancelado'];
  }
  if (atual.pagamento === 'pago' && antes.pagamento !== 'pago') eventos.push('pagamento_aprovado');
  if (atual.envio === 'entregue' && antes.envio !== 'entregue') eventos.push('pedido_entregue');
  else if (atual.envio === 'enviado' && antes.envio === 'nao_enviado') eventos.push('pedido_enviado');
  return eventos;
}

// Coloca na fila as mensagens dos eventos de um pedido. Devolve quantas entraram.
export function enfileirarAvisos({ db, bot, pedido, eventos, agora }) {
  const mensagens = bot.notificacoes?.mensagens ?? {};
  let enfileiradas = 0;
  for (const evento of eventos) {
    const modelo = mensagens[evento];
    if (!modelo || !pedido.telefone) continue;
    const texto = preencher(modelo, {
      loja: bot.loja,
      nome: primeiroNome(pedido.cliente_nome),
      numero: pedido.numero,
      rastreio_linha: linhaRastreio(pedido),
    });
    if (db.enfileirarNotificacao({ pedido_id: pedido.id, evento, telefone: pedido.telefone, texto, agora })) enfileiradas++;
  }
  return enfileiradas;
}

/**
 * Busca na plataforma os pedidos alterados desde a última sincronização,
 * grava no banco local e enfileira as mensagens dos eventos detectados.
 *
 * Na primeira execução só carrega os pedidos (não avisa ninguém sobre o passado).
 */
export async function sincronizar({ db, loja, bot, agora = Date.now(), log = console }) {
  const ultima = db.lerMeta('ultima_sync');
  const primeira = !ultima;
  const inicioBot = Number(db.lerMeta('primeira_sync') ?? agora);
  const desde = new Date(primeira ? agora - 30 * 24 * 60 * 60 * 1000 : Number(ultima) - 60 * 1000);

  const pedidos = await loja.listarPedidosAtualizados(desde);
  let enfileiradas = 0;

  for (const pedido of pedidos) {
    const anterior = db.buscarPedido(pedido.id);
    // Pedido desconhecido, mas criado antes de o bot existir: só registra, sem avisar.
    const antigo = !anterior && new Date(pedido.criado_em).getTime() < inicioBot;
    const eventos = primeira || antigo ? [] : detectarEventos(anterior, pedido);
    db.salvarPedido(pedido);
    enfileiradas += enfileirarAvisos({ db, bot, pedido, eventos, agora });
  }

  if (primeira) db.gravarMeta('primeira_sync', agora);
  db.gravarMeta('ultima_sync', agora);
  log.info?.(`[sync] ${pedidos.length} pedido(s) lido(s), ${enfileiradas} aviso(s) na fila${primeira ? ' (carga inicial, sem avisos)' : ''}`);
  return { pedidos: pedidos.length, enfileiradas, primeira };
}
