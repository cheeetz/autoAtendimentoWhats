// Confere o config/bot.json e aponta o que está errado, em português.
//
//   npm run conferir
//
import { existsSync, readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const TIPOS = ['texto', 'pedido', 'catalogo', 'atendente'];
const ehUrl = (v) => /^https?:\/\//i.test(v);

/** Devolve { erros, avisos }: erros impedem o bot de funcionar direito; avisos são só alertas. */
export function validarConfig(bot, { existe = existsSync } = {}) {
  const erros = [];
  const avisos = [];

  if (!bot.loja || bot.loja === 'Minha Loja') avisos.push('"loja" ainda está com o nome de exemplo ("Minha Loja")');

  const opcoes = bot.menu?.opcoes;
  if (!Array.isArray(opcoes) || !opcoes.length) {
    erros.push('"menu.opcoes" precisa ter pelo menos uma opção');
  } else {
    const teclas = new Set();
    opcoes.forEach((o, i) => {
      const onde = `menu.opcoes[${i + 1}]`;
      if (!o.tecla) erros.push(`${onde}: falta "tecla"`);
      if (!o.titulo) erros.push(`${onde}: falta "titulo"`);
      if (!TIPOS.includes(o.tipo)) erros.push(`${onde}: "tipo" deve ser um de: ${TIPOS.join(', ')}`);
      if (o.tipo === 'texto' && !o.resposta) erros.push(`${onde}: opção do tipo "texto" precisa de "resposta"`);
      if (teclas.has(String(o.tecla))) erros.push(`${onde}: a tecla "${o.tecla}" está repetida`);
      teclas.add(String(o.tecla));
    });
    const voltar = bot.menu.voltar === false || bot.menu.voltar === null ? null : String(bot.menu.voltar?.tecla ?? '0');
    if (voltar && teclas.has(voltar)) erros.push(`a tecla "${voltar}" é usada pelo "voltar ao início" e por uma opção do menu`);
    if (!opcoes.some((o) => o.tipo === 'atendente')) avisos.push('o menu não tem nenhuma opção do tipo "atendente"');
  }
  for (const chave of ['saudacao', 'invalida', 'atendente', 'pedir_numero_pedido', 'pedido_nao_encontrado', 'pedido_status']) {
    if (!bot.menu?.[chave]) erros.push(`falta o texto "menu.${chave}"`);
  }

  const temCatalogo = Array.isArray(opcoes) && opcoes.some((o) => o.tipo === 'catalogo');
  const produtos = bot.catalogo?.produtos ?? [];
  if (temCatalogo && !produtos.length) avisos.push('o menu tem a opção de comprar, mas "catalogo.produtos" está vazio (a opção vai chamar um atendente)');
  produtos.forEach((p, i) => {
    const onde = `catalogo.produtos[${i + 1}]${p.nome ? ` (${p.nome})` : ''}`;
    if (!p.nome) erros.push(`${onde}: falta "nome"`);
    if (!p.preco) avisos.push(`${onde}: sem "preco"`);
    for (const campo of ['foto', 'pix_qr']) {
      if (p[campo] && !ehUrl(p[campo]) && !existe(p[campo])) erros.push(`${onde}: arquivo de "${campo}" não encontrado: ${p[campo]}`);
    }
    if (p.link && !ehUrl(p.link)) erros.push(`${onde}: "link" deve começar com http:// ou https://`);
    if (p.pix && /COLE-AQUI/i.test(p.pix)) erros.push(`${onde}: "pix" ainda está com o texto de exemplo`);
    if (p.link && /minhaloja\.com\.br/i.test(p.link)) avisos.push(`${onde}: "link" ainda aponta para o endereço de exemplo`);
    if (!p.link && !p.pix && !p.pix_qr) avisos.push(`${onde}: sem "link" nem Pix; a compra será passada para um atendente`);
  });

  const horario = bot.notificacoes?.horario_envio;
  if (horario && !(Array.isArray(horario) && horario.length === 2 && horario[0] < horario[1])) {
    erros.push('"notificacoes.horario_envio" deve ser [hora inicial, hora final], ex.: [8, 21]');
  }
  if (bot.modo_teste?.ativo) avisos.push('o modo de teste está LIGADO: o bot só responde aos números de "modo_teste.numeros"');

  return { erros, avisos };
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const caminho = existsSync('config/bot.json') ? 'config/bot.json' : 'config/bot.example.json';
  console.log(`Conferindo ${caminho}...\n`);
  let bot;
  try {
    bot = JSON.parse(readFileSync(caminho, 'utf8'));
  } catch (erro) {
    console.error(`O arquivo não é um JSON válido: ${erro.message}`);
    console.error('Causas mais comuns: aspas faltando, vírgula sobrando no último item ou vírgula faltando entre dois itens.');
    process.exit(1);
  }
  const { erros, avisos } = validarConfig(bot);
  for (const e of erros) console.log(`ERRO   ${e}`);
  for (const a of avisos) console.log(`aviso  ${a}`);
  console.log(erros.length ? `\n${erros.length} erro(s) para corrigir.` : '\nNenhum erro encontrado.');
  process.exitCode = erros.length ? 1 : 0;
}
