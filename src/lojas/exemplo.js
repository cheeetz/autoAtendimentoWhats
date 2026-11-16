import { existsSync, readFileSync, statSync } from 'node:fs';

// Adaptador de teste: lê pedidos de data/pedidos-exemplo.json (lista de Pedido,
// no formato descrito em src/lojas/index.js). Edite o arquivo com o bot rodando
// para simular mudanças de status sem depender de uma loja real: basta salvar,
// não precisa mexer em "atualizado_em".
export function criar() {
  const caminho = 'data/pedidos-exemplo.json';
  return {
    async listarPedidosAtualizados(desde) {
      if (!existsSync(caminho)) return [];
      const pedidos = JSON.parse(readFileSync(caminho, 'utf8'));
      if (statSync(caminho).mtime >= desde) return pedidos; // arquivo salvo depois da última leitura
      return pedidos.filter((p) => new Date(p.atualizado_em) >= desde);
    },
  };
}
