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
`NEXT_PUBLIC_FEE_WALLET_ADDRESS`, fallback dans `feeWallet.ts`). Le Safe-Burn (brûler le solde
résiduel des comptes "dust" avant de les fermer) est **câblé et actif par défaut** — voir
`needsBurn`/`rawAmount` dans `reclaimRent.ts` et la validation du discriminator `Burn` dans
`/api/relay-close`. **Sell** (vendre le dust via Jupiter au lieu de le brûler) est aussi câblé,
en toggle opt-in séparé (off par défaut) — voir la section Sell plus bas. **Un audit de sécurité
externe a été réalisé et est passé avec succès** — affiché dans la section Security, le badge du
hero et le footer du site. Comme pour la mention "not yet audited" avant elle, ce statut ne doit
être affiché comme vrai que s'il l'est réellement — à corriger partout (pas juste un endroit) si
jamais il redevenait faux.

**Sell dust (`src/lib/jupiter.ts`, `/api/build-sell`) vend le dust via l'API Jupiter au lieu de
le brûler.** Le client construit toujours la transaction côté serveur (jamais le client) : le
serveur appelle Jupiter `/swap/v2/build`, assemble lui-même la transaction finale, et ne renvoie
qu'un base64 non signé — l'owner signe ensuite, exactement comme le reste du relais. Piège
économique identifié et résolu : si le wallet n'a pas encore de compte SOL wrapped (WSOL), Jupiter
doit en créer un, dont le rent (~0.002 SOL) est avancé par notre fee-payer — mais le cleanup natif
de Jupiter renvoie ce rent au owner, pas à qui l'a avancé, ce qui ferait perdre ~0.002 SOL au
fee-payer à *chaque* vente nécessitant un nouveau compte. Solution : dans ce cas, on remplace
l'instruction de cleanup de Jupiter par notre propre `closeAccount` (destination = fee-payer, donc
il récupère le rent + le produit de la vente), puis on paie au owner le montant minimum garanti de
la quote (`otherAmountThreshold`) via un transfert séparé — jamais moins que ça, le swap échoue
on-chain sinon. Le fee-payer ne peut donc jamais perdre plus que ce montant garanti, quel que soit
le slippage réel. Le relais (`/api/relay-close`) autorise `JUP6LkbZbjS1jKKwapdHNy74zcZ3tLUZoi5QNyVTaV4`
(programme Jupiter) et `ASSOCIATED_TOKEN_PROGRAM_ID`, chacun plafonné à 1 instruction par
transaction, plus un plafond de 2 SOL sur tout transfert fee-payer→owner — aucune de ces
instructions n'est parsée en détail (comme Token/System Program, on fait confiance au programme
officiel), seuls les comptes source/destination et les plafonds sont vérifiés statiquement. Testé
avec un vrai compte dust mainnet (transaction décodée et vérifiée instruction par instruction,
jamais signée ni soumise).

Les textes du site (hero, FAQ, footer) s'adaptent automatiquement selon `NETWORK` — ne jamais
coder en dur "devnet preview" ou "no funds at risk" quelque part, toujours passer par la
constante `IS_MAINNET` (dérivée de `NETWORK`) comme dans `page.tsx` et `Footer.tsx`, sinon le site
ment aux utilisateurs sur l'état réel du risque.

Les 7 autres outils (Token Creator, Create Liquidity, Swap, Remove Liquidity, Burn Token,
Burn & Earn, Leaderboard) restent en simulation via `src/lib/useSimulatedTx.ts` — vision produit,
pas encore la priorité.

**Programme partenaire (`/partners`) est self-service et branche une vraie base de données.**
C'est le premier composant persistant du projet — tout le reste est volontairement stateless.
Un partenaire s'inscrit, reçoit une clé API instantanément (pas de validation manuelle), affiche
le scan de wallet dans sa propre UI via `/api/v1/scan`, puis renvoie l'utilisateur vers
`getbacksol.com/?ref=<partnerId>` pour l'exécution réelle — toujours via notre relais gasless
existant, jamais via une exécution côté partenaire. La clé API ne donne donc **jamais** accès à
la construction ou la soumission de transactions. Le partenaire touche 30 % de notre frais de 15 %
sur chaque reclaim référé, calculé côté serveur à partir du montant réel de l'instruction de
transfert validée dans `/api/relay-close` — jamais depuis une valeur envoyée par le client.
Nécessite `DATABASE_URL` (Postgres, ex. Neon) en variable d'environnement ; sans elle, le signup
échoue proprement en 503 plutôt qu'en 500. Voir `src/lib/db.ts`, `src/lib/partners.ts`,
`scripts/schema.sql` (migration à lancer via `npm run db:migrate`).

**Affiliation automatique par wallet : tout utilisateur connecté est déjà son propre affilié,
sans inscription.** Contrairement au programme partenaire (signup, email, clé API), ici l'adresse
du wallet connecté sert directement de `partnerId` — une bannière (`AffiliateBanner.tsx`) s'affiche
dès la connexion avec le lien `getbacksol.com/?ref=<adresse>` et les gains cumulés. Le compte
`partners` correspondant (`kind = 'wallet'`) est créé paresseusement par
`resolveOrCreateWalletAffiliate` dans `partners.ts`, seulement au moment où une vraie commission
est gagnée — jamais à la connexion elle-même, pour ne pas remplir la table de lignes vides. Même
taux de 30 % que les partenaires API. `/api/affiliate/stats` renvoie les gains cumulés d'une
adresse, en lecture publique (pas d'auth nécessaire, une adresse de wallet n'est pas un secret).
Un classement public (`AffiliateLeaderboard.tsx`, `/api/affiliate/leaderboard`) existe déjà, scopé
à `kind = 'wallet'` uniquement, mais **n'est volontairement pas affiché sur `page.tsx`** — retiré
à la demande du produit tant qu'il n'y a pas au moins une dizaine d'affiliés réels (pas de valeur
de preuve sociale avec une poignée de lignes). Le composant/hook/route restent en place, prêts à
être ré-affichés (une seule ligne à rajouter dans `page.tsx`) une fois qu'il y a assez de volume.

## Priorité de travail — la suite

Reclaim Rent est live sur mainnet, Safe-Burn et Sell sont câblés, le programme partenaire est en
ligne, l'audit de sécurité externe est passé. Prochaines étapes, dans l'ordre :

1. **Multisig Squads pour le wallet de frais** : actuellement une clé unique — à migrer vers un
   multisig avant que le volume de frais collectés devienne significatif (voir
   `docs/backend-architecture.md`).
2. **Rate limiting sur `/api/v1/scan`** : maintenant que les clés partenaire sont self-service
   (voir `/partners`), une clé pourrait marteler l'endpoint sans limite — pas encore de
   protection au-delà du plafond d'inscription par IP.

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
- `src/lib/db.ts` — client Postgres paresseux (`getSql()`), lit `DATABASE_URL`. Ne jamais importer
  le client au niveau module de façon eager : l'erreur "non configuré" doit remonter dans le
  `try/catch` de la route, pas planter le chargement du module (500 générique au lieu d'un 503
  propre).
- `src/lib/partners.ts` — inscription self-service (`signUpPartner`), résolution de clé API par
  hash (`resolvePartnerByApiKey`), vérification d'un `partnerId` d'attribution
  (`partnerExists`), et écriture du grand livre de commissions (`recordReferral`).
- `src/app/partners/page.tsx` — page publique d'inscription partenaire, affiche la clé API une
  seule fois à la création (jamais récupérable ensuite, seul son hash SHA-256 est stocké).
- `src/app/api/partners/signup/route.ts` — endpoint d'inscription self-service (POST), protégé
  par un plafond quotidien par IP stocké en base (pas de CAPTCHA pour l'instant).
- `src/app/api/v1/scan/route.ts` — scan en lecture seule pour les partenaires (`X-API-Key`).
- `src/app/api/relay-close/route.ts` — relais gasless ; accepte un `partnerId` optionnel
  (attribution uniquement, ne change jamais la liste blanche d'instructions autorisées) et
  enregistre la commission après confirmation de la transaction. Autorise aussi le programme
  Jupiter et l'ATA program (1 instruction max chacun) pour Sell.
- `src/lib/jupiter.ts` — appelle Jupiter `/swap/v2/build` pour obtenir les instructions de swap
  dust→SOL ; gère le cas "nouveau compte WSOL nécessaire" en redirigeant le cleanup vers le
  fee-payer (voir explication détaillée plus haut).
- `src/app/api/build-sell/route.ts` — construit (sans signer) une transaction Sell complète pour
  un compte dust ; retourne 404 si aucune route de vente viable (le client bascule sur Burn).
- `src/components/ui/AffiliateBanner.tsx` — affichée quand un wallet est connecté (`page.tsx`),
  montre le lien de parrainage personnel + gains cumulés via `useAffiliateStats.ts`.
- `src/app/api/affiliate/stats/route.ts` — lecture publique des gains d'affiliation d'une adresse.
- `src/components/ui/AffiliateLeaderboard.tsx` — top 5 wallets affiliés par gains cumulés, via
  `useAffiliateLeaderboard.ts` / `/api/affiliate/leaderboard` (`getAffiliateLeaderboard` dans
  `partners.ts`, filtré sur `kind = 'wallet'`).

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
npm run dev         # démarre en local sur :3000
npm run build       # build de production
npm run lint        # vérifie le code
npm run db:migrate  # applique scripts/schema.sql sur DATABASE_URL (idempotent)
```
