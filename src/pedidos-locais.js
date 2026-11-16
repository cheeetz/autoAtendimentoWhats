import { detectarEventos, enfileirarAvisos } from './sync.js';

// Pedidos feitos pelo próprio WhatsApp (catálogo do bot). Ficam só no banco local,
// com número W1, W2... para não confundir com os pedidos da plataforma.

export function criarPedidoLocal({ db, produto, nome, endereco, telefone, agora = Date.now() }) {
  const n = Number(db.lerMeta('seq_pedido_local') ?? 0) + 1;
  db.gravarMeta('seq_pedido_local', n);
  const quando = new Date(agora).toISOString();
  const pedido = {
    id: `w-${n}`,
    numero: `W${n}`,
    cliente_nome: nome,
    telefone,
    endereco,
    produto: produto.nome,
    total: produto.preco ?? null,
    pagamento: 'pendente',
    envio: 'nao_enviado',
    cancelado: false,
    origem: 'whatsapp',
    criado_em: quando,
    atualizado_em: quando,
  };
  db.salvarPedido(pedido);
  // Aviso para o dono da loja (chega em "Mensagem para mim" do número do bot).
  db.enfileirarNotificacao({
    pedido_id: pedido.id,
    evento: 'novo_pedido_dono',
    telefone: 'dono',
    texto: `Novo pedido #${pedido.numero}\n${produto.nome}${produto.preco ? ` (${produto.preco})` : ''}\n\n${nome}\n${endereco}\nTelefone: ${telefone}`,
    agora,
  });
  return pedido;
}

const MUDANCAS = {
  pago: () => ({ pagamento: 'pago' }),
  enviado: (codigo) => ({ envio: 'enviado', ...(codigo ? { rastreio_codigo: codigo } : {}) }),
  entregue: () => ({ envio: 'entregue' }),
  cancelado: () => ({ cancelado: 1 }),
};

export const STATUS_ACEITOS = Object.keys(MUDANCAS);

/**
 * Muda o status de um pedido feito pelo WhatsApp e põe o aviso ao cliente na fila.
 * Devolve { pedido, eventos, enfileiradas } ou lança erro com mensagem legível.
 */
export function atualizarPedidoLocal({ db, bot, numero, status, codigo, agora = Date.now() }) {
  const anterior = db.buscarPedidoPorNumero(String(numero).toUpperCase().replace(/^#/, ''));
  if (!anterior) throw new Error(`Pedido "${numero}" não encontrado`);
  if (anterior.origem !== 'whatsapp') throw new Error(`O pedido ${anterior.numero} veio da plataforma da loja; altere o status por lá`);
  if (!MUDANCAS[status]) throw new Error(`Status "${status}" inválido. Use: ${STATUS_ACEITOS.join(', ')}`);

  const atual = { ...anterior, ...MUDANCAS[status](codigo), atualizado_em: new Date(agora).toISOString() };
  const eventos = detectarEventos(anterior, atual);
  db.salvarPedido(atual);
  const enfileiradas = enfileirarAvisos({ db, bot, pedido: atual, eventos, agora });
  return { pedido: atual, eventos, enfileiradas };
}
