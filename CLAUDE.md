# GetBackSOL — contexte projet pour Claude Code

## C'est quoi

GetBackSOL : un outil qui récupère le SOL verrouillé dans les comptes de tokens dormants d'un
wallet Solana, avec une suite d'outils Solana complémentaires en aperçu. Next.js 16 (App Router,
Turbopack) + TypeScript + Tailwind CSS 4 + `@solana/wallet-adapter`. Thème clair/sombre,
esthétique éditoriale "suisse" (Helvetica, rouge accent, grille fine, sections numérotées).

## État actuel — lire avant de coder

**Reclaim Rent (`/`) est branché en réel sur devnet** — ce n'est plus une simulation. Le wallet
connect est réel (Phantom/Solflare/Backpack via Wallet Standard, réseau configuré dans
`src/app/providers.tsx`, actuellement `devnet`). La page d'accueil scanne les vrais comptes de
tokens du wallet connecté (`useRentAccounts.ts`), construit et envoie de vraies transactions
`closeAccount` + le transfert de commission 15 % vers un vrai wallet de frais (`useReclaimRent.ts`,
`reclaimRent.ts`, adresse dans `feeWallet.ts`). Le Safe-Burn (fermer les comptes "dust" à solde
résiduel) n'est **pas encore** câblé — le toggle est visible mais désactivé, étiqueté "coming soon".

Les 7 autres outils (Token Creator, Create Liquidity, Swap, Remove Liquidity, Burn Token,
Burn & Earn, Leaderboard) restent en simulation via `src/lib/useSimulatedTx.ts` — vision produit,
pas encore la priorité.

## Priorité de travail — la suite

Reclaim Rent est validé sur devnet pour les comptes déjà vides. Prochaines étapes, dans l'ordre :

1. **Tester en conditions réelles** avec un wallet devnet (Phantom en mode devnet + faucet SOL) —
   créer quelques comptes de tokens vides pour vérifier le flow de bout en bout (scan → sélection →
   signature → fermeture → SOL reçu).
2. **Câbler Safe-Burn** : ajouter l'instruction `burn` avant `closeAccount` pour les comptes à solde
   résiduel (voir `dustCount` déjà remonté par `useRentAccounts.ts`, il ne manque que la
   construction de l'instruction burn dans `reclaimRent.ts`).
3. Une fois validé et stable sur devnet : créer le wallet de frais définitif (idéalement un
   multisig Squads, voir `docs/backend-architecture.md`), obtenir une clé RPC de production
   (Helius), puis basculer `NETWORK` sur `mainnet-beta` dans `providers.tsx`.

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
- `src/lib/feeWallet.ts` — adresse du wallet qui reçoit la commission de 15 %. À remplacer par un
  multisig Squads avant mainnet.
- `src/lib/useSimulatedTx.ts` — toujours utilisé par les 7 autres outils (pas Reclaim Rent).
- `src/app/providers.tsx` — configuration réseau Solana (`NETWORK = "devnet" | "mainnet-beta"`).
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
