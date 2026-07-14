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

**SEO technique corrigé suite à un audit complet** (`layout.tsx`, `opengraph-image.tsx`,
`partners/layout.tsx`, `support/page.tsx`, `blog/page.tsx`, `blog/[slug]/page.tsx`, `page.tsx`) :
`metadataBase` + Open Graph/Twitter Card sur toutes les routes, image OG dynamique générée via
`next/og` (marque, pas un screenshot statique), et schémas JSON-LD (`FAQPage` sur la page
d'accueil, `BlogPosting` sur chaque article). Piège trouvé et corrigé : `/partners` héritait du
titre/description de la page d'accueil car sa page est un Client Component (`"use client"`), et
Next.js ne lit l'export `metadata` que sur les Server Components — d'où l'ajout d'un
`partners/layout.tsx` dédié, un Server Component qui ne fait que porter le `metadata` pour son
enfant Client Component. Le même piège s'appliquerait à tout futur outil converti en Client
Component sans layout dédié.

Piège trouvé et corrigé dans la même passe : `SectionTitle` (`Card.tsx`) rendait systématiquement
son titre en `<h1>`, ce qui donnait 4 balises `<h1>` sur la page d'accueil (le hero + How it
works + Security + FAQ) — mauvais pour le SEO (un seul `<h1>` par page attendu). Ajout d'un prop
`level` (`"h1" | "h2"`, défaut `"h1"`) : les 3 sections de la page d'accueil qui suivent déjà le
hero passent `level="h2"`, toutes les autres pages (blog, support, partners, outils simulés) où
`SectionTitle` est l'unique titre de la page gardent le défaut `h1`. Vérifié via
`document.querySelectorAll('h1'|'h2')` dans le navigateur : un seul `h1`, hiérarchie `h1 > h2 >
h3` correcte partout.

**Section Roadmap (`page.tsx`, sous la FAQ, index "05")** : trois colonnes (Shipped / In
progress / Planned) avec dates, dérivées de l'historique git réel et de la section "Priorité de
travail" plus haut dans ce fichier — pas des dates inventées. Contient le lancement du token
prévu en **Q4 2026** (seule date future annoncée publiquement pour l'instant). À tenir à jour
manuellement à chaque jalon shippé (déplacer de "In progress"/"Planned" vers "Shipped" avec la
vraie date), sinon la page finit par mentir sur l'état du projet — même logique que le statut de
l'audit de sécurité plus haut dans ce fichier.

**Canonical URLs + meta keywords ajoutés suite à un second passage d'audit SEO** (item critique :
"Missing canonical URL" sur toutes les pages). `alternates: { canonical: "..." }` ajouté sur
chaque route qui exporte son propre `metadata` (`layout.tsx` racine pour `/`, `support/page.tsx`,
`blog/page.tsx`, `blog/[slug]/page.tsx`, `partners/layout.tsx`). Piège identique à celui du
`/partners` : les 7 outils simulés (`token-creator`, `create-liquidity`, `swap`,
`remove-liquidity`, `burn-token`, `burn-and-earn`, `leaderboard`) sont eux aussi des Client
Components sans `metadata` propre, donc ils héritaient tous silencieusement du titre, de la
description **et maintenant du canonical** de la page d'accueil. Corrigé en ajoutant un
`layout.tsx` dédié à chacun (même pattern que `partners/layout.tsx`), chacun avec son propre
`alternates.canonical`. Si un futur outil passe en Client Component, il lui faut systématiquement
ce même layout dédié, sinon il hérite silencieusement des metadata de l'accueil.

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
L'ancien classement top-5 par gains cumulés (`AffiliateLeaderboard.tsx`) a été retiré et remplacé
par le Weekly XP Leaderboard décrit plus bas — voir cette section pour le classement actuel.

**Historique public des reclaims (`ReclaimHistory.tsx`, `/api/reclaims/history`)** affiché sous la
bannière d'affiliation quand un wallet est connecté. Enregistre **toute** transaction de reclaim
réussie (pas juste celles avec parrainage, contrairement à `referrals`) dans la table `reclaims` :
wallet, nombre de comptes fermés pour l'owner, montant net reçu, signature, horodatage précis à la
seconde. Le montant net est lu directement depuis les `preBalances`/`postBalances` réels de la
transaction confirmée (`connection.getTransaction`) plutôt que recalculé, car `closeAccount` libère
le solde réel du compte au moment de l'exécution, une valeur qui n'est pas encodée dans
l'instruction elle-même. Chaque ligne pointe vers Solscan pour vérification indépendante — même
logique de transparence que "Verify the code yourself on GitHub".

**Weekly XP Leaderboard (`WeeklyLeaderboard.tsx`, section "Leaderboard" sur `page.tsx`, avant le
Roadmap)** remplace l'ancien classement d'affiliation (`AffiliateLeaderboard.tsx` et
`getAffiliateLeaderboard` dans `partners.ts` — supprimés, plus utilisés). Classement hebdomadaire
(reset chaque lundi 00:00 UTC) combinant XP de fermeture de comptes (`reclaims`, 10 XP/compte) et
XP de parrainage (`referrals`, 1 XP/parrainage) — calcul entièrement dérivé des données
existantes, pas de nouvelle table de score (voir `src/lib/leaderboard.ts`). Le "prize pool" affiché
est **réel** : 10 % (`PRIZE_POOL_SHARE`) des frais de plateforme réellement collectés cette
semaine (`reclaims.fee_lamports`, nouvelle colonne remplie dans `/api/relay-close` à partir du
`feeLamports` déjà validé — jamais recalculé), split 50/30/20 entre le top 3 en fin de semaine
(`/api/leaderboard/weekly` pour l'affichage public, en direct).

**Paiement réel mais volontairement manuel, jamais automatique.** Le serveur ne détient pas la
clé privée de `FEE_WALLET` (juste son adresse, voir `feeWallet.ts`) — cohérent avec la migration
multisig déjà prévue, à laquelle un nouveau hot wallet de paiement automatique aurait justement
nui. À la place : `/admin/leaderboard` (non listée dans le nav, `noindex`) affiche le paiement dû
de la semaine précédente ; quiconque détient la clé de `FEE_WALLET` connecte son wallet, l'app
construit une transaction avec 3 instructions `SystemProgram.transfer` vers le top 3, et
**c'est lui qui signe** — exactement comme n'importe quelle transaction Reclaim. `/api/leaderboard/payout`
(POST) ne fait jamais confiance à un montant envoyé par le client : après confirmation on-chain,
il relit les vrais deltas de solde de la transaction (même pattern que `recordReclaim`) et ne
valide/enregistre le paiement dans `weekly_payouts` que si la source est bien `FEE_WALLET` et que
chaque gagnant a reçu exactement le montant attendu, recalculé côté serveur.

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

**Listing Phantom (dApp directory) en cours, géré manuellement par l'utilisateur via Phantom
Portal (`phantom.com/portal`), pas par du code.** App ID Phantom : `d92dd29b-7d8b-4e5a-a37f-
5121cce8aee0`. Étape en cours : vérification du domaine `getbacksol.com` via un enregistrement
DNS TXT (`_phantom_portal-challenge` → hash de challenge fourni par Phantom). Le site n'utilise
aucun SDK Phantom (juste `@solana/wallet-adapter` standard) — cet App ID ne sert qu'à la
configuration du Portal/listing, rien à câbler dans le code pour l'instant.

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
- `src/lib/reclaims.ts` — écrit/lit la table `reclaims` (historique public de toute transaction,
  pas juste celles avec parrainage). `recordReclaim` appelé depuis `/api/relay-close` après
  confirmation (avec `feeLamports`, utilisé par le Weekly Leaderboard) ; `getReclaimHistory` sert
  `/api/reclaims/history`.
- `src/lib/leaderboard.ts` — calcul du classement hebdomadaire (XP fermeture + parrainage) et du
  prize pool (part réelle des frais collectés cette semaine), fenêtres de semaine (lundi 00:00
  UTC), et les fonctions de paiement (`getPendingPayout`, `recordWeeklyPayout`).
- `src/app/api/leaderboard/weekly/route.ts` — classement public en direct pour la semaine en
  cours ; `src/app/api/leaderboard/payout/route.ts` — GET renvoie le paiement dû de la semaine
  précédente, POST vérifie une signature on-chain avant d'enregistrer le paiement (jamais de
  montant fourni par le client).
- `src/components/ui/WeeklyLeaderboard.tsx` — affichage public (section "Leaderboard" sur
  `page.tsx`), via `useWeeklyLeaderboard.ts`.
- `src/app/admin/leaderboard/page.tsx` (+ `layout.tsx` pour le `noindex`) — page non listée dans
  le nav où quiconque détient la clé `FEE_WALLET` connecte son wallet et signe lui-même le
  paiement des 3 gagnants de la semaine précédente. Voir la section dédiée plus haut pour le
  raisonnement (pas de nouvelle clé chaude sur le serveur).
- `src/components/ui/ReclaimHistory.tsx` — affichée sous `AffiliateBanner` (`page.tsx`), liste les
  reclaims récents avec lien Solscan par ligne.
- `src/app/opengraph-image.tsx` — image OG dynamique (`next/og` `ImageResponse`), générée à la
  volée avec la charte du site (fond noir, logo rouge, wordmark) ; convention de fichier détectée
  automatiquement par Next.js, pas de câblage manuel dans les balises meta.
- `src/app/partners/layout.tsx` — porte le `metadata` de `/partners` : nécessaire car
  `partners/page.tsx` est un Client Component et ne peut pas exporter `metadata` lui-même (sinon
  la page hérite silencieusement du titre/description de l'accueil).
- `src/app/{token-creator,create-liquidity,swap,remove-liquidity,burn-token,burn-and-earn,
  leaderboard}/layout.tsx` — même pattern que `partners/layout.tsx`, un par outil simulé encore en
  Client Component, chacun avec son propre `title`/`description`/`alternates.canonical`.

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
