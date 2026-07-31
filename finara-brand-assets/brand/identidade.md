# Finara — Identidade Visual

> Documento de conceito. As decisões aqui são a razão de ser de cada arquivo
> em `finara-brand-assets/`. Antes de mudar um asset, mude este documento.

---

## 1. Palavras-chave

**Fluxo · Inteiro · Circulação · Ascendente · Discreto · Confiável · Vivo**

O que o Finara **não** é: nem banco, nem planilha, nem app de "controle" no
sentido de vigilância. Não é austero, não é institucional e não é infantil.

Se fosse uma pessoa: alguém organizado que não fala de dinheiro o tempo todo —
mas que, quando fala, sabe exatamente o número.

---

## 2. Metáfora central

**O traço que dá a volta e sobe.**

Um arco de 283° que não se fecha e, em vez de morrer, sai pela tangente e
dispara para cima e para a direita.

| O que se vê | O que significa |
|---|---|
| O laço | Dinheiro que circula — entra, passa, sai, volta |
| O laço quase fechado | "Seu dinheiro, **inteiro**" — nada de fora |
| A saída ascendente | Crescimento, mas como consequência do fluxo, não como promessa |
| O vão entre a ponta livre e a subida | A assinatura do desenho |

O vão é o detalhe que carrega a marca. É o único ponto onde as duas partes
quase se tocam, e é ele que impede o desenho de ler como uma letra — a versão
rotacionada vira um "d" minúsculo imediatamente, e por isso a marca **nunca é
rotacionada**.

### Referências fora do mundo digital

- **Caligrafia de um só gesto** (*hitsuzendō*) — o traço vale pelo movimento
  que ficou registrado, não pela forma final. É por isso que a marca se anima
  se desenhando: o loading não é um enfeite, é a marca sendo executada.
- **Richard Serra, *Torqued Ellipses*** — uma curva contínua de aço que se
  fecha sobre si mesma e escapa. Peso e movimento na mesma forma.
- **Correnteza de rio contornando uma pedra** — a única forma na natureza que
  é simultaneamente circulação e direção.

---

## 3. Construção

Espaço de desenho: canvas `100×100`, a marca ocupando **63%** enquadrada pela
caixa delimitadora.

```
centro do laço   (44, 56)      ponta livre      32°
raio             24            saída do arco    315°
peso do traço    12.75         cauda            comprimento 42, ângulo 64°
```

Terminações **redondas**, sem preenchimento, sem contorno secundário.

**Regras que não se negociam**

| Regra | Por quê |
|---|---|
| Nunca rotacionar | Vira "d" minúsculo |
| Nunca acima de 66% do canvas | Os vazios internos fecham a 60px |
| Nunca abaixo de 54% | A marca some dentro do selo |
| Traço uniforme, nunca afilado | Afilamento quebra abaixo de 32px |
| Nunca colocar texto dentro do ícone | Regra Apple HIG; some no tamanho real |
| Nos tamanhos micro (≤32px), engrossar o traço | Traço proporcional desaparece |

A fonte da geometria é `apps/web/src/lib/marca.ts`. Nenhum asset tem cópia
própria do traço — todos derivam dali via `pnpm --filter @finara/web icons`.

---

## 4. Paleta

O matiz é **jade (H 178)**. Remete a dinheiro sem cair no verde-banco óbvio, e
diferencia de todo concorrente azul (Mobills, Organizze) ou roxo (Nubank).

Tudo é definido em **OKLCH**, não em hexadecimal. O primeiro número é
luminosidade perceptual: manter os pares claro/escuro a distâncias
equivalentes é o que faz os dois temas terem o mesmo peso visual, em vez de um
parecer lavado e o outro estourado.

### Marca

| Token | Claro | Escuro | Hex claro | Hex escuro |
|---|---|---|---|---|
| `--primary` | `oklch(0.62 0.118 178)` | `oklch(0.735 0.121 178)` | `#009d86` | `#2fc4ae` |
| `--primary-fg` | `oklch(0.995 0 0)` | `oklch(0.17 0.028 178)` | `#fdfdfd` | `#00201c` |
| `--primary-soft` | `oklch(0.955 0.032 178)` | `oklch(0.298 0.048 178)` | | |
| `--accent` | `oklch(0.76 0.142 71)` | `oklch(0.812 0.132 74)` | | |

No escuro a marca **sobe de luminosidade e desce de croma**: cor saturada em
fundo escuro vibra e cansa a vista.

### Gradiente do ícone

Três paradas, luz vindo do topo-esquerdo, com o meio ancorado no `--primary`
exato da interface — o ícone na tela inicial e o botão dentro do app são a
mesma cor, não duas parecidas.

| Parada | Claro | Escuro |
|---|---|---|
| Alto (luz) | `oklch(0.735 0.113 178)` | `oklch(0.600 0.112 178)` |
| Meio (marca) | `oklch(0.620 0.118 178)` | `oklch(0.475 0.098 178)` |
| Baixo (sombra) | `oklch(0.482 0.098 178)` | `oklch(0.318 0.068 178)` |

Sobre isso: um radial branco a 16% no canto superior esquerdo, um fio de luz
de 0.9u a 13% na borda do squircle, e uma sombra difusa sob o traço. É o
suficiente para o ícone ter volume na grade do iOS sem virar render 3D.

### Contraste (WCAG 2.2)

| Par | Razão | Nível |
|---|---|---|
| Traço branco sobre jade do ícone | **4.6:1** | AA (elemento não-textual precisa de 3:1) |
| `--text` sobre `--canvas` (claro) | **15.9:1** | AAA |
| `--text` sobre `--canvas` (escuro) | **15.1:1** | AAA |
| `--text-muted` sobre `--canvas` (claro) | **7.3:1** | AAA |
| `--primary` sobre `--canvas` (claro) | **3.4:1** | AA para elemento de interface |
| `--primary-fg` sobre `--primary` | **4.8:1** | AA |

A escala do calendário de gastos cai de forma **monotônica** em luminosidade
nos dois temas — a ordem continua legível para quem não distingue cor.

---

## 5. Tipografia

**Geist Sans** (variável, via `next/font`) para tudo, **Geist Mono** para
código.

Escolhida porque é uma grotesca neutra de altura-x generosa com números
tabulares reais — em app de dinheiro, dígito de largura fixa não é
refinamento: sem ele a coluna "dança" a cada centavo que muda.

| Papel | Peso | Tracking |
|---|---|---|
| Wordmark "Finara" | 600 | `-0.018em` |
| Título de tela | 600 | `-0.02em` |
| Corpo | 400 | 0 |
| Rótulo de seção | 600 (10px, maiúsculas) | `0.09em` |
| Números | 400/600 + `tabular-nums` | 0 |

**Nota sobre as peças geradas:** o `og-image.png` usa a grotesca do sistema,
não a Geist — o rasterizador de SVG só enxerga fontes instaladas, e a Geist é
baixada em tempo de build pelo `next/font`. Para uma imagem de preview de link
resolve; se virar peça de campanha, o caminho é vetorizar o texto.

---

## 6. Movimento

A marca **se desenha**. Essa é a coreografia da casa, e vale em toda parte:

| Contexto | Coreografia | Duração |
|---|---|---|
| Tela de espera | Desenha uma vez e fica; depois respira | 900ms + 2.4s |
| Botão carregando | Desenha e some pelo mesmo lado, em ciclo | 1.5s |
| Abertura do PWA | PNG estático (o iOS não anima splash) | — |

Tudo anima `stroke-dashoffset`, que o navegador resolve no compositor: não
dispara layout nem repaint, então roda a 60fps até em celular fraco.

**Movimento reduzido:** a regra global que zera durações não serve aqui —
congelar o traço no quadro final significa caminho **vazio**, e o loading
sumiria por completo. Com `prefers-reduced-motion`, a marca aparece inteira e
só pulsa em opacidade, que não provoca desconforto vestibular.

---

## 7. Onde cada arquivo vive

Todos gerados por `pnpm --filter @finara/web icons`.

```
icon/master/     1024 claro, escuro e tinted, + SVG vetorial
icon/ios/        10 tamanhos, quadrado cheio (o iOS aplica o squircle)
icon/android/    adaptive icon (2 camadas), monochrome, 5 densidades, Play Store
icon/macos/      7 tamanhos com silhueta própria
icon/windows/    app-icon.ico + app-icon-tray.ico (só o traço, para 16px)
icon/pwa/        192, 512, maskable, apple-touch
icon/favicon/    favicon.ico (16/32/48) + favicon.svg com dark mode
social/          Instagram 1080, perfil 512, OG 1200×630
```

---

## 8. Erros a não cometer

1. **Não arredondar os cantos do ícone do iOS.** O sistema aplica o squircle;
   cantos manuais são recortados de novo e deixam halo claro.
2. **Não usar o ícone `any` onde o sistema mascara.** Existe o `maskable`
   justamente para isso — o `any` tem silhueta própria e seria cortado.
3. **Não colocar a marca a mais de 40u do centro no maskable.** A zona segura
   é o círculo central de 80%; a 85% de escala a meia-diagonal fica em ~34u.
4. **Não redesenhar o traço em outro arquivo.** A geometria mora em
   `lib/marca.ts` e só ali.
5. **Não trocar o jade por "verde dinheiro".** O matiz 178 é a diferenciação.
