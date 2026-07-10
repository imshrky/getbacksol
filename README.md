# GetBackSOL — reclaim locked SOL from dormant Solana accounts (mockup)

Maquette Next.js pour GetBackSOL : scanne un wallet Solana, détecte les comptes de tokens vides
ou dormants, et les ferme pour récupérer le SOL de rent verrouillé, moins une commission de
service. Le reste de la suite (Token Creator, Liquidity, Swap, Burn, Burn & Earn, Leaderboard)
est inclus comme aperçu de la feuille de route produit, mais n'est pas la priorité de lancement —
voir `ROADMAP.md`.

## Démarrer en local

```bash
npm install
npm run dev
```

Ouvrez http://localhost:3000 — c'est directement la page Reclaim Rent. Le bouton "Connect Wallet"
fonctionne réellement (Phantom/Solflare/Backpack via Wallet Standard, sur devnet). Toutes les
actions sont encore **simulées** — voir `docs/backend-architecture.md` et `CLAUDE.md` pour
brancher le vrai on-chain.

Design : thème clair/sombre (bouton soleil/lune dans le header, persistant), esthétique
éditoriale suisse (Helvetica, rouge accent, grille fine, numérotation des sections), animations
minimales.

## Structure

- `src/app/page.tsx` — **Reclaim Rent (page d'accueil, produit de lancement)**
- `src/app/token-creator/` — Token Creator
- `src/app/create-liquidity/` — Create Liquidity
- `src/app/swap/` — Swap
- `src/app/remove-liquidity/` — Remove Liquidity
- `src/app/burn-token/` — Burn Token
- `src/app/burn-and-earn/` — Burn & Earn
- `src/app/leaderboard/` — Leaderboard
- `src/lib/useSimulatedTx.ts` — hook de transaction simulée, à remplacer par de vraies transactions Solana
- `src/app/providers.tsx` — configuration du wallet (réseau devnet/mainnet)
- `docs/backend-architecture.md` — ce qu'il reste à construire pour une vraie mise en production
- `CLAUDE.md` — contexte projet pour Claude Code, priorités de développement
- `ROADMAP.md` — feuille de route détaillée, phase par phase

## Stack

Next.js 16 (App Router, Turbopack), TypeScript, Tailwind CSS 4, `@solana/wallet-adapter-react` + `@solana/web3.js`.

## Déploiement

Build de production standard :

```bash
npm run build
npm run start
```

Déployable tel quel sur Vercel (recommandé pour Next.js) ou tout hébergeur Node.
