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

**Bug corrigé (2026-08-07) : Sell retombait silencieusement sur le burn presque à chaque fois.**
Diagnostiqué et fixé sur la tour PC — voir `docs/TOWER-TODO.md` pour le détail complet. Cause
réelle : `build-sell` construisait une transaction **legacy**, qui ne peut pas référencer de
address lookup table (ALT) — donc les 30-40+ comptes d'une vraie route Jupiter devaient être
inlinés en pubkeys complètes, dépassant presque toujours la limite réseau de 1232 octets, ce qui
faisait échouer la route ("too complex") et basculait sur le burn. Fix : transaction **versionnée
(v0)** sur tout le chemin (`jupiter.ts` → `build-sell` → `relay-close` → `useReclaimRent.ts`), avec
les vraies ALTs de la route Jupiter. `relay-close` distingue maintenant legacy (burn/close normal,
chemin inchangé) de v0 (Sell uniquement) via un `try { Transaction.from(...) } catch` — cette
méthode échoue de façon fiable et distincte sur des bytes v0 (vérifié empiriquement), donc aucun
risque de mal interpréter silencieusement l'un pour l'autre. Piège trouvé en cours de route : le
champ de la réponse Jupiter `/swap/v2/build` contenant les ALTs n'est **pas**
`addressLookupTableAddresses` (ce que supposait le diagnostic initial) mais
`addressesByLookupTableAddress` (un objet indexé par adresse de table) — vérifié contre une vraie
réponse avant de s'appuyer dessus, sinon le fix n'aurait rien changé en silence. Vérifié
structurellement contre l'API Jupiter réelle + un vrai RPC mainnet (aucun fonds déplacé, build
seul) : une vraie route USDC→SOL nécessite 3 ALTs et compile à 1052 octets en v0 contre 1630 en
legacy — confirme le diagnostic et le fix. **Pas encore testé signé-et-soumis avec un vrai compte
dust dans l'UI réelle** — à faire avant de faire confiance à 100%, même logique que le test manuel
déjà fait sur le chemin burn/close.

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

**Section Roadmap (`page.tsx`, sous la FAQ, index "06")** : un bandeau mis en avant annonce le
**lancement du token GetBackSOL le 1er août 2026** (accent rouge, au-dessus de "Shipped" —
remplace l'ancienne mention "Q4 2026" qui était dans la liste "Planned"), puis trois colonnes
(Shipped / In progress / Planned) avec dates, dérivées de l'historique git réel et de la section
"Priorité de travail" plus haut dans ce fichier — pas des dates inventées. À tenir à jour
manuellement à chaque jalon shippé (déplacer de "In progress"/"Planned" vers "Shipped" avec la
vraie date), sinon la page finit par mentir sur l'état du projet — même logique que le statut de
l'audit de sécurité plus haut dans ce fichier.

**FAQ et Roadmap retirés de la navigation du header** (`Header.tsx`) à la demande explicite de
l'utilisateur, pour désencombrer le menu — les deux sections existent toujours sur la page
d'accueil (`id="faq"`, `id="roadmap"`), elles ne sont simplement plus liées depuis le nav.

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
la construction ou la soumission de transactions. Le partenaire touche 60 % de notre frais de 15 %
sur chaque reclaim référé, calculé côté serveur à partir du montant réel de l'instruction de
transfert validée dans `/api/relay-close` — jamais depuis une valeur envoyée par le client.
Nécessite `DATABASE_URL` (Postgres, ex. Neon) en variable d'environnement ; sans elle, le signup
échoue proprement en 503 plutôt qu'en 500. Voir `src/lib/db.ts`, `src/lib/partners.ts`,
`scripts/schema.sql` (migration à lancer via `npm run db:migrate`).

**Taux de revenue share relevé de 30 % à 60 % (2026-07), décision globale et délibérée** — pas un
taux négocié pour un seul partenaire. S'applique à tout futur partenaire self-service et à tout
futur affilié wallet (les deux lisent `PARTNER_REVENUE_SHARE` dans `partners.ts`). Les partenaires
déjà inscrits en base gardent le taux enregistré au moment de leur inscription (30 % s'ils
existaient avant ce changement) — la constante ne s'applique qu'aux nouvelles lignes ; une mise à
jour manuelle en base serait nécessaire pour aussi relever rétroactivement les partenaires
existants.

**Affiliation automatique par wallet : tout utilisateur connecté est déjà son propre affilié,
sans inscription.** Contrairement au programme partenaire (signup, email, clé API), ici l'adresse
du wallet connecté sert directement de `partnerId` — une bannière (`AffiliateBanner.tsx`) s'affiche
dès la connexion avec le lien `getbacksol.com/?ref=<adresse>` et les gains cumulés. Le compte
`partners` correspondant (`kind = 'wallet'`) est créé paresseusement par
`resolveOrCreateWalletAffiliate` dans `partners.ts`, seulement au moment où une vraie commission
est gagnée — jamais à la connexion elle-même, pour ne pas remplir la table de lignes vides. Même
taux de 60 % que les partenaires API. `/api/affiliate/stats` renvoie les gains cumulés d'une
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
est **réel** : 5 % (`PRIZE_POOL_SHARE`, baissé de 10 % le 2026-07 via une session parallèle sur
Mac) des frais de plateforme réellement collectés cette
semaine (`reclaims.fee_lamports`, nouvelle colonne remplie dans `/api/relay-close` à partir du
`feeLamports` déjà validé — jamais recalculé), split 50/30/20 entre le top 3 en fin de semaine
(`/api/leaderboard/weekly` pour l'affichage public, en direct).

**Trois onglets, un seul vrai prize pool.** "XP Leaderboard" / "Top Closers" / "Top Referrers"
sont trois vues du **même** classement déjà chargé (juste triées différemment côté client dans
`WeeklyLeaderboard.tsx` — pas de requête séparée) : seul l'onglet XP a un prize pool réel et
payable. Un toggle "This week" / "All-time" existe aussi — "All-time" (`getAllTimeRankings` dans
`leaderboard.ts`, `?period=all-time` sur `/api/leaderboard/weekly`) est une vue "hall of fame"
purement informative, sans pool ni countdown ni paiement, pour ne pas tripler la mécanique de
paiement déjà construite.

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
ligne, l'audit de sécurité externe est passé, le rate limiting sur l'API partenaire est câblé.

**Multisig Squads pour le wallet de frais : reporté délibérément, pas oublié.** Décision de
l'utilisateur (2026-07-15) : migrer une fois que le volume de frais collectés commencera à devenir
significatif, pas avant — actuellement une seule clé (`FEE_WALLET`), risque réel mais jugé
acceptable tant que le volume reste faible. **Surtout une tâche opérationnelle, pas de code** : le
code lit déjà `NEXT_PUBLIC_FEE_WALLET_ADDRESS` comme une simple variable d'environnement
(`feeWallet.ts`), donc une fois le multisig créé sur squads.so (choix des signataires/seuil) et les
fonds transférés depuis l'ancien wallet, il suffit de changer cette variable sur Vercel — aucune
modification de code nécessaire. Ce que Claude ne peut pas faire à la place de l'utilisateur :
créer le multisig (nécessite de connecter un wallet sur squads.so) ni transférer les fonds
existants (mouvement d'argent réel, doit être signé par le détenteur de la clé actuelle de
`FEE_WALLET`). Guide étape par étape déjà donné à l'utilisateur en conversation, pas encore
retranscrit dans un fichier du repo.

**Rate limiting sur `/api/v1/scan` (fait)** : compteur par partenaire et par fenêtre d'une minute
(`src/lib/rateLimit.ts`, table `api_rate_limits`), 30 requêtes/minute — généreux pour une vraie UI
partenaire, mais borne l'abus d'une clé self-service non modérée. Auto-nettoyage opportuniste
(~1% des appels) plutôt qu'un cron dédié, pour ne pas faire grossir la table indéfiniment.

Token Creator (`/token-creator`) est maintenant en réel sur mainnet (voir plus bas). Swap reste en
simulation — pas encore la priorité.

**Création de pool de liquidité Raydium native (`/create-liquidity`) : câblée, mais éteinte par
défaut (2026-08-07).** `@raydium-io/raydium-sdk-v2` (CPMM, permissionless) construit une vraie
transaction de création de pool, entièrement construite et signée côté client — même logique que
Token Creator (`useCreateToken.ts`), pas de relais : le créateur paie tout lui-même depuis son
propre wallet, puisque c'est lui qui apporte la liquidité. `src/lib/raydiumPool.ts` centralise les
program IDs (mainnet/devnet), la config de frais CPMM "Standard" (0,25% de frais de trade, vérifiée
en direct contre l'API réelle de Raydium — 19 configs existent, l'index 0 est celle par défaut de
leur propre UI) et notre commission plate de 0,1 SOL (pas un pourcentage, contrairement à
Reclaim/Sell — il n'y a pas de "montant récupéré" ici, juste de la liquidité que le créateur choisit
d'apporter). `src/lib/useCreatePool.ts` est le hook client ; `src/app/create-liquidity/page.tsx` a
été entièrement réécrite (l'ancienne UI utilisait des tokens/pools simulés) : adresse de mint
réelle avec détection du symbole via `/api/token-meta`, montants réels, coût affiché (frais
protocole Raydium ~0,15 SOL + notre 0,1 SOL). Le bouton "Add liquidity" de Token Creator pointe
maintenant vers `/create-liquidity?mint=<adresse>` en interne une fois l'interrupteur activé,
sinon garde le lien externe vers raydium.io (comportement de secours inchangé).

**Éteinte par défaut via `NEXT_PUBLIC_RAYDIUM_POOL_LIVE`** (doit valoir explicitement `"true"` sur
Vercel — l'inverse du kill-switch de Token Creator, volontairement, parce que ça déplace de la
vraie liquidité de façon irréversible). Vérifié : lecture du code source réel (non minifié-deviné)
de `createPool()` du SDK confirmant que le pool/vaults/LP-mint/observation sont tous des PDA — pas
de keypair éphémère supplémentaire à cosigner, contrairement au mint frais de la création de token.
`tsc` et `npm run build` propres, page testée dans le navigateur sans erreur console/réseau,
interrupteur bien désactivé par défaut, préremplissage `?mint=` fonctionnel. **Non vérifié : un
vrai appel à `createPool()`**, même en construction seule — contrairement à Jupiter (Sell), le SDK
Raydium lit le vrai solde on-chain du wallet avant de construire quoi que ce soit (confirmé avec un
keypair factice : refus propre "you don't has some token account" quand le wallet est vide, le bon
comportement en production, mais ça veut dire qu'un vrai test à blanc a besoin d'un wallet qui
détient réellement un token SPL réel, indisponible dans cet environnement). **À tester en vrai avant
d'activer** : créer un token, révoquer freeze, venir ici avec un vrai wallet, petits montants,
devnet d'abord — voir `docs/RAYDIUM-POOL-TODO.md` et `docs/TOWER-TODO.md` pour le plan de test
complet. Même discipline que pour Sell et le burn/close d'origine : décoder la transaction
instruction par instruction avant de lui faire confiance.

**Coinflip (`/coinflip`) : vrai jeu d'argent réel, câblé mais éteint par défaut (2026-08-07).**
Demande explicite de l'utilisateur, inspirée de claimfreesol.com/flip. **Ce n'est pas un mini-jeu
cosmétique — c'est du vrai pari en argent réel**, signalé clairement à l'utilisateur avant de
construire (risque légal gambling, distinct et généralement plus sévère que le risque "conseil en
investissement" qui avait fait abandonner le bot de trading ci-dessous), confirmé explicitement
malgré l'avertissement. Mécanique : l'utilisateur mise du SOL réel (`0.01` à `0.5`, presets fixes),
choisit pile ou face, et double sa mise ou perd tout — RTP (return to player) de 97%, soit 3% de
marge maison, encodé dans `COINFLIP_WIN_PROBABILITY` (`src/lib/coinflipConfig.ts`), jamais un vrai
50/50 malgré l'apparence pile/face (le côté choisi n'affecte pas les odds, c'est purement
cosmétique — seul le montant misé et le résultat aléatoire comptent).

**Provablement équitable via commit-reveal** (`src/lib/coinflip.ts`) : à chaque round, le serveur
génère un `serverSeed` secret et n'en révèle que le hash SHA-256 (`/api/coinflip/commit`) **avant**
que le joueur mise — il ne peut donc pas changer de seed après avoir vu le pari. Le résultat est
calculé à la résolution (`/api/coinflip/resolve`) à partir de `serverSeed + clientSeed + roundId`,
et le `serverSeed` est révélé dans la réponse pour que n'importe qui puisse recalculer le résultat
et vérifier qu'il correspond au hash engagé au départ — affiché dans l'UI sous "Verify this flip
was fair". Validé statistiquement (200 000 essais en local, taux de victoire mesuré 48.52% contre
48.5% attendu).

**Architecture radicalement différente du reste du site : la "maison" doit pouvoir payer les
gagnants depuis sa propre trésorerie**, pas juste collecter une commission comme Reclaim/Sell/
Raydium. Décision explicite de l'utilisateur (après alternative proposée et refusée : un wallet
dédié séparé) : réutiliser `FEE_WALLET` — le wallet Phantom personnel de l'utilisateur qui reçoit
déjà tous les frais de la plateforme — comme banque du jeu. Problème technique soulevé et accepté
en connaissance de cause : le serveur n'a jamais eu la clé privée de `FEE_WALLET` (seulement son
adresse publique, voir `feeWallet.ts`) — impossible donc de payer automatiquement un gagnant sans
elle. `src/lib/feeWalletSigner.ts` (nouveau) lit `FEE_WALLET_SECRET_KEY` depuis l'environnement,
vérifie que la clé fournie correspond bien à `FEE_WALLET` au démarrage (échec bruyant sinon), et
sert uniquement à cette fonctionnalité — **Claude n'a pas manipulé cette clé lui-même** (ni tapée,
ni collée, ni vue) : c'est à l'utilisateur de la configurer directement sur Vercel/`.env.local`,
même règle que pour tout secret dans ce projet. Conséquence assumée et documentée : une
compromission du relais expose désormais potentiellement tout l'historique de frais déjà collectés
sur `FEE_WALLET`, pas seulement le capital du jeu — risque réel, accepté explicitement par
l'utilisateur après explication claire.

**Vérification côté serveur, jamais de confiance dans les montants client** (`/api/coinflip/
resolve`) : le montant réellement misé est lu depuis le vrai delta de solde de `FEE_WALLET` dans la
transaction confirmée (même principe que `relay-close`), pas depuis une valeur envoyée par le
client ; seuls les montants des presets sont acceptés ; chaque `bet_tx_signature` ne peut être
utilisée qu'une fois (contrainte `UNIQUE` en base + vérification explicite) ; le solde de
`FEE_WALLET` est vérifié avant tout paiement pour ne jamais promettre un gain qu'on ne peut pas
couvrir (retourne une erreur claire plutôt que de faire perdre injustement le joueur si la banque
est à sec). Nouvelle table `coinflip_rounds` (`scripts/schema.sql`), migrée en local et vérifiée
(insertion, lecture, nettoyage des données de test).

**Éteint par défaut via `NEXT_PUBLIC_COINFLIP_LIVE`** (doit valoir explicitement `"true"`, même
posture que le kill-switch Raydium et pour la même raison). Page `/coinflip` avec écran
d'avertissement obligatoire avant de jouer (mémorisé en `localStorage`, style identique à
claimfreesol.com : perte totale possible à chaque flip, transactions finales et irréversibles,
responsabilité de l'âge légal et de la conformité juridictionnelle), `robots: {index: false}`
délibéré tant que la conformité légale gambling n'a pas été vérifiée pour les juridictions ciblées.
`/terms` mis à jour avec une section dédiée (section 6) — même logique que partout ailleurs dans ce
fichier : ne jamais laisser une page légale ne pas mentionner un vrai risque financier du site.
**À faire avant d'activer, obligatoire** : (1) configurer `FEE_WALLET_SECRET_KEY` vous-même sur
Vercel/`.env.local` — jamais via Claude ; (2) vérifier la réglementation gambling de votre
juridiction, ce n'est pas quelque chose que Claude peut évaluer à votre place ; (3) tester avec un
vrai wallet et de petits montants, décoder les transactions de mise et de paiement avant de faire
confiance, même discipline que Sell et Raydium.

**Bot Telegram de trading (signaux achat/vente + take-profits) : abandonné, pas juste reporté.**
L'utilisateur avait mentionné vouloir réactiver des alertes de trading (achat + 3 TP, idem vente)
via TradingView ou un fournisseur gratuit. Deux problèmes soulevés en conversation ont mené à
l'abandon : (1) publier des signaux d'achat/vente avec objectifs de prix contredirait directement
la clause "no investment advice" des `/terms` déjà en place — risque légal réel, pas juste
cosmétique ; (2) même techniquement, le plan gratuit de TradingView limite à 3 alertes de *prix
simple* et 0 alerte *technique* (déclenchée par un script/indicateur personnalisé) — donc une
stratégie de signal basée sur un indicateur ne pourrait de toute façon pas se déclencher sans un
plan payant, indépendamment de la question des webhooks. Décision de l'utilisateur : laisser
tomber complètement plutôt que de contourner l'un ou l'autre problème. Ne pas reproposer cette
fonctionnalité sans relire ce paragraphe.

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
  de 10 comptes max. **`tx.feePayer` est `owner` lui-même, plus le wallet du relais** (voir
  ci-dessous — bug Trust Wallet).
- `src/lib/useReclaimRent.ts` — signe et envoie les transactions via le wallet connecté ; même
  forme d'état (`status`, `message`) que `useSimulatedTx` pour rester compatible avec l'UI. Avant
  de signer chaque lot, appelle `/api/relay-topup` pour que l'owner ait de quoi payer ses propres
  frais réseau (voir ci-dessous).
- `src/app/api/relay-topup/route.ts` — envoie à l'owner juste assez de SOL (10 000 lamports par
  transaction prévue, marge incluse) pour payer ses propres frais réseau ; entièrement signé par
  le serveur, aucune interaction wallet. Ne fait rien si l'owner a déjà assez de solde (pas de
  gaspillage sur les utilisateurs récurrents).

**Bug Trust Wallet (juillet 2026) : "Signature verification failed. Invalid signature for public
key [...]".** Diagnostiqué comme provenant de `Transaction.serialize()` de `@solana/web3.js`
lui-même — **côté client, avant tout appel réseau** (elle vérifie les signatures présentes même
avec `requireAllSignatures: false`), pas d'une erreur RPC après un aller-retour vers le relais
comme supposé initialement. Autrement dit : la signature renvoyée par Trust Wallet ne correspond
tout simplement pas au message qu'on lui a demandé de signer.

Hypothèse testée : certains wallets géreraient mal une transaction dont le fee payer n'est pas le
wallet connecté (notre architecture gasless d'origine — `tx.feePayer` = wallet du relais, pas
`owner`). Solution construite : **l'owner paie désormais ses propres frais réseau**, après un
micro-versement de `/api/relay-topup` — le pattern que tous les wallets supportent nativement.
`/api/relay-close` accepte deux formes : l'ancienne (`feePayer` = relais, encore utilisée par le
flux Sell qui doit avancer le rent du compte WSOL) et la nouvelle (`feePayer` = owner, déjà
entièrement signée — vérifiée avec `tx.verifySignatures()` avant d'être transmise telle quelle).

**Hypothèse infirmée en production** : le bug persiste avec Trust Wallet même après ce changement
(même signature invalide, alors que `feePayer` est maintenant `owner`) — donc la vraie cause n'est
pas le pattern "fee payer étranger", c'est autre chose de plus profond côté Trust Wallet
(sérialisation de plusieurs instructions Token Program, corruption de la signature dans le pont
`postMessage` de l'extension, implémentation Wallet Standard incomplète — pas de diagnostic
définitif possible sans une vraie extension Trust Wallet à tester). **Décision : Trust Wallet
retiré de `SUPPORTED_WALLETS` dans `page.tsx`.** L'architecture "owner paie ses propres frais" est
conservée telle quelle malgré tout — c'est un pattern plus largement compatible en soi, même si
elle n'a pas résolu ce cas précis.
- `src/lib/feeWallet.ts` — adresse du wallet qui reçoit la commission de 15 % (pilotée par
  `NEXT_PUBLIC_FEE_WALLET_ADDRESS`, actuellement une clé unique). À migrer vers un multisig Squads
  — on est déjà en mainnet avec cette clé simple, c'est du vrai risque, pas juste une best practice.
  Cette variable a été configurée explicitement sur Vercel le 2026-07-15 (`6mBmVBchk7UnW1FdfN3bm6KKTV376UxuZ3je7sEzjpd1`,
  le wallet Phantom de l'utilisateur) — avant ça, la prod reposait silencieusement sur le fallback
  codé en dur dans le fichier, qui avait la même valeur par coïncidence.
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
- `src/app/api/v1/scan/route.ts` — scan en lecture seule pour les partenaires (`X-API-Key`), limité
  à 30 requêtes/minute par partenaire via `checkScanRateLimit` (`src/lib/rateLimit.ts`).
- `src/app/docs/page.tsx` — documentation API publique (auth, endpoint, exemples cURL/JS/Python,
  codes d'erreur, revenue share). Lié depuis `/partners` après la création d'une clé.
- `src/app/api/affiliate/stats/route.ts` — bug corrigé (2026-07) : validait à tort le paramètre
  `wallet` comme une adresse Solana, ce qui rejetait les IDs de partenaires self-service (des
  slugs comme `acme-abc123`, pas des adresses) avec une 400. La requête sous-jacente
  (`getAffiliateStats`) fonctionne avec n'importe quelle chaîne comme clé d'attribution — la
  validation stricte n'avait jamais de raison d'être là.
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

## Automatisation réseaux sociaux

**X/Twitter (`src/lib/xClient.ts`, `src/app/api/cron/scheduled-post`, `src/app/api/cron/auto-reply`,
`vercel.json`)** : deux cron jobs Vercel. `scheduled-post` publie un message tous les 2 jours
depuis un pool statique tournant (`src/lib/scheduledPosts.ts`), rotation dérivée de la date
(stateless, pas de DB). `auto-reply` cherche des tweets récents sur des mots-clés liés à Solana
rent et répond à quelques-uns par jour (`src/lib/replyTemplates.ts`), sans jamais inclure de lien
dans la réponse (X facture plus cher un post avec lien). Auth OAuth 1.0a (`X_API_KEY`,
`X_API_KEY_SECRET`, `X_ACCESS_TOKEN`, `X_ACCESS_TOKEN_SECRET`, `X_BEARER_TOKEN`) — **l'API X est
payante par requête**, contrairement à Telegram ci-dessous. Les deux routes sont protégées par
`CRON_SECRET` (envoyé automatiquement par Vercel en Bearer token sur les invocations planifiées).

**Telegram (`src/lib/telegramClient.ts`, `src/lib/telegramPosts.ts`,
`src/app/api/cron/telegram-post`)** : même principe que `scheduled-post` (rotation stateless
dérivée de la date, protégé par le même `CRON_SECRET`), mais un poste par jour au lieu de tous les
2 jours car **l'API Telegram Bot est entièrement gratuite**, aucun coût par message contrairement à
X. Le pool de messages (`src/lib/telegramPosts.ts`) est écrit pour une audience déjà abonnée au
canal (rappels/fonctionnalités, pas des pitchs "viens nous découvrir"). Un message sur 3 est
généré dynamiquement (`prizePoolPost`) en allant chercher le vrai montant du prize pool
hebdomadaire en cours via `getWeeklyPrizePoolLamports` (`leaderboard.ts`) plutôt qu'un texte figé.
Une fois par semaine (`milestonePost`), un message "où on en est" avec les vrais totaux
all-time (SOL récupéré, comptes fermés, wallets servis) via `getPlatformStats` (`reclaims.ts`) —
inspiré du type de post le plus efficace chez les concurrents (RefundYourSOL), mais construit
depuis la vraie base plutôt que tapé à la main.

**`ImpactStats.tsx` (bandeau "reclaimed so far" sur la page d'accueil) branché sur les vraies
données.** Remplace l'ancien `src/lib/stats.ts` (constante `PLATFORM_STATS` figée à zéro,
supprimé) — désormais `usePlatformStats.ts` récupère `/api/stats/platform`, qui appelle
`getPlatformStats()` (`reclaims.ts`, mêmes totaux all-time que le post milestone Telegram
ci-dessus). N'affiche toujours rien tant qu'il n'y a aucune activité réelle, même logique
qu'avant, juste avec de vraies données au lieu d'un placeholder qui ne se mettait jamais à jour
tout seul.

Variables d'environnement nécessaires : `TELEGRAM_BOT_TOKEN` (créé via @BotFather sur Telegram) et
`TELEGRAM_CHAT_ID` (le canal `@GetBackSOL`, avec le bot ajouté comme administrateur — sinon
`sendMessage` échoue). Configuration à faire manuellement par l'utilisateur (nécessite d'interagir
avec @BotFather et les paramètres d'admin du canal) — pas quelque chose que Claude peut faire à sa
place. **Confirmé fonctionnel en conditions réelles** : bot vérifié (`getMe`), droits admin
confirmés (`getChatMember`, `can_post_messages: true`), et un vrai message de test envoyé avec
succès sur le canal.

**Webhook Telegram (`src/app/api/telegram/webhook/route.ts`)** : le bot `@getbacksolbot` peut
maintenant aussi répondre aux commandes et aux boutons, pas seulement pousser des posts
programmés. `/check <adresse wallet>` réutilise exactement la même logique de scan que l'API
partenaire (`scanWalletForRentAccounts`, voir `/api/v1/scan`) pour répondre avec le montant
réellement récupérable — sans connexion de wallet, juste une adresse publique. `/scan` renvoie un
lien vers le site (impossible de connecter un vrai wallet depuis Telegram). `/faq` et le bouton FAQ
utilisent `FAQ_ITEMS` depuis `src/lib/faqContent.ts` — extrait de `page.tsx` pour que le bot et le
site partagent exactement le même contenu, jamais une copie qui pourrait diverger. `/start` envoie
un message d'accueil avec un vrai **inline keyboard** (`sendTelegramMessage`'s `inlineKeyboard`
param, `telegramClient.ts`) : "Scan my wallet" (bouton `url` vers le site), "Check a wallet" et
"FAQ" et "Help" (boutons `callback_data`, gérés via l'update `callback_query` dans le webhook,
toujours acquittés par `answerCallbackQuery` sinon le bouton reste bloqué en spinner côté
utilisateur). Protégé par le mécanisme `secret_token` de Telegram : `TELEGRAM_WEBHOOK_SECRET`
(généré aléatoirement, pas fourni par l'utilisateur) doit être configuré à la fois sur Vercel et
enregistré auprès de Telegram via `setWebhook` — sans ça, n'importe qui pourrait poster de fausses
updates sur cette route. Hébergé sur le même projet Vercel (pas de serveur séparé) — choix explicite
de l'utilisateur pour rester gratuit et ne pas ajouter un service à gérer. Menu de commandes
(`/start`, `/check`, `/scan`, `/faq`, `/help`) enregistré côté Telegram via `setMyCommands`.

## Conventions de code

- Composants de page en `"use client"`, logique de simulation via le hook `useSimulatedTx` pour
  les outils pas encore réels ; Reclaim Rent utilise ses propres hooks réels (voir ci-dessus).
- Couleurs et espacements toujours via les variables CSS de `globals.css`, jamais de couleurs
  Tailwind codées en dur (pour que le thème clair/sombre reste cohérent).
- Chaque outil suit le même gabarit : `SectionTitle` avec un `index` numéroté, une `Card`
  centrale avec le formulaire, un `TxStatusBanner` pour le retour utilisateur.

## Pages légales

**`/terms`, `/privacy`, `/copyright`** — ajoutées suite à une demande directe, liées depuis une
nouvelle ligne en bas du `Footer.tsx` (séparées par des `·`, `noindex` mais `follow`). Contenu
rédigé à partir du fonctionnement réel du site (non-custodial, ce qui est collecté : adresses
wallet, IP + email pour le programme partenaire, `localStorage`/`sessionStorage` pour le thème et
l'attribution de parrainage — pas de cookies de tracking, pas d'analytics tiers) plutôt que du
texte générique copié-collé. **Ce n'est pas une relecture juridique professionnelle** — vu que le
site déplace du vrai argent, une vraie révision par un avocat reste recommandée avant de s'appuyer
dessus en cas de litige réel. À maintenir à jour si les pratiques changent (nouvelle donnée
collectée, nouveau tiers intégré), même logique que l'audit de sécurité et la roadmap plus haut
dans ce fichier : un document légal qui ment sur ce que fait le site est pire que pas de document.

## Analytics

**Google Tag Manager** (`src/lib/analytics.ts`, `trackEvent`) + injection conditionnelle dans
`layout.tsx` (script `<head>` + `<noscript>` iframe dans `<body>`, pattern standard GTM), activé
uniquement si `NEXT_PUBLIC_GTM_ID` est configuré — sans cette variable, `trackEvent` ne fait rien
(no-op), donc le code ne casse jamais en local/dev sans conteneur configuré. Conteneur créé et
configuré sur Vercel (2026-07, `GTM-TDKGFGX7`) — déjà actif en production.

4 événements câblés au moment de l'ajout :
- `wallet_connected` (`page.tsx`, `useEffect` sur `connected`/`publicKey`)
- `reclaim_completed` (`useReclaimRent.ts`, juste après confirmation on-chain)
- `referral_link_shared` (`AffiliateBanner.tsx`, bouton Copy + Share X + Share Telegram, `method`
  distingue lequel)
- `partner_signup` (`partners/page.tsx`, après un signup réussi)

**Vercel Analytics** (`@vercel/analytics/next`, composant `<Analytics />` dans `layout.tsx`) —
trafic/pages vues natif Vercel, aucune configuration supplémentaire nécessaire (pas d'ID à fournir,
lié automatiquement au projet). Complémentaire à GTM : Vercel Analytics couvre les visites/pages
vues, GTM couvre les événements produit ci-dessus.

4 événements câblés au moment de l'ajout :
- `wallet_connected` (`page.tsx`, `useEffect` sur `connected`/`publicKey`)
- `reclaim_completed` (`useReclaimRent.ts`, juste après confirmation on-chain)
- `referral_link_shared` (`AffiliateBanner.tsx`, bouton Copy + Share X + Share Telegram, `method`
  distingue lequel)
- `partner_signup` (`partners/page.tsx`, après un signup réussi)

**Privacy Policy mise à jour en même temps** — elle affirmait auparavant "no third-party
analytics", ce qui serait redevenu faux dès l'activation. Même logique que le statut de l'audit de
sécurité et la roadmap : ne jamais laisser une page légale mentir sur ce que fait réellement le
site. Si de nouveaux événements sont ajoutés plus tard, mettre à jour cette section de la Privacy
Policy en même temps, pas après coup.

## Commandes utiles

```bash
npm install
npm run dev         # démarre en local sur :3000
npm run build       # build de production
npm run lint        # vérifie le code
npm run db:migrate  # applique scripts/schema.sql sur DATABASE_URL (idempotent)
```
