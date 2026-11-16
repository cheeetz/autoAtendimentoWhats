// Consulta de CEP no ViaCEP (https://viacep.com.br), serviço público e gratuito.
// Devolve { cep, logradouro, bairro, cidade, uf }, ou null se o CEP não existe.
// Lança erro se o serviço estiver fora do ar (quem chama decide o que fazer).
export async function consultarCep(cep, buscar = fetch) {
  const numeros = String(cep).replace(/\D/g, '');
  const resp = await buscar(`https://viacep.com.br/ws/${numeros}/json/`, { signal: AbortSignal.timeout(6000) });
  if (!resp.ok) throw new Error(`ViaCEP respondeu ${resp.status}`);
  const dados = await resp.json();
  if (dados.erro) return null;
  return {
    cep: dados.cep ?? `${numeros.slice(0, 5)}-${numeros.slice(5)}`,
    logradouro: dados.logradouro ?? '',
    bairro: dados.bairro ?? '',
    cidade: dados.localidade ?? '',
    uf: dados.uf ?? '',
  };
}
