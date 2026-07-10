# GetBackSOL — contexte projet pour Claude Code

## C'est quoi

GetBackSOL : un outil qui récupère le SOL verrouillé dans les comptes de tokens dormants d'un
wallet Solana, avec une suite d'outils Solana complémentaires en aperçu. Next.js 16 (App Router,
Turbopack) + TypeScript + Tailwind CSS 4 + `@solana/wallet-adapter`. Thème clair/sombre,
esthétique éditoriale "suisse" (Helvetica, rouge accent, grille fine, sections numérotées).

## État actuel — lire avant de coder

C'est une **maquette front-end complète mais non branchée on-chain**. Le wallet connect est réel
(Phantom/Solflare/Backpack via Wallet Standard, réseau configuré dans `src/app/providers.tsx`),
mais chaque action (créer un token, swap, burn, fermer un compte...) passe par
`src/lib/useSimulatedTx.ts`, un hook qui simule un délai puis affiche un succès — aucune vraie
transaction n'est envoyée au réseau pour l'instant.

Huit pages/outils existent déjà dans `src/app/` : **Reclaim Rent (`/`, page d'accueil)**,
Token Creator (`/token-creator`), Create Liquidity, Swap, Remove Liquidity, Burn Token,
Burn & Earn, et Leaderboard.

## Priorité de travail — commencer ici

**On démarre uniquement avec Reclaim Rent.** C'est le choix stratégique retenu : c'est l'outil le
plus simple techniquement (une instruction `closeAccount` du Token Program, pas de Metaplex, pas
d'AMM, pas d'indexeur nécessaire pour la version MVP), et celui qui a le marché le plus large
(tout wallet Solana actif est un client potentiel). Les 7 autres outils restent dans le code comme
vision produit, mais ne sont pas la priorité de développement tant que Reclaim Rent n'est pas en
production et ne génère pas de revenu.

Étapes concrètes pour rendre Reclaim Rent réel, dans l'ordre :

1. Remplacer la simulation dans `src/app/page.tsx` (la page d'accueil) par une vraie découverte des
   comptes de tokens du wallet connecté via `getTokenAccountsByOwner`, filtrée sur les comptes à
   solde nul (voir `docs/backend-architecture.md`, section 7, pour le détail des instructions).
2. Construire la transaction réelle : `createCloseAccountInstruction` (`@solana/spl-token`) pour
   chaque compte sélectionné, plus une instruction `SystemProgram.transfer` vers le wallet de
   frais pour la commission (15 % du montant récupéré).
3. Grouper plusieurs fermetures dans une seule transaction quand c'est possible (limite ~10
   comptes par transaction selon la taille).
4. Tester sur **devnet** d'abord (le réseau est déjà configuré sur `devnet` dans
   `providers.tsx`) avec un wallet de test qui a de vrais comptes vides à fermer.
5. Une fois validé sur devnet : créer le wallet de frais (idéalement un multisig Squads), obtenir
   une clé RPC de production (Helius), puis basculer `NETWORK` sur `mainnet-beta`.

Ne pas commencer par Token Creator (`/token-creator`), Swap ou Liquidity — c'est un choix
délibéré, pas un oubli.

## Fichiers clés

- `src/app/page.tsx` — la page d'accueil (Reclaim Rent), à rendre fonctionnelle en premier.
- `src/lib/useSimulatedTx.ts` — le hook à remplacer par de vraies transactions ; garder la même
  interface (`status`, `message`, `run`) pour ne rien casser côté UI.
- `src/lib/mockTokens.ts` — contient `MOCK_RENT_ACCOUNTS`, les données factices à remplacer par
  un vrai appel RPC.
- `src/app/providers.tsx` — configuration réseau Solana (`NETWORK = "devnet" | "mainnet-beta"`).
- `src/app/globals.css` — tous les tokens de design (couleurs clair/sombre, composants de base).
  Toujours utiliser les variables CSS existantes (`var(--accent)`, `var(--surface)`, etc.) plutôt
  que des couleurs Tailwind en dur, pour rester cohérent entre les deux thèmes.
- `docs/backend-architecture.md` — le plan technique complet, outil par outil, avec l'infra
  nécessaire (RPC, base de données, stockage) et les considérations de sécurité.

## Conventions de code

- Composants de page en `"use client"`, logique de simulation via le hook `useSimulatedTx`.
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
