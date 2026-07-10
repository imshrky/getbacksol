# Nebula Tools — Architecture backend & mise en production

Ce document explique ce qu'il faut construire derrière la maquette (Next.js) pour que chaque outil devienne réellement fonctionnel sur Solana, d'abord sur **devnet**, puis sur **mainnet**.

## Vue d'ensemble

La maquette actuelle (Phase 1) est un front-end pur : le bouton "Connect Wallet" fonctionne réellement (Wallet Standard : Phantom, Solflare, Backpack...), mais chaque action (créer un token, swap, burn...) est simulée côté client. Pour rendre la plateforme réelle, il faut ajouter trois couches :

1. **Transactions on-chain côté client** — construites avec `@solana/web3.js` / `@solana/spl-token`, signées par le wallet de l'utilisateur (non-custodial : vous ne détenez jamais les clés privées des utilisateurs).
2. **Programmes on-chain tiers** — le Token Program de Solana, Metaplex (métadonnées), et un AMM (Raydium ou Orca) pour la liquidité/le swap.
3. **Backend applicatif** — indexation des événements (leaderboard, historique de burn), stockage des métadonnées d'image, et gestion du wallet de frais de la plateforme.

## Outil par outil

### 1. Token Creator

- Instructions on-chain : `createMint`, création de l'Associated Token Account (ATA) de l'utilisateur, `mintTo` pour la supply initiale, puis `setAuthority` pour révoquer freeze/mint selon les options cochées. Le package `@solana/spl-token` couvre tout cela.
- Métadonnées (nom, symbole, image, description) : ce n'est pas stocké sur le Token Program lui-même. Il faut créer un compte de métadonnées via le programme **Metaplex Token Metadata**, ce qui suppose d'héberger l'image et un JSON de métadonnées quelque part de permanent — typiquement **Arweave via Irys** (anciennement Bundlr) ou IPFS (Pinata/NFT.Storage).
- Frais de plateforme : la transaction doit inclure une instruction `SystemProgram.transfer` vers votre wallet de frais (0,2 SOL de base + 0,1 SOL par option cochée dans la maquette), construite et signée dans la même transaction que la création du token.
- Coût technique : sur mainnet, créer un mint + ATA + compte de métadonnées coûte environ 0,012–0,022 SOL de loyer (rent), en plus des frais de plateforme que vous définissez.

### 2. Create Liquidity / Remove Liquidity

- Nécessite d'intégrer le SDK d'un AMM existant plutôt que de réinventer un programme : **Raydium** (CPMM ou CLMM) ou **Orca Whirlpools** sont les standards sur Solana.
- Création de pool = initialiser un compte de pool sur le programme de l'AMM avec les deux mints (souvent TOKEN/SOL, en utilisant le Wrapped SOL `So111...112`), déposer les montants initiaux, recevoir des LP tokens en retour.
- Retrait = brûler une partie des LP tokens contre les deux actifs sous-jacents via l'instruction `removeLiquidity` du SDK choisi.
- Prérequis obligatoire : le token doit avoir sa **freeze authority révoquée** (sinon l'AMM refuse le pool, car il ne peut pas garantir que les LP ne seront pas gelés).
- Le tableau "Vos positions de liquidité" affiché dans la maquette doit, en production, lire les comptes de pool réels via `getProgramAccounts` filtré par owner, ou mieux, via l'API indexée du fournisseur RPC (voir plus bas).

### 3. Swap

- Le plus simple et le plus robuste est d'utiliser l'**agrégateur Jupiter** (API Quote + Swap) plutôt que de router manuellement entre pools : il trouve automatiquement la meilleure route parmi tous les AMM de Solana.
- Flux : appel à `GET /quote` de l'API Jupiter avec les mints et le montant → affichage du taux et de l'impact prix → appel à `POST /swap` qui renvoie une transaction sérialisée → le wallet de l'utilisateur la signe → envoi au réseau.
- Aucun backend propre n'est requis ici, l'API Jupiter est publique (avec limite de requêtes ; prévoir une clé API sur le plan payant en production pour éviter le rate-limit).

### 4. Burn Token

- Le plus simple des six outils : une seule instruction `burn` du Token Program, signée par le propriétaire du compte de tokens. Pas de backend nécessaire au-delà de la construction de la transaction côté client.

### 5. Burn & Earn

- C'est le seul outil qui nécessite une vraie logique métier propriétaire, donc soit un **programme Anchor custom**, soit une logique **off-chain**:
  - *Option on-chain (recommandée à terme)* : un programme Anchor qui reçoit l'instruction de burn, calcule les points selon un barème stocké dans un compte de configuration, et met à jour un compte "score" par wallet (PDA dérivé de la clé du wallet). Plus transparent et vérifiable, mais nécessite un audit avant mainnet.
  - *Option off-chain (plus rapide à livrer)* : le burn reste une simple transaction SPL standard ; un **indexeur backend** (webhook Helius ou cron qui poll `getSignaturesForAddress`) détecte les burns, les enregistre dans une base de données avec les points calculés, et une future distribution de récompenses se fait via un airdrop ou un programme de claim (par ex. Merkle-drop) alimenté par ce ledger.
- Distribution des récompenses : si les points se convertissent un jour en token ou NFT, prévoir un programme de "claim" avec preuve Merkle pour éviter de payer le gas d'un airdrop à chaque wallet individuellement.

### 6. Leaderboard

- Ne peut pas être calculé à la volée à chaque chargement de page (trop de transactions à parcourir). Il faut un **indexeur** :
  - S'abonner aux transactions de burn/mint via un **webhook Helius** (ou QuickNode Streams / Triton), qui pousse chaque événement vers une API backend.
  - Agréger ces événements dans une base de données (Postgres, ex. via Supabase) : une table `burns (wallet, token, amount, usd_value, tx_signature, created_at)`.
  - Exposer une route API (`/api/leaderboard`) qui fait la somme groupée par wallet et retourne le top N, avec cache (ex. 60s) pour éviter de recalculer à chaque requête.

### 7. Reclaim Rent

- Techniquement l'un des outils les plus simples de la suite, plus simple encore que le Token Creator : une instruction `closeAccount` du Token Program sur chaque compte de token à solde nul, qui restitue automatiquement le loyer (rent-exempt reserve, ~0,00204 SOL) verrouillé sur ce compte. Aucun programme tiers requis.
- Étape de découverte : `getTokenAccountsByOwner` (ou l'API indexée du fournisseur RPC) pour lister tous les comptes de tokens du wallet connecté, puis filtrer côté client ceux dont le solde est à zéro — c'est ce qui alimente le tableau affiché dans la maquette.
- Option "Safe-Burn + Sell" : pour les comptes qui ont un solde résiduel non nul mais sans valeur (poussière de token), ajouter une instruction `burn` avant le `closeAccount` dans la même transaction, afin de les rendre éligibles à la fermeture.
- Commission de plateforme (15% dans la maquette) : comme le montant du loyer récupéré est connu à l'avance (constante fixe par compte), il suffit d'ajouter une instruction `SystemProgram.transfer` vers le wallet de frais pour le pourcentage exact, dans la même transaction atomique — pas besoin d'oracle ni de calcul a posteriori.
- Pour fermer plusieurs comptes d'un coup, regrouper les instructions dans une seule transaction (jusqu'à la limite de taille de ~1232 octets, soit une dizaine de comptes environ ; au-delà, découper en plusieurs transactions signées à la suite).

## Infrastructure transverse nécessaire

| Besoin | Pourquoi | Options concrètes |
|---|---|---|
| RPC de production | Le RPC public de Solana est fortement rate-limité, inutilisable en prod | Helius, QuickNode, Triton — plans payants avec webhooks inclus |
| Backend applicatif | Leaderboard, historique de burn, quotas anti-abus | API routes Next.js (`/app/api/...`) suffisent au début ; séparer en service dédié si la charge augmente |
| Base de données | Stocker burns, points, positions de liquidité indexées | Postgres managé (Supabase / Neon) |
| Stockage de métadonnées | Image + JSON du token doivent être permanents pour Metaplex | Irys (Arweave) ou Pinata/NFT.Storage (IPFS) |
| Wallet de frais | Recevoir les frais de plateforme (0,1–0,2 SOL/action, ou 15% sur Reclaim Rent) | Wallet multisig (Squads Protocol) plutôt qu'une clé unique, pour la sécurité |
| Monitoring | Détecter les transactions échouées, l'usage du RPC, les erreurs | Sentry (erreurs front/back), tableau de bord Helius/QuickNode (usage RPC) |

## Sécurité — points à ne pas sauter

Le modèle reste non-custodial du début à la fin : chaque transaction (création de token, swap, burn, ajout de liquidité) est construite par votre application mais **signée uniquement par le wallet de l'utilisateur** — vous ne stockez et ne manipulez jamais ses clés privées. Le wallet de frais de la plateforme, en revanche, doit être protégé sérieusement : idéalement un multisig (Squads Protocol) plutôt qu'une clé unique stockée dans une variable d'environnement, pour éviter qu'une fuite de clé ne compromette tous les frais collectés. Si vous développez un programme Anchor personnalisé pour Burn & Earn, il doit être audité avant tout déploiement sur mainnet — un bug dans un programme qui gère des tokens ou des récompenses est directement exploitable financièrement. Les uploads d'images pour les tokens doivent être validés côté client et côté serveur (taille, type MIME) avant d'être envoyés vers Arweave/IPFS. Enfin, toute API backend exposée (leaderboard, indexeur) doit avoir du rate-limiting pour éviter le spam et les abus de quota RPC.

## Feuille de route suggérée

1. **Phase 1 — fait** : maquette UI/UX complète, connexion wallet réelle, toutes les actions simulées.
2. **Phase 2 — devnet fonctionnel** : brancher Token Creator, Burn Token et Reclaim Rent en vrai sur devnet avec `@solana/spl-token` + Metaplex (ce sont les trois outils les plus simples et les plus proches de la maquette actuelle).
3. **Phase 3 — liquidité & swap sur devnet** : intégrer le SDK Raydium ou Orca pour Create/Remove Liquidity, et l'API Jupiter pour Swap.
4. **Phase 4 — backend d'indexation** : mettre en place Postgres + webhooks Helius pour Burn & Earn et le Leaderboard.
5. **Phase 5 — audit & bascule mainnet** : revue de sécurité (surtout si programme Anchor custom), mise en place du wallet de frais multisig, changement de `NETWORK` de `devnet` à `mainnet-beta` dans `src/app/providers.tsx`.
6. **Phase 6 — mise en ligne** : déploiement (Vercel recommandé pour Next.js), nom de domaine, monitoring, plan de support.

## Ce qui change concrètement dans le code actuel

Le seul endroit à modifier pour basculer de devnet à mainnet est la constante `NETWORK` dans `src/app/providers.tsx`. Chaque page (`src/app/*/page.tsx`) utilise actuellement `useSimulatedTx()` (`src/lib/useSimulatedTx.ts`) — un hook qui attend 1,4s et affiche un message de succès. Pour rendre un outil réel, il suffit de remplacer le corps de la fonction `run()` de ce hook par la construction, la signature (via `useWallet()` / `sendTransaction`) et l'envoi de la vraie transaction Solana correspondante, en gardant la même interface (`status`, `message`) pour ne rien changer côté UI.
