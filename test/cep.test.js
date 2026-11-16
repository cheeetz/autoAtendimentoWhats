import assert from 'node:assert/strict';
import { test } from 'node:test';
import { consultarCep } from '../src/cep.js';

const resposta = (corpo, ok = true, status = 200) => async (url) => ({ ok, status, json: async () => corpo, url });

test('converte a resposta do ViaCEP', async () => {
  const buscar = resposta({ cep: '01001-000', logradouro: 'Rua das Flores', bairro: 'Centro', localidade: 'São Paulo', uf: 'SP' });
  assert.deepEqual(await consultarCep('01.001-000', buscar), {
    cep: '01001-000', logradouro: 'Rua das Flores', bairro: 'Centro', cidade: 'São Paulo', uf: 'SP',
  });
});

test('CEP inexistente devolve null (erro vem como true ou "true")', async () => {
  assert.equal(await consultarCep('00000000', resposta({ erro: true })), null);
  assert.equal(await consultarCep('00000000', resposta({ erro: 'true' })), null);
});

test('serviço fora do ar lança erro', async () => {
  await assert.rejects(consultarCep('01001000', resposta({}, false, 502)), /ViaCEP respondeu 502/);
});
