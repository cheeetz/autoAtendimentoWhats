import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import { validarConfig } from '../src/conferir.js';

const exemplo = () => JSON.parse(readFileSync('config/bot.example.json', 'utf8'));
const tudoExiste = { existe: () => true };

test('o exemplo só tem os erros esperados de quem ainda não personalizou', () => {
  const { erros, avisos } = validarConfig(exemplo(), tudoExiste);
  assert.deepEqual(erros, ['catalogo.produtos[2] (Produto B): "pix" ainda está com o texto de exemplo']);
  assert.ok(avisos.some((a) => a.includes('Minha Loja')));
});

test('aponta opção sem resposta, tipo inválido, tecla repetida e conflito com o voltar', () => {
  const bot = exemplo();
  bot.menu.opcoes[2].resposta = '';
  bot.menu.opcoes[3].tipo = 'duvida';
  bot.menu.opcoes[4].tecla = '1';
  bot.menu.opcoes[1].tecla = '0';
  const { erros } = validarConfig(bot, tudoExiste);
  assert.ok(erros.some((e) => e.includes('precisa de "resposta"')));
  assert.ok(erros.some((e) => e.includes('"tipo" deve ser')));
  assert.ok(erros.some((e) => e.includes('tecla "1" está repetida')));
  assert.ok(erros.some((e) => e.includes('"voltar ao início" e por uma opção')));
});

test('aponta foto que não existe e aceita foto por URL', () => {
  const bot = exemplo();
  bot.catalogo.produtos[1].foto = 'https://exemplo.com/b.jpg';
  const { erros } = validarConfig(bot, { existe: () => false });
  assert.ok(erros.some((e) => e.includes('arquivo de "foto" não encontrado: config/fotos/produto-a.jpg')));
  assert.ok(!erros.some((e) => e.includes('exemplo.com')));
});

test('avisa quando o modo de teste está ligado', () => {
  const bot = exemplo();
  bot.modo_teste.ativo = true;
  assert.ok(validarConfig(bot, tudoExiste).avisos.some((a) => a.includes('modo de teste está LIGADO')));
});
