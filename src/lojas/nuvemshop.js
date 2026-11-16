import { normalizarTelefone } from '../util.js';

// Documentação: https://tiendanube.github.io/api-documentation/resources/order
const BASE = 'https://api.nuvemshop.com.br/2025-03';

const PAGAMENTO = {
  paid: 'pago',
  partially_paid: 'pendente',
  pending: 'pendente',
  authorized: 'pendente',
  abandoned: 'pendente',
  refunded: 'reembolsado',
  partially_refunded: 'pago',
  voided: 'cancelado',
};

const ENVIO = {
  unpacked: 'nao_enviado',
  unshipped: 'nao_enviado',
  unfulfilled: 'nao_enviado',
  partially_packed: 'nao_enviado',
  partially_fulfilled: 'nao_enviado',
  shipped: 'enviado',
  fulfilled: 'enviado',
  delivered: 'entregue',
};

// Converte o pedido da Nuvemshop para o formato comum do bot.
export function converterPedido(p) {
  const rastreio = p.fulfillments?.[0]?.tracking_info ?? {};
  return {
    id: String(p.id),
    numero: String(p.number ?? p.id),
    cliente_nome: p.contact_name ?? p.customer?.name ?? '',
    telefone: normalizarTelefone(p.contact_phone ?? p.customer?.phone ?? ''),
    pagamento: PAGAMENTO[p.payment_status] ?? 'pendente',
    envio: ENVIO[p.shipping_status] ?? 'nao_enviado',
    cancelado: p.status === 'cancelled',
    rastreio_codigo: p.shipping_tracking_number ?? rastreio.code ?? null,
    rastreio_url: p.shipping_tracking_url ?? rastreio.url ?? null,
    total: p.total ?? null,
    criado_em: p.created_at ?? null,
    atualizado_em: p.updated_at ?? null,
  };
}

function proximaPagina(linkHeader) {
  const m = /<([^>]+)>;\s*rel="next"/.exec(linkHeader ?? '');
  return m ? m[1] : null;
}

export function criar(env, buscar = fetch) {
  const { NUVEMSHOP_STORE_ID: loja, NUVEMSHOP_TOKEN: token, NUVEMSHOP_USER_AGENT: agente } = env;
  if (!loja || !token || !agente) {
    throw new Error('Preencha NUVEMSHOP_STORE_ID, NUVEMSHOP_TOKEN e NUVEMSHOP_USER_AGENT no .env');
  }
  const headers = {
    // A documentação atual usa "Authorization: Bearer"; versões antigas usavam
    // "Authentication: bearer". Enviamos os dois.
    Authorization: `Bearer ${token}`,
    Authentication: `bearer ${token}`,
    'User-Agent': agente,
  };

  return {
    async listarPedidosAtualizados(desde) {
      const pedidos = [];
      let url = `${BASE}/${loja}/orders?per_page=200&updated_at_min=${encodeURIComponent(desde.toISOString())}`;
      while (url) {
        const resp = await buscar(url, { headers });
        if (resp.status === 404) break; // página sem resultados
        if (!resp.ok) {
          throw new Error(`Nuvemshop respondeu ${resp.status}: ${(await resp.text()).slice(0, 200)}`);
        }
        pedidos.push(...(await resp.json()).map(converterPedido));
        url = proximaPagina(resp.headers.get('link'));
      }
      return pedidos;
    },
  };
}
