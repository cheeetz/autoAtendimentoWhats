import { chaveTelefone } from './util.js';

// Modo de teste: com "modo_teste.ativo": true no config/bot.json, o bot só
// responde (e só envia avisos de pedido) aos números de "modo_teste.numeros".
// A conversa "Mensagem para mim" do próprio número também vale como teste.

export function modoTesteAtivo(bot) {
  return bot.modo_teste?.ativo === true;
}

export function numeroPermitido(bot, telefone) {
  if (!modoTesteAtivo(bot)) return true;
  const chave = chaveTelefone(telefone);
  if (!chave) return false;
  return (bot.modo_teste.numeros ?? []).some((n) => chaveTelefone(n) === chave);
}
