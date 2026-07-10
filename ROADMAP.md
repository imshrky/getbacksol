# Feuille de route — GetBackSOL

Décision retenue : on lance avec **Reclaim Rent seul**, puis on ajoute le reste de la suite une
fois que l'outil génère du trafic et du revenu. Voir `CLAUDE.md` pour le contexte complet et
`docs/backend-architecture.md` pour le détail technique de chaque outil.

## Phase 1 — Maquette (fait)

- [x] UI/UX des 8 outils, thème clair/sombre, wallet connect réel
- [x] Design system "suisse" (typographie, couleurs, grille)
- [x] Toutes les actions simulées côté client

## Phase 2 — Reclaim Rent en vrai sur devnet (priorité actuelle)

- [ ] Découverte réelle des comptes de tokens du wallet (`getTokenAccountsByOwner`)
- [ ] Filtrage des comptes à solde nul + détection des comptes "poussière" (Safe-Burn)
- [ ] Construction de la transaction : `closeAccount` (+ `burn` si Safe-Burn activé)
- [ ] Instruction de commission (15 %) vers le wallet de frais, dans la même transaction
- [ ] Regroupement de plusieurs fermetures par transaction (limite de taille)
- [ ] Tests sur devnet avec un wallet ayant de vrais comptes vides
- [ ] Gestion des cas d'erreur (wallet refuse la transaction, aucun compte trouvé, etc.)

## Phase 3 — Bascule mainnet pour Reclaim Rent

- [ ] Créer le wallet de frais (multisig Squads recommandé)
- [ ] Souscrire une clé RPC de production (Helius, plan Developer)
- [ ] Basculer `NETWORK` sur `mainnet-beta` dans `src/app/providers.tsx`
- [ ] Tester avec de petits montants réels avant l'ouverture publique
- [ ] Déployer (Vercel), nom de domaine, page CGU (transactions finales, non remboursables)

## Phase 4 — Ouverture publique de Reclaim Rent

- [ ] Canal de support (Discord/Telegram)
- [ ] Monitoring des transactions échouées (Sentry)
- [ ] Suivi du revenu généré (même simple, via l'historique du wallet de frais)

## Phase 5+ — Extension de la suite (une fois Reclaim Rent stable et rentable)

- [ ] Token Creator + Burn Token en vrai (les deux outils les plus proches de la maquette)
- [ ] Create/Remove Liquidity (SDK Raydium ou Orca)
- [ ] Swap (agrégateur Jupiter)
- [ ] Backend d'indexation (Postgres + webhooks Helius) pour Burn & Earn et Leaderboard
