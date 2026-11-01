# test-mentor · Compagnon de progression de l'ingénieur test IA

[简体中文](README.md) | [繁體中文](README.zh-TW.md) | [English](README.en.md) | [Français](README.fr.md) | [Deutsch](README.de.md)

> Pour les ingénieurs qui passent du test manuel au test assisté par IA : identifier d'abord précisément ses lacunes, puis obtenir un parcours à commencer dès le jour même.

Candidature au concours 2026 Huawei Developer Competition · Xiaohongshu Skill Innovation Competition.

## Pourquoi ce projet

La demande de test manuel recule, les postes de test IA se multiplient, mais le marché manque d'un parcours de transition structuré : les banques de questions d'entretien sont du contenu statique et les générateurs de cas de test ne règlent qu'un point isolé. Ce Skill enchaîne **diagnostic → apprentissage → pratique → validation** en un seul flux : quatre étapes, quatre scripts exécutables, et non quatre outils juxtaposés.

La notation, l'évaluation, la comparaison et les contrôles de connectivité sont réellement exécutés par les scripts ; le modèle ne fait qu'expliquer. Les scripts ne produisent que des faits : le modèle ne doit jamais inventer de résultats à leur place.

## Périmètre

- **Fait** : diagnostic des cinq couches de compétences en test IA et parcours d'apprentissage ; contrôle qualité des cas de test générés par l'IA ; reconnaissance de motifs de défauts et capitalisation des connaissances ; dépannage d'exécution Agent / Skill (dérive comportementale, incohérence entre moteurs, échec d'appel MCP, boucles infinies).
- **Ne fait pas** : l'analyse des défaillances de **la couche applicative** (application figée, crash JS/C++, fuite mémoire, flame graph de performance), confiée aux HarmonyOS DFX Skills. Ce Skill se limite à **la couche infrastructure** : complémentarité, pas concurrence.

## Arborescence

```
test-mentor/
├── SKILL.md                 # Fichier principal : routage + contraintes strictes
├── data/
│   ├── questions.json       # 247 questions : 50 cinq couches + 72 infrastructure + 125 fondamentaux
│   ├── capabilities.json    # Pondérations des cinq couches, niveaux, seuils d'échantillonnage
│   ├── learning-paths.json  # Actions et ressources par couche × bande de niveau
│   ├── defect-patterns.json # 15 motifs de défauts
│   └── defects.jsonl        # Base de connaissances des défauts (ajout seul)
├── scripts/
│   ├── diagnose.js          # Diagnostic cinq couches, radar, parcours, carte de compétences
│   ├── case-gate.js         # Contrôle qualité des cas de test (23 contrôles / cinq dimensions)
│   ├── defect-kb.js         # Correspondance de motifs et capitalisation
│   └── agent-diag.js        # Dépannage d'exécution : dérive / multi-moteurs / MCP / boucle infinie
├── references/              # Détails du modèle : cinq couches, règles du contrôle, preuves de dépannage
├── schema/                  # Cas de test, rapports de revue, de diagnostic, fiches de défaut, rapports de dépannage
├── examples/                # Exemples d'acceptation exécutables
└── versions/
    ├── xiaohongshu/SKILL.md # Édition allégée Xiaohongshu (Markdown pur, ≤500 lignes)
    └── edu/SKILL.md         # Édition enseignement supérieur
```

## Démarrage rapide

Prérequis : Node.js (aucune dépendance tierce ; `node scripts/*.js` s'exécute directement).

```bash
# 1. Diagnostic des compétences (6 questions par couche, 30 par défaut)
node scripts/diagnose.js
node scripts/diagnose.js --layer skill          # focus sur une seule couche
node scripts/diagnose.js --level 2 --n 5        # restreindre la difficulté et le nombre de questions
node scripts/diagnose.js --card card.md         # exporter une carte de compétences partageable

# 2. Contrôle qualité des cas de test (revue des cas générés par l'IA)
node scripts/case-gate.js --file cases.json
node scripts/case-gate.js --file cases.json --min 80 --md

# 3. Capitalisation des connaissances sur les défauts
node scripts/defect-kb.js match  --file bug.json   # motif + bugs historiques similaires
node scripts/defect-kb.js record --file bug.json   # validation + rapport + enregistrement

# 4. Dépannage d'exécution Agent / Skill
node scripts/agent-diag.js drift  --baseline a.json --current b.json
node scripts/agent-diag.js engine --a engine-a.json --b engine-b.json
node scripts/agent-diag.js mcp    --config mcp.json --timeout 2000
node scripts/agent-diag.js loop   --trace trace.jsonl --max-steps 40 --repeat 3
```

## Acceptation rapide (exécutable par les évaluateurs)

```bash
node scripts/diagnose.js --answers examples/answers-demo.json --no-save
node scripts/case-gate.js --file examples/cases-pass.json        # attendu : réussite
node scripts/case-gate.js --file examples/cases-audit.json       # attendu : échec, code de sortie 1
node scripts/agent-diag.js drift --baseline examples/skill-run-baseline.json --current examples/skill-run-current.json
node scripts/agent-diag.js loop --trace examples/agent-trace.jsonl
node scripts/defect-kb.js match --file examples/bug.json
```

## Éditions multi-plateformes

| Édition | Emplacement | Forme | Pour |
| :--- | :--- | :--- | :--- |
| Édition complète Huawei | racine du dépôt | trio SKILL.md + scripts + references, avec scripts exécutables | Huawei Developer Competition · innovation Agent |
| Édition allégée Xiaohongshu | `versions/xiaohongshu/SKILL.md` | Markdown pur ≤500 lignes, sans scripts | Xiaohongshu Skill Innovation Competition |
| Édition enseignement | `versions/edu/SKILL.md` | sans prérequis, centrée sur le parcours d'apprentissage | HarmonyOS University Innovation Competition |

Les trois éditions partagent le même modèle à cinq couches, les mêmes checklists et la même base de motifs de défauts ; seule la forme extérieure diffère.

## Trois contraintes strictes

1. **Exécution réelle** : scores, similarité, état des ports et résultats de notation proviennent tous de la sortie des scripts ; le modèle ne fait qu'expliquer.
2. **Aucune invention** : pas de ressources, de bugs historiques ni de résultats de test inventés ; en cas de données insuffisantes, indiquer « à confirmer ».
3. **Sécurité et droits d'auteur** : les identifiants n'apparaissent ni dans les configurations ni dans les rapports, et les sorties sont expurgées ; la banque de questions et la bibliothèque de motifs sont entièrement originales, sans reprise de sujets d'entretien de grandes entreprises.

## Mots-clés de publication

`#小红书Skill创新赛 #2026华为开发者大赛`

## Avertissement

Ce dépôt est une œuvre originale soumise au concours. La sortie `--json` du diagnostic et du contrôle peut servir d'entrée de métriques pour l'évaluation automatisée AgentArts, et les rapports de dépannage peuvent être branchés comme événements d'observabilité de bout en bout ; ce dépôt ne contient ni ne revendique le déploiement d'une intégration côté serveur AgentArts.