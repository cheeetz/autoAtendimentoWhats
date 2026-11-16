# Manual do autoAtendimentoWhats

Este manual mostra onde mexer para cada coisa que você queira mudar no bot. Quase tudo se resolve em dois arquivos de configuração, sem tocar em código.

## Sumário

1. [Mapa rápido: quero mudar X, mexo em Y](#1-mapa-rápido-quero-mudar-x-mexo-em-y)
2. [Instalação do zero](#2-instalação-do-zero)
3. [Como editar o `config/bot.json` sem quebrar](#3-como-editar-o-configbotjson-sem-quebrar)
4. [Dados gerais da loja e do atendimento](#4-dados-gerais-da-loja-e-do-atendimento)
5. [Menu principal](#5-menu-principal)
6. [Catálogo e venda pelo WhatsApp](#6-catálogo-e-venda-pelo-whatsapp)
7. [Avisos de pedido](#7-avisos-de-pedido)
8. [Modo de teste](#8-modo-de-teste)
9. [Arquivo `.env`: plataforma da loja](#9-arquivo-env-plataforma-da-loja)
10. [Dia a dia: pedidos, atendimento humano, reinício](#10-dia-a-dia-pedidos-atendimento-humano-reinício)
11. [Deixar rodando sozinho no Windows](#11-deixar-rodando-sozinho-no-windows)
12. [Trocar de número, fazer backup e atualizar](#12-trocar-de-número-fazer-backup-e-atualizar)
13. [Problemas comuns](#13-problemas-comuns)
14. [Para quem quer mexer no código](#14-para-quem-quer-mexer-no-código)
15. [Segurança e privacidade](#15-segurança-e-privacidade)

---

## 1. Mapa rápido: quero mudar X, mexo em Y

Todos os campos abaixo ficam no `config/bot.json`, salvo indicação.

| Quero... | Onde |
|---|---|
| Mudar o nome da loja nas mensagens | `loja` |
| Mudar a mensagem de boas-vindas | `menu.saudacao` |
| Adicionar, tirar ou reordenar opções do menu | `menu.opcoes` ([seção 5](#5-menu-principal)) |
| Mudar o texto de uma resposta (trocas, frete...) | `resposta` da opção em `menu.opcoes` |
| Mudar ou desligar o "0 - Voltar ao início" | `menu.voltar` |
| Mudar a mensagem de "não entendi" | `menu.invalida` |
| Mudar a mensagem ao chamar atendente | `menu.atendente` |
| Mudar o tempo até encerrar por inatividade | `sessao_minutos` |
| Mudar ou desligar o aviso de encerramento | `menu.encerramento` |
| Mudar quanto tempo o bot fica calado após passar para atendente | `pausa_atendente_horas` |
| Cadastrar, editar ou remover produtos | `catalogo.produtos` ([seção 6](#6-catálogo-e-venda-pelo-whatsapp)) |
| Trocar a foto de um produto | arquivo em `config/fotos/` + campo `foto` do produto |
| Mudar o link de pagamento ou o Pix de um produto | campos `link`, `pix`, `pix_qr` do produto |
| Mudar as perguntas do fechamento da compra | textos em `catalogo` ([seção 6.4](#64-textos-do-fechamento-da-compra)) |
| Vender sem pedir nome e endereço | `catalogo.pedir_dados: false` |
| Pedir o endereço por extenso em vez de CEP | `catalogo.endereco_por_cep: false` |
| Mudar o texto dos avisos de pedido | `notificacoes.mensagens` |
| Desligar um aviso específico | colocar `null` no aviso em `notificacoes.mensagens` |
| Mudar o horário em que os avisos saem | `notificacoes.horario_envio` |
| Testar sem responder a todo mundo | `modo_teste` ([seção 8](#8-modo-de-teste)) |
| Ligar o bot a uma plataforma de loja | arquivo `.env` ([seção 9](#9-arquivo-env-plataforma-da-loja)) |
| Marcar um pedido como pago, enviado, entregue | comando `npm run pedido` ([seção 10](#10-dia-a-dia-pedidos-atendimento-humano-reinício)) |
| Trocar o número de WhatsApp do bot | apagar a pasta `auth/` ([seção 12](#12-trocar-de-número-fazer-backup-e-atualizar)) |
| Mudar os rótulos "aguardando pagamento", "em preparação" | código: `src/triagem.js` ([seção 14](#14-para-quem-quer-mexer-no-código)) |

Depois de qualquer mudança no `config/bot.json` ou no `.env`, **reinicie o bot** (Ctrl+C no terminal e `npm start` de novo). Ele só lê esses arquivos ao iniciar.

---

## 2. Instalação do zero

### 2.1 O que você precisa

- Um computador que fique ligado enquanto o bot atende.
- [Node.js](https://nodejs.org) versão 22.13 ou mais nova (baixe a versão "LTS").
- Um número de WhatsApp para o bot. Use um chip separado do número principal da loja: o bot conecta pelo WhatsApp Web com uma biblioteca não oficial, e o WhatsApp pode bloquear o número.

### 2.2 Passo a passo

1. Baixe o projeto: no GitHub, botão **Code > Download ZIP** e extraia; ou `git clone https://github.com/cheeetz/autoAtendimentoWhats.git`.
2. Abra o terminal dentro da pasta do projeto. No Windows: abra a pasta no Explorador, clique na barra de endereço, digite `cmd` e aperte Enter.
3. Confira o Node: `node -v` deve mostrar `v22.13` ou maior.
4. Instale as dependências:
   ```
   npm install
   ```
5. Crie seus arquivos de configuração a partir dos modelos:
   ```
   copy .env.example .env
   copy config\bot.example.json config\bot.json
   ```
   No Linux ou Mac, use `cp` no lugar de `copy` e `/` no lugar de `\`.
6. Edite o `config/bot.json` com os dados da sua loja (seções 4 a 7).
7. Confira se ficou tudo certo:
   ```
   npm run conferir
   ```
8. Inicie o bot:
   ```
   npm start
   ```
9. Na primeira vez aparece um QR Code no terminal. No celular do bot: **WhatsApp > Dispositivos conectados > Conectar dispositivo** e escaneie. Quando aparecer `[whatsapp] conectado`, está no ar.

Para parar o bot: Ctrl+C no terminal (no Windows ele pergunta "Deseja finalizar o arquivo em lotes?"; responda `s`).

### 2.3 Arquivos que são seus

Estes arquivos e pastas guardam os dados da sua loja. Eles não vão para o Git e não são sobrescritos quando você atualiza o projeto:

| Arquivo ou pasta | O que guarda |
|---|---|
| `config/bot.json` | Textos, menu, produtos e regras do bot |
| `config/fotos/` | Fotos dos produtos e QR Codes de Pix |
| `.env` | Plataforma da loja e credenciais |
| `auth/` | Sessão do WhatsApp (equivale a estar logado no número) |
| `data/bot.db` | Banco com pedidos, clientes e estado das conversas |

---

## 3. Como editar o `config/bot.json` sem quebrar

O arquivo é um JSON. Abra com o Bloco de Notas ou, melhor, com o [VS Code](https://code.visualstudio.com), que marca os erros em vermelho.

Regras que mais causam erro:

- **Todo texto fica entre aspas duplas:** `"loja": "Minha Loja"`. Números, `true`, `false` e `null` ficam sem aspas.
- **Vírgula entre itens, mas não depois do último** de uma lista ou bloco.
- **Quebra de linha dentro de um texto é `\n`**, e não Enter. Exemplo: `"Olá!\nComo posso ajudar?"`. Linha em branco é `\n\n`.
- **Aspas dentro de um texto** precisam de barra: `"Responda \"sim\" para confirmar"`.
- Emojis e acentos podem ser usados normalmente. Salve o arquivo em UTF-8 (é o padrão do VS Code e do Bloco de Notas atual).

Formatação do WhatsApp funciona nos textos: `*negrito*`, `_itálico_`, `~riscado~`.

Trechos entre chaves, como `{loja}` ou `{nome}`, são substituídos pelo bot na hora de enviar. Cada texto aceita campos específicos, listados nas seções abaixo. Um campo que não existe naquele texto simplesmente some da mensagem.

Sempre que editar, rode:

```
npm run conferir
```

Ele aponta JSON inválido, opção de menu sem resposta, tecla repetida, foto que não existe, Pix de exemplo esquecido e modo de teste ligado.

---

## 4. Dados gerais da loja e do atendimento

No topo do `config/bot.json`:

```json
"loja": "Minha Loja",
"sessao_minutos": 15,
"pausa_atendente_horas": 12,
```

| Campo | O que faz | Padrão |
|---|---|---|
| `loja` | Nome usado onde aparecer `{loja}` | — |
| `sessao_minutos` | Minutos sem interação até o bot encerrar o atendimento. A mensagem seguinte do cliente recebe o menu do início. Uma compra pela metade é descartada | 15 |
| `pausa_atendente_horas` | Horas em que o bot fica calado numa conversa depois de passá-la para um atendente, ou depois de você responder pelo celular | 12 |

---

## 5. Menu principal

### 5.1 Opções

```json
"menu": {
  "saudacao": "Olá! Aqui é o atendimento da {loja}. Responda com o número da opção:",
  "opcoes": [
    { "tecla": "1", "titulo": "Comprar", "tipo": "catalogo" },
    { "tecla": "2", "titulo": "Status do meu pedido", "tipo": "pedido" },
    { "tecla": "3", "titulo": "Trocas e devoluções", "tipo": "texto", "resposta": "Você pode pedir troca em até 7 dias..." },
    { "tecla": "4", "titulo": "Falar com atendente", "tipo": "atendente" }
  ]
}
```

Cada opção tem:

| Campo | O que é |
|---|---|
| `tecla` | O que o cliente digita para escolher. Não repita teclas, e não use a tecla do "voltar" (`0` por padrão) |
| `titulo` | O texto que aparece no menu |
| `tipo` | O que a opção faz (tabela abaixo) |
| `resposta` | Só para o tipo `texto`: a mensagem enviada |

Tipos disponíveis:

| Tipo | O que faz |
|---|---|
| `texto` | Envia a `resposta` e continua no menu |
| `catalogo` | Abre a lista de produtos ([seção 6](#6-catálogo-e-venda-pelo-whatsapp)) |
| `pedido` | Mostra o status do último pedido do telefone de quem escreveu. Se não achar, pede o número do pedido |
| `atendente` | Avisa que um humano vai responder e pausa o bot naquela conversa |

O menu é montado na ordem da lista. Para **adicionar** uma opção, copie um bloco `{ ... }`, cole na posição desejada e ajuste a tecla. Para **remover**, apague o bloco inteiro. Para **reordenar**, mude os blocos de lugar e renumere as teclas. Você pode ter quantas opções `texto` quiser.

### 5.2 Voltar ao início

```json
"voltar": { "tecla": "0", "texto": "0 - Voltar ao início" }
```

Essa linha aparece no fim de cada resposta. Além da tecla, as palavras "menu", "voltar" e "início" também voltam ao menu. Para desligar: `"voltar": false`.

### 5.3 Textos do menu

| Campo | Quando é enviado | Campos aceitos |
|---|---|---|
| `menu.saudacao` | Cabeçalho do menu | `{loja}` |
| `menu.invalida` | Resposta que não é nenhuma opção | — |
| `menu.atendente` | Ao passar para um atendente | — |
| `menu.encerramento` | Ao encerrar por inatividade. Apague a linha para encerrar em silêncio | `{loja}` |
| `menu.pedir_numero_pedido` | Não achou pedido pelo telefone | — |
| `menu.pedido_nao_encontrado` | Número de pedido não existe (em seguida a conversa vai para atendente) | — |
| `menu.pedido_status` | Resposta com o status do pedido | `{numero}`, `{pagamento}`, `{envio}`, `{rastreio_linha}` |

`{rastreio_linha}` vira uma linha com o link ou o código de rastreio, ou fica vazia se o pedido ainda não tem rastreio. Por isso ela vai colada ao texto anterior, sem `\n` antes.

### 5.4 Regras de comportamento

- A primeira mensagem de um contato sempre recebe o menu.
- Duas respostas seguidas fora das opções passam a conversa para um atendente.
- Quando você responde o cliente pelo celular do bot, o bot percebe e fica calado naquela conversa por `pausa_atendente_horas`.
- Depois de pedir atendente, o cliente ainda pode voltar ao menu com `0`, até alguém responder pelo celular.
- Grupos, listas de transmissão, canais e status são ignorados.

---

## 6. Catálogo e venda pelo WhatsApp

### 6.1 Como é a conversa

1. O cliente escolhe a opção do tipo `catalogo` e recebe a lista de produtos, numerada automaticamente.
2. Escolhe um produto e recebe a ficha (foto, descrição, preço) com `1 - Comprar` e `2 - Voltar aos produtos`.
3. Ao comprar, informa nome completo, CEP e número do endereço.
4. Confere o resumo e confirma.
5. O bot registra o pedido (`W1`, `W2`...), envia o link ou o Pix e avisa você na conversa **Mensagem para mim** do número do bot.

### 6.2 Cadastrar produtos

```json
"catalogo": {
  "titulo": "Escolha um produto:",
  "produtos": [
    {
      "nome": "Camiseta Preta",
      "descricao": "100% algodão, tamanhos P ao GG.",
      "preco": "R$ 89,90",
      "foto": "config/fotos/camiseta-preta.jpg",
      "link": "https://minhaloja.com.br/produtos/camiseta-preta"
    },
    {
      "nome": "Boné",
      "descricao": "Aba curva, ajuste traseiro.",
      "preco": "R$ 59,90",
      "pix": "00020126580014BR.GOV.BCB.PIX...",
      "pix_qr": "config/fotos/pix-bone.png"
    }
  ]
}
```

| Campo do produto | Obrigatório | O que é |
|---|---|---|
| `nome` | Sim | Nome na lista e na ficha |
| `descricao` | Não | Texto da ficha. Use `\n` para quebrar linha |
| `preco` | Não | Texto livre, do jeito que deve aparecer (`"R$ 89,90"`) |
| `foto` | Não | Caminho de um arquivo ou URL de imagem. Sem foto, a ficha vai só com texto |
| `link` | Não | Link de pagamento ou da página do produto, enviado ao confirmar a compra |
| `pix` | Não | Código Pix copia e cola. Vai sozinho em uma mensagem, para facilitar a cópia |
| `pix_qr` | Não | Imagem do QR Code do Pix (arquivo ou URL) |

Um produto pode ter `link`, Pix ou os dois. **Sem nenhum dos três**, o pedido é registrado e a conversa vai para um atendente combinar o pagamento.

A ordem da lista é a ordem do menu de produtos. Para tirar um produto de venda, apague o bloco dele.

### 6.3 Fotos

1. Salve as imagens em `config/fotos/` (crie a pasta se não existir). Formatos JPG ou PNG.
2. No produto, escreva o caminho com barras normais: `"foto": "config/fotos/camiseta-preta.jpg"`.
3. Prefira nomes de arquivo sem espaços nem acentos.

Se o arquivo não existir ou falhar no envio, o bot manda a ficha só com o texto e registra o erro no terminal. O `npm run conferir` avisa de fotos que não encontrou.

### 6.4 Textos do fechamento da compra

Todos ficam dentro de `catalogo`. Se você não incluir um deles, o bot usa o texto padrão.

| Campo | Quando é enviado | Campos aceitos |
|---|---|---|
| `titulo` | Cabeçalho da lista de produtos | — |
| `produto` | Modelo da ficha do produto | qualquer campo do produto: `{nome}`, `{descricao}`, `{preco}` |
| `acao_comprar` | Texto da ação 1 na ficha (padrão "Comprar") | — |
| `acao_voltar` | Texto da ação 2 na ficha (padrão "Voltar aos produtos") | — |
| `pedir_nome` | Pede o nome completo | — |
| `pedir_cep` | Pede o CEP | — |
| `cep_nao_encontrado` | CEP inválido ou inexistente | — |
| `pedir_numero` | Mostra a rua encontrada e pede o número | `{logradouro}`, `{bairro}`, `{cidade}`, `{uf}`, `{cep}` |
| `numero_invalido` | Resposta sem nenhum número | — |
| `pedir_rua` | CEP geral, sem rua: pede rua, número e bairro | `{cidade}`, `{uf}`, `{cep}` |
| `pedir_endereco` | Pede o endereço por extenso (CEP desligado ou consulta falhou) | — |
| `pedir_telefone` | Só quando o WhatsApp não informa o número do cliente | — |
| `confirmar` | Resumo antes de registrar | `{produto}`, `{preco}`, `{nome}`, `{endereco}`, `{telefone}` |
| `pedido_registrado` | Confirmação com o número do pedido | `{numero}` |
| `comprar_link` | Envia o link de pagamento | `{nome}`, `{preco}`, `{link}` |
| `comprar_pix` | Anuncia o Pix | `{nome}`, `{preco}` |
| `comprar_atendente` | Produto sem link nem Pix | `{nome}` |
| `depois_da_compra` | Mensagem final após o pagamento | — |

No texto `confirmar`, mantenha as linhas `1 - Confirmar` e `2 - Corrigir`: são essas as respostas que o bot espera nesse passo.

### 6.5 Opções do fluxo

| Campo | O que faz | Padrão |
|---|---|---|
| `pedir_dados` | `false` pula nome e endereço e manda o pagamento direto, sem registrar pedido | `true` |
| `endereco_por_cep` | `false` pede o endereço por extenso em vez de CEP + número | `true` |

O CEP é consultado no [ViaCEP](https://viacep.com.br), serviço público e gratuito, e por isso o computador do bot precisa de internet. Se a consulta falhar, o bot pede o endereço por extenso sozinho.

### 6.6 O que o bot não faz

- **Não confirma pagamento.** Ele envia o link ou o Pix; quem confere se o dinheiro entrou e marca o pedido como pago é você ([seção 10](#10-dia-a-dia-pedidos-atendimento-humano-reinício)).
- **Não calcula frete, não controla estoque e não pergunta tamanho ou cor.** Se precisar disso, use como `link` a página do produto na sua loja online, onde o checkout resolve, ou cadastre cada variação como um produto.

---

## 7. Avisos de pedido

O bot avisa o cliente quando o status de um pedido muda.

```json
"notificacoes": {
  "horario_envio": [8, 21],
  "intervalo_segundos": [8, 20],
  "mensagens": {
    "pedido_recebido": "Olá, {nome}! Recebemos seu pedido #{numero} na {loja}.",
    "pagamento_aprovado": "{nome}, o pagamento do pedido #{numero} foi aprovado.",
    "pedido_enviado": "{nome}, seu pedido #{numero} foi enviado!{rastreio_linha}",
    "pedido_entregue": "{nome}, o pedido #{numero} consta como entregue.",
    "pedido_cancelado": "{nome}, o pedido #{numero} foi cancelado."
  }
}
```

| Campo | O que faz |
|---|---|
| `horario_envio` | Hora inicial e final em que os avisos podem sair. `[8, 21]` = das 8h às 20h59. Fora disso, ficam na fila e saem na manhã seguinte |
| `intervalo_segundos` | Espera aleatória, entre o mínimo e o máximo, de um aviso para o outro. Não reduza demais: envios em rajada aumentam o risco de bloqueio |
| `mensagens` | Texto de cada aviso. Coloque `null` para desligar um aviso |

Campos aceitos nos avisos: `{loja}`, `{nome}` (primeiro nome do cliente), `{numero}` e `{rastreio_linha}`.

Quando cada aviso sai:

| Aviso | Quando |
|---|---|
| `pedido_recebido` | Pedido novo vindo da plataforma da loja. Pedidos feitos pelo WhatsApp não usam esse aviso, porque o bot já confirma na própria conversa |
| `pagamento_aprovado` | Pedido passou a "pago" |
| `pedido_enviado` | Pedido passou a "enviado" |
| `pedido_entregue` | Pedido passou a "entregue" |
| `pedido_cancelado` | Pedido foi cancelado |

Cada aviso sai uma única vez por pedido. O aviso de "novo pedido" para o dono da loja sai na hora, mesmo fora do `horario_envio`.

---

## 8. Modo de teste

Para testar em um número que você já usa, sem o bot responder aos seus contatos:

```json
"modo_teste": {
  "ativo": true,
  "numeros": ["5511999998888"]
}
```

Com `ativo: true`:

- O bot só responde, e só envia avisos de pedido, aos números da lista. Escreva o número com código do país e DDD, só dígitos.
- A conversa **Mensagem para mim** do próprio número funciona como cliente de teste, mesmo com a lista vazia: mande "oi" nela e o menu chega ali.
- Suas respostas manuais a outros contatos não mexem no estado do bot.

**Antes de colocar em uso, volte `ativo` para `false`.** O `npm run conferir` avisa quando o modo de teste está ligado, e o bot mostra `[teste] modo de teste ativo` ao iniciar.

---

## 9. Arquivo `.env`: plataforma da loja

O `.env` define de onde o bot lê os pedidos da loja online.

| Variável | O que faz |
|---|---|
| `LOJA_PLATAFORMA` | `nenhuma`, `exemplo` ou `nuvemshop` |
| `SYNC_INTERVALO_MINUTOS` | De quanto em quanto tempo buscar pedidos alterados |
| `NUVEMSHOP_STORE_ID`, `NUVEMSHOP_TOKEN`, `NUVEMSHOP_USER_AGENT` | Credenciais da API da Nuvemshop |

### `nenhuma`

Sem ligação com plataforma. O menu, o catálogo e os pedidos feitos pelo WhatsApp funcionam normalmente. É o suficiente para quem vende só pelo WhatsApp.

### `exemplo`

Lê pedidos do arquivo `data/pedidos-exemplo.json`. Serve para testar os avisos sem uma loja real. Crie o arquivo assim:

```json
[
  {
    "id": "1",
    "numero": "1001",
    "cliente_nome": "Maria Silva",
    "telefone": "5511999998888",
    "pagamento": "pendente",
    "envio": "nao_enviado",
    "cancelado": false,
    "rastreio_codigo": null,
    "criado_em": "2026-01-10T12:00:00Z",
    "atualizado_em": "2026-01-10T12:00:00Z"
  }
]
```

Com o bot rodando, mude `pagamento` para `"pago"` e salve: na próxima sincronização o aviso sai. Valores aceitos: `pagamento` = `pendente`, `pago`, `reembolsado`, `cancelado`; `envio` = `nao_enviado`, `enviado`, `entregue`.

### `nuvemshop`

A API exige um aplicativo criado no [portal de parceiros](https://www.nuvemshop.com.br/parceiros), com o escopo `read_orders`. Ao autorizar o aplicativo na sua loja você recebe o `access_token`, que vai em `NUVEMSHOP_TOKEN`, e o `user_id`, que vai em `NUVEMSHOP_STORE_ID`. O passo a passo está na [documentação de autenticação](https://tiendanube.github.io/api-documentation/authentication). Em `NUVEMSHOP_USER_AGENT` coloque o nome do seu aplicativo e um e-mail de contato, como a API exige.

O adaptador da Nuvemshop foi escrito a partir da documentação e testado com respostas simuladas. Ainda não foi validado contra uma loja real; se algo não bater, o ajuste é em `src/lojas/nuvemshop.js`.

Na primeira sincronização o bot só carrega os pedidos dos últimos 30 dias, sem avisar ninguém. Os avisos valem para mudanças a partir daí.

---

## 10. Dia a dia: pedidos, atendimento humano, reinício

### 10.1 Pedidos feitos pelo WhatsApp

Quando um cliente fecha uma compra, você recebe em **Mensagem para mim** (no WhatsApp do número do bot) o produto, o nome, o endereço e o telefone.

Para acompanhar e atualizar, abra um segundo terminal na pasta do projeto. O bot pode continuar rodando no primeiro.

| Comando | O que faz |
|---|---|
| `npm run pedido` | Lista os últimos pedidos |
| `npm run pedido -- W1` | Mostra nome, endereço, telefone e status do pedido W1 |
| `npm run pedido -- W1 pago` | Marca como pago e avisa o cliente |
| `npm run pedido -- W1 enviado BR123456789BR` | Marca como enviado. O código de rastreio é opcional |
| `npm run pedido -- W1 entregue` | Marca como entregue |
| `npm run pedido -- W1 cancelado` | Cancela e avisa o cliente |

Os dois traços (`--`) antes do número do pedido são obrigatórios. O aviso entra na fila e o bot envia em até 15 segundos, dentro do `horario_envio`.

Fluxo típico: chegou o aviso de novo pedido → você confere o pagamento no banco → `npm run pedido -- W1 pago` → despacha → `npm run pedido -- W1 enviado CODIGO`.

Pedidos que vêm da plataforma da loja não são alterados por esse comando: o status deles muda na própria plataforma e o bot acompanha.

### 10.2 Atendimento humano

- Para assumir uma conversa, basta responder o cliente pelo celular do bot. O bot fica calado naquela conversa por `pausa_atendente_horas`.
- Passado esse tempo, a próxima mensagem do cliente volta a receber o menu.
- Não há comando para "devolver" uma conversa ao bot antes do prazo. Se precisar, reduza `pausa_atendente_horas`.

### 10.3 Reiniciar

Reinicie o bot sempre que alterar o `config/bot.json` ou o `.env`: Ctrl+C e `npm start`. Não é preciso escanear o QR Code de novo; a sessão fica salva em `auth/`.

---

## 11. Deixar rodando sozinho no Windows

O projeto traz o arquivo `iniciar.bat`, que inicia o bot e o reinicia sozinho se ele parar.

- **Para usar no dia a dia:** dê dois cliques em `iniciar.bat`. Para encerrar, feche a janela.
- **Para iniciar junto com o Windows:**
  1. Clique com o botão direito em `iniciar.bat` > **Criar atalho**.
  2. Aperte Win+R, digite `shell:startup` e aperte Enter.
  3. Mova o atalho para a pasta que abriu.

Também ajuste o Windows para não suspender: **Configurações > Sistema > Energia > Suspender** em "Nunca" quando ligado na tomada. Com o computador suspenso, o bot não responde.

Faça o primeiro `npm start` manualmente, para escanear o QR Code, antes de usar o `iniciar.bat`.

---

## 12. Trocar de número, fazer backup e atualizar

### Trocar o número do bot

1. Pare o bot.
2. Apague a pasta `auth/`.
3. Rode `npm start` e escaneie o QR Code com o número novo.

Os pedidos e as configurações continuam os mesmos.

### Desconectar o bot

No celular: **WhatsApp > Dispositivos conectados**, toque no dispositivo e em **Desconectar**. O bot mostra "sessão encerrada pelo celular" e para. Para voltar, apague `auth/` e escaneie de novo.

### Backup

Copie para um lugar seguro: `config/bot.json`, `config/fotos/`, `.env` e `data/bot.db`. Com esses quatro você remonta o bot em outro computador. Não é preciso copiar `auth/` (basta escanear o QR Code de novo) nem `node_modules/` (o `npm install` recria).

### Zerar tudo

Apagar `data/bot.db` com o bot parado zera as conversas **e também os pedidos**. Faça backup antes se houver pedidos reais.

### Atualizar o projeto

1. Pare o bot.
2. Baixe a versão nova: `git pull` (ou **Fetch origin** e **Pull** no GitHub Desktop). Se você baixou em ZIP, baixe o ZIP novo e copie por cima, preservando os arquivos da [seção 2.3](#23-arquivos-que-são-seus).
3. Rode `npm install`.
4. Compare seu `config/bot.json` com o `config/bot.example.json` novo, para ver se surgiram opções.
5. Rode `npm run conferir` e depois `npm start`.

---

## 13. Problemas comuns

| Sintoma | Causa provável e solução |
|---|---|
| `is not valid JSON` ao iniciar | Erro de digitação no `config/bot.json` (ou no `data/pedidos-exemplo.json`). Rode `npm run conferir`; veja a [seção 3](#3-como-editar-o-configbotjson-sem-quebrar) |
| O bot não responde a ninguém | `modo_teste.ativo` está `true`. Volte para `false` e reinicie |
| O bot não responde a um cliente específico | A conversa está pausada: ele pediu atendente ou você respondeu pelo celular. Volta sozinha após `pausa_atendente_horas` |
| Mudei o `bot.json` e nada mudou | O bot só lê a configuração ao iniciar. Reinicie |
| A foto do produto não chega | Caminho errado no campo `foto` ou arquivo fora de `config/fotos/`. O terminal mostra `não consegui enviar a imagem` |
| O bot pede o endereço por extenso em vez do CEP | A consulta ao ViaCEP falhou (sem internet ou serviço fora do ar). O terminal mostra uma linha `[cep]` |
| O aviso de pedido não saiu | Está fora do `horario_envio`, ou o texto daquele aviso está `null`, ou o modo de teste está ligado e o número não está na lista |
| `sessão encerrada pelo celular` | O dispositivo foi desconectado no WhatsApp. Apague `auth/` e escaneie o QR Code de novo |
| `conexão caiu (...) reconectando` | Normal. O bot reconecta sozinho em 5 segundos |
| O QR Code não aparece | Já existe uma sessão salva em `auth/`. Se quer conectar outro número, apague a pasta |
| Erro citando `node:sqlite` ou sintaxe ao iniciar | Node antigo. Instale a versão 22.13 ou mais nova |
| `npm` não é reconhecido | O Node.js não está instalado, ou o terminal foi aberto antes da instalação. Feche e abra o terminal |
| O número foi bloqueado pelo WhatsApp | Risco de usar biblioteca não oficial. Não há como reverter pelo bot; por isso a recomendação de um chip separado |

---

## 14. Para quem quer mexer no código

### Mapa dos arquivos

| Arquivo | Responsabilidade |
|---|---|
| `src/index.js` | Ponto de entrada: liga configuração, banco, WhatsApp, sincronização, encerramento por inatividade e fila de avisos |
| `src/whatsapp.js` | Conexão (Baileys), QR Code, reconexão, recebimento e envio de mensagens e imagens |
| `src/triagem.js` | Toda a conversa: menu, catálogo, fechamento de compra, consulta de pedido, encerramento por inatividade. Não acessa a rede |
| `src/cep.js` | Consulta de CEP no ViaCEP |
| `src/pedidos-locais.js` | Criação e mudança de status dos pedidos feitos pelo WhatsApp |
| `src/cli-pedido.js` | Comando `npm run pedido` |
| `src/conferir.js` | Comando `npm run conferir` |
| `src/sync.js` | Sincronização com a plataforma, detecção de mudanças de status e montagem dos avisos |
| `src/notificador.js` | Fila de envio dos avisos (horário, intervalo, modo de teste) |
| `src/db.js` | Banco SQLite: tabelas `pedidos`, `conversas`, `notificacoes`, `meta` |
| `src/teste.js` | Regras do modo de teste |
| `src/logs.js` | Filtro que impede a biblioteca de criptografia de imprimir chaves de sessão |
| `src/config.js` | Leitura do `.env` e do `config/bot.json` |
| `src/util.js` | Telefones, preenchimento de modelos e utilitários |
| `src/lojas/` | Adaptadores de plataforma (`nuvemshop.js`, `exemplo.js`) |
| `test/` | Testes automatizados (`npm test`) |

### Onde fica cada comportamento fixo

| Comportamento | Onde |
|---|---|
| Rótulos de status ("aguardando pagamento", "em preparação"...) | `ROTULOS`, no topo de `src/triagem.js` |
| Textos padrão do fechamento da compra | `TEXTOS_COMPRA`, em `src/triagem.js` |
| Quantas respostas inválidas até chamar atendente (2) | `respostaInvalida`, em `src/triagem.js` |
| Palavras que voltam ao menu ("menu", "voltar", "início") | `pediuVoltar`, em `src/triagem.js` |
| Tamanho mínimo de nome (3) e de endereço por extenso (10) | passos `nome` e `endereco`, em `src/triagem.js` |
| Prefixo e sequência do número de pedido (`W1`) | `criarPedidoLocal`, em `src/pedidos-locais.js` |
| Texto do aviso de novo pedido para o dono | `criarPedidoLocal`, em `src/pedidos-locais.js` |
| Atraso de 1 a 2,5 segundos antes de cada resposta | `aoReceber`, em `src/index.js` |
| Intervalo de 30 segundos da verificação de inatividade | `setInterval`, em `src/index.js` |
| Intervalo de 15 segundos da fila de avisos | `iniciarNotificador`, em `src/notificador.js` |
| Janela de 30 dias da primeira sincronização | `sincronizar`, em `src/sync.js` |
| Regras de quando cada aviso é gerado | `detectarEventos`, em `src/sync.js` |
| Conversão dos status da Nuvemshop | tabelas `PAGAMENTO` e `ENVIO`, em `src/lojas/nuvemshop.js` |
| Mensagens antigas ignoradas ao reconectar (mais de 120 segundos) | `messages.upsert`, em `src/whatsapp.js` |

### Adicionar outra plataforma de loja

1. Crie `src/lojas/<nome>.js` exportando `criar(env)`, que devolve um objeto com o método `listarPedidosAtualizados(desde)`.
2. Esse método recebe uma data e devolve a lista de pedidos alterados desde então, no formato descrito no topo de `src/lojas/index.js`.
3. Registre o adaptador em `ADAPTADORES`, no mesmo arquivo.
4. Use `LOJA_PLATAFORMA=<nome>` no `.env`.

O resto (banco, detecção de mudanças, avisos) já funciona para qualquer adaptador.

### Testes

```
npm test
```

Os testes cobrem a lógica da conversa, os pedidos, a sincronização e a conferência da configuração, sem conectar no WhatsApp. Rode antes e depois de mexer no código.

---

## 15. Segurança e privacidade

- **Nunca publique nem compartilhe** `auth/` (quem tem essa pasta está logado no seu número), `data/` (dados de clientes), `.env` e `config/bot.json`. Todos já estão no `.gitignore`.
- **Não cole a saída do terminal em lugares públicos** sem revisar: ela pode conter telefones de clientes.
- **Dados de clientes:** nome, endereço e telefone ficam em `data/bot.db`. Pela LGPD, use esses dados só para a entrega e o atendimento, guarde o arquivo com cuidado e apague os dados de quem pedir.
- **Risco de bloqueio:** o bot não usa a API oficial da Meta. Para reduzir o risco, use um chip separado, não faça disparo em massa, mantenha o `intervalo_segundos` e só envie mensagens a quem já falou com a loja ou comprou.
- **Consulta por número de pedido:** qualquer pessoa pode digitar um número de pedido, e por isso a resposta traz só status e rastreio, nunca nome ou endereço.
