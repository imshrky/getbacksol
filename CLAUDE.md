# GetBackSOL — contexte projet pour Claude Code

## C'est quoi

GetBackSOL : un outil qui récupère le SOL verrouillé dans les comptes de tokens dormants d'un
wallet Solana, avec une suite d'outils Solana complémentaires en aperçu. Next.js 16 (App Router,
Turbopack) + TypeScript + Tailwind CSS 4 + `@solana/wallet-adapter`. Thème clair/sombre,
esthétique éditoriale "suisse" (Helvetica, rouge accent, grille fine, sections numérotées).

## État actuel — lire avant de coder

**Reclaim Rent (`/`) est en réel et LIVE SUR MAINNET en production.** Ce n'est plus du tout une
simulation ni un test devnet — les transactions déplacent du vrai SOL. Le wallet connect est réel
(Phantom/Solflare/Backpack via Wallet Standard). Le réseau et le RPC sont pilotés par variable
d'environnement dans `src/app/providers.tsx` (`NEXT_PUBLIC_SOLANA_NETWORK`,
`NEXT_PUBLIC_SOLANA_RPC_URL`), configurées sur Vercel (projet `imshrkys-projects/getbacksol`) en
`mainnet-beta` + une clé RPC Helius — **pas en dur dans le code**, donc `NETWORK` vaut `devnet` en
local par défaut (sans `.env.local`) mais `mainnet-beta` une fois déployé sur Vercel. Toujours
vérifier `NETWORK` avant de supposer quel réseau est actif.

La page d'accueil scanne les vrais comptes de tokens du wallet connecté (`useRentAccounts.ts`),
construit et envoie de vraies transactions `closeAccount` + le transfert de commission 15 % vers
le wallet de frais (`useReclaimRent.ts`, `reclaimRent.ts`, adresse pilotée par
`NEXT_PUBLIC_FEE_WALLET_ADDRESS`, fallback dans `feeWallet.ts`). Le Safe-Burn (fermer les comptes
"dust" à solde résiduel) n'est **pas encore** câblé — le toggle est visible mais désactivé,
étiqueté "coming soon". Aucun audit de sécurité externe n'a été fait — c'est explicitement affiché
dans la section Security et le footer du site, à ne jamais retirer tant que ce n'est pas vrai.

Les textes du site (hero, FAQ, footer) s'adaptent automatiquement selon `NETWORK` — ne jamais
coder en dur "devnet preview" ou "no funds at risk" quelque part, toujours passer par la
constante `IS_MAINNET` (dérivée de `NETWORK`) comme dans `page.tsx` et `Footer.tsx`, sinon le site
ment aux utilisateurs sur l'état réel du risque.

Les 7 autres outils (Token Creator, Create Liquidity, Swap, Remove Liquidity, Burn Token,
Burn & Earn, Leaderboard) restent en simulation via `src/lib/useSimulatedTx.ts` — vision produit,
pas encore la priorité.

## Priorité de travail — la suite

Reclaim Rent est live sur mainnet pour les comptes déjà vides. Prochaines étapes, dans l'ordre :

1. **Câbler Safe-Burn** : ajouter l'instruction `burn` avant `closeAccount` pour les comptes à solde
   résiduel (voir `dustCount` déjà remonté par `useRentAccounts.ts`, il ne manque que la
   construction de l'instruction burn dans `reclaimRent.ts`).
2. **Multisig Squads pour le wallet de frais** : actuellement une clé unique — à migrer vers un
   multisig avant que le volume de frais collectés devienne significatif (voir
   `docs/backend-architecture.md`).
3. **Audit de sécurité externe** avant d'annoncer publiquement/pousser du trafic important —
   priorité vu qu'on est déjà en mainnet sans audit.

Ne pas commencer par Token Creator (`/token-creator`), Swap ou Liquidity — c'est un choix
délibéré, pas un oubli.

## Fichiers clés

- `src/app/page.tsx` — la page d'accueil (Reclaim Rent), branchée en réel.
- `src/lib/useRentAccounts.ts` — découverte réelle des comptes de tokens (SPL + Token-2022) du
  wallet connecté, filtrés sur solde nul ; remonte aussi `dustCount` pour les comptes non-nuls.
- `src/lib/reclaimRent.ts` — construction des transactions `closeAccount` + frais, groupées par lot
  de 10 comptes max.
- `src/lib/useReclaimRent.ts` — signe et envoie les transactions via le wallet connecté ; même
  forme d'état (`status`, `message`) que `useSimulatedTx` pour rester compatible avec l'UI.
- `src/lib/feeWallet.ts` — adresse du wallet qui reçoit la commission de 15 % (pilotée par
  `NEXT_PUBLIC_FEE_WALLET_ADDRESS`, actuellement une clé unique). À migrer vers un multisig Squads
  — on est déjà en mainnet avec cette clé simple, c'est du vrai risque, pas juste une best practice.
- `src/lib/useSimulatedTx.ts` — toujours utilisé par les 7 autres outils (pas Reclaim Rent).
- `src/app/providers.tsx` — réseau et endpoint RPC lus depuis `NEXT_PUBLIC_SOLANA_NETWORK` /
  `NEXT_PUBLIC_SOLANA_RPC_URL`, fallback sur devnet + RPC public si absents. Ces variables sont
  définies sur Vercel (production = mainnet-beta + clé Helius), pas dans le code.
- `src/app/globals.css` — tous les tokens de design (couleurs clair/sombre, composants de base).
  Toujours utiliser les variables CSS existantes (`var(--accent)`, `var(--surface)`, etc.) plutôt
  que des couleurs Tailwind en dur, pour rester cohérent entre les deux thèmes.
- `docs/backend-architecture.md` — le plan technique complet, outil par outil, avec l'infra
  nécessaire (RPC, base de données, stockage) et les considérations de sécurité.

## Conventions de code

- Composants de page en `"use client"`, logique de simulation via le hook `useSimulatedTx` pour
  les outils pas encore réels ; Reclaim Rent utilise ses propres hooks réels (voir ci-dessus).
- Couleurs et espacements toujours via les variables CSS de `globals.css`, jamais de couleurs
  Tailwind codées en dur (pour que le thème clair/sombre reste cohérent).
- Chaque outil suit le même gabarit : `SectionTitle` avec un `index` numéroté, une `Card`
  centrale avec le formulaire, un `TxStatusBanner` pour le retour utilisateur.

## Commandes utiles

```bash
npm install
npm run dev      # démarre en local sur :3000
npm run build     # build de production
npm run lint      # vérifie le code
```
