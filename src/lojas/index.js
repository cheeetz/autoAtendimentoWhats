// Cada plataforma é um "adaptador" com um único método:
//
//   listarPedidosAtualizados(desde: Date) -> Promise<Pedido[]>
//
// Pedido = {
//   id, numero, cliente_nome, telefone,
//   pagamento: 'pendente' | 'pago' | 'reembolsado' | 'cancelado',
//   envio: 'nao_enviado' | 'enviado' | 'entregue',
//   cancelado: boolean,
//   rastreio_codigo, rastreio_url, total,
//   criado_em, atualizado_em   (ISO 8601)
// }
//
// Para suportar outra plataforma, crie src/lojas/<nome>.js exportando `criar(env)`
// e registre abaixo.

const ADAPTADORES = {
  nuvemshop: () => import('./nuvemshop.js'),
  exemplo: () => import('./exemplo.js'),
};

export async function criarLoja(plataforma, env) {
  if (!plataforma || plataforma === 'nenhuma') return null;
  const carregar = ADAPTADORES[plataforma];
  if (!carregar) {
    throw new Error(`LOJA_PLATAFORMA="${plataforma}" não existe. Opções: nenhuma, ${Object.keys(ADAPTADORES).join(', ')}`);
  }
  const modulo = await carregar();
  return modulo.criar(env);
}
