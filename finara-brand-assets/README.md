# Finara — Assets de Marca

Tudo aqui é **gerado**, nunca editado à mão:

```bash
pnpm --filter @finara/web icons
```

A fonte é `apps/web/src/lib/marca.ts` — o mesmo módulo que o componente `Logo`
e o loading animado usam. Mexeu no traço lá, roda o comando, e o ícone do
celular, o favicon e a logo dentro do app continuam sendo o mesmo desenho.

O conceito, as regras de uso e os erros a não cometer estão em
[`brand/identidade.md`](brand/identidade.md).

---

## Uso rápido

| Preciso de… | Use |
|---|---|
| Foto de perfil do Instagram | `social/profile-instagram-1080.png` |
| Perfil em qualquer outra rede | `social/profile-square-512.png` |
| Preview de link (WhatsApp, Slack, X) | `social/og-image-1200x630.png` |
| Enviar a logo para alguém | `icon/master/icon-1024.png` |
| Editar a logo em vetor | `icon/master/icon-master.svg` |
| Publicar na App Store | `icon/ios/AppIcon-1024x1024.png` |
| Publicar na Play Store | `icon/android/play_store_512.png` |
| Ícone de app no Windows | `icon/windows/app-icon.ico` |
| Ícone na bandeja do Windows | `icon/windows/app-icon-tray.ico` |
| Cores para o Figma | `brand/identidade.md` (§4) ou `code/css-variables.css` |

---

## Estrutura

```
icon/
  master/     1024 claro · escuro · tinted (iOS 18) · SVG vetorial
  ios/        10 tamanhos, quadrado cheio — o iOS aplica o squircle sozinho
  android/    adaptive icon (foreground + background), monochrome,
              5 densidades de launcher, Play Store
  macos/      7 tamanhos com silhueta própria
  windows/    app-icon.ico (16/32/48) + app-icon-tray.ico (só o traço)
  pwa/        192 · 512 · maskable 192/512 · apple-touch-icon
  favicon/    favicon.ico + favicon.svg (troca de cor com o tema do sistema)
social/       Instagram 1080 · perfil 512 · OG 1200×630
brand/        identidade.md — conceito, construção, paleta, movimento
code/         css-variables.css · site.webmanifest · favicon-html.html
```

## O que já está montado no app

Estes não precisam ser copiados — o gerador escreve direto no lugar certo:

- `apps/web/src/app/favicon.ico`, `icon.svg`, `apple-icon.png`
  (convenção de arquivo do Next; ele emite as tags `<link>` sozinho)
- `apps/web/public/icons/` — PWA e as 20 telas de abertura do iOS
- `apps/web/public/og-image.png`

Os arquivos em `code/` são cópias de referência, para quem for montar outra
página ou outro app com a mesma marca.

---

## Nota sobre a tipografia das peças geradas

A `og-image` usa a grotesca do sistema, e não a **Geist** da interface: o
rasterizador de SVG só enxerga fontes instaladas na máquina, e a Geist é
baixada em tempo de build pelo `next/font`. Para preview de link resolve; se
virar peça de campanha, o caminho é vetorizar o texto.
