import assert from 'node:assert/strict';
import { test } from 'node:test';
import { modoTesteAtivo, numeroPermitido } from '../src/teste.js';

test('fora do modo de teste, todo número é atendido', () => {
  assert.equal(modoTesteAtivo({}), false);
  assert.equal(numeroPermitido({}, '5511988887777'), true);
  assert.equal(numeroPermitido({ modo_teste: { ativo: false, numeros: [] } }, ''), true);
});

test('em modo de teste, só os números da lista são atendidos', () => {
  const bot = { modo_teste: { ativo: true, numeros: ['(11) 99999-8888'] } };
  assert.equal(numeroPermitido(bot, '5511999998888'), true);
  assert.equal(numeroPermitido(bot, '551199998888'), true); // sem o nono dígito
  assert.equal(numeroPermitido(bot, '5511988887777'), false);
  assert.equal(numeroPermitido(bot, ''), false);
  assert.equal(numeroPermitido({ modo_teste: { ativo: true } }, '5511999998888'), false);
});
