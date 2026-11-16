// Só os dígitos de um telefone ou JID ("5511999998888:12@s.whatsapp.net" -> "5511999998888").
export function digitos(valor) {
  return String(valor ?? '').split('@')[0].split(':')[0].replace(/\D/g, '');
}

// Telefone no formato internacional. Números com 10 ou 11 dígitos são tratados como brasileiros.
export function normalizarTelefone(valor) {
  const d = digitos(valor).replace(/^0+/, '');
  if (!d) return '';
  return d.length === 10 || d.length === 11 ? `55${d}` : d;
}

// Chave de comparação que ignora o nono dígito: DDD + últimos 8 dígitos.
// O WhatsApp pode identificar o mesmo celular com ou sem o 9.
export function chaveTelefone(valor) {
  const d = normalizarTelefone(valor);
  if (d.startsWith('55') && (d.length === 12 || d.length === 13)) {
    return d.slice(2, 4) + d.slice(-8);
  }
  return d;
}

// Substitui {campo} pelos valores; campos ausentes viram texto vazio.
export function preencher(modelo, dados) {
  return String(modelo).replace(/\{(\w+)\}/g, (_, k) => dados[k] ?? '');
}

export function primeiroNome(nome) {
  return String(nome || '').trim().split(/\s+/)[0] || 'cliente';
}

export const esperar = (ms) => new Promise((r) => setTimeout(r, ms));

export function aleatorioEntre(min, max) {
  return min + Math.random() * (max - min);
}

// Linha extra com o rastreio do pedido (vazia se ainda não houver).
export function linhaRastreio(pedido) {
  if (pedido.rastreio_url) return `\nRastreio: ${pedido.rastreio_url}`;
  if (pedido.rastreio_codigo) return `\nCódigo de rastreio: ${pedido.rastreio_codigo}`;
  return '';
}
