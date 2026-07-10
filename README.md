# Nebula Tools — Solana Token & Liquidity Suite (mockup)

Maquette Next.js inspirée de plateformes comme Orion Tools : création de token SPL, liquidité, swap, burn, burn & earn, et leaderboard.

## Démarrer en local

```bash
npm install
npm run dev
```

Ouvrez http://localhost:3000. Le bouton "Connect Wallet" fonctionne réellement (Phantom/Solflare/Backpack via Wallet Standard, sur devnet). Toutes les actions (créer un token, swap, burn...) sont **simulées** — voir `docs/backend-architecture.md` pour brancher le vrai on-chain.

Design v2 : thème clair/sombre (bouton soleil/lune dans le header, persistant), esthétique éditoriale suisse (Helvetica, rouge accent, grille fine, numérotation des sections), animations minimales.

## Structure

- `src/app/page.tsx` — Token Creator (page d'accueil)
- `src/app/create-liquidity/` — Create Liquidity
- `src/app/swap/` — Swap
- `src/app/remove-liquidity/` — Remove Liquidity
- `src/app/burn-token/` — Burn Token
- `src/app/burn-and-earn/` — Burn & Earn
- `src/app/leaderboard/` — Leaderboard
- `src/lib/useSimulatedTx.ts` — hook de transaction simulée, à remplacer par de vraies transactions Solana
- `src/app/providers.tsx` — configuration du wallet (réseau devnet/mainnet)
- `docs/backend-architecture.md` — ce qu'il reste à construire pour une vraie mise en production

## Stack

Next.js 16 (App Router, Turbopack), TypeScript, Tailwind CSS 4, `@solana/wallet-adapter-react` + `@solana/web3.js`.

## Déploiement

Build de production standard :

```bash
npm run build
npm run start
```

Déployable tel quel sur Vercel (recommandé pour Next.js) ou tout hébergeur Node.
