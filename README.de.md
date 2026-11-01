# test-mentor · Begleiter für die Weiterentwicklung zum KI-Testingenieur

[简体中文](README.md) | [繁體中文](README.zh-TW.md) | [English](README.en.md) | [Français](README.fr.md) | [Deutsch](README.de.md)

> Für Ingenieurinnen und Ingenieure, die vom manuellen Testen zum KI-Testen wechseln: erst genau sehen, wo die Lücken liegen, dann einen Lernpfad bekommen, mit dem man noch am selben Tag starten kann.

Einreichung für den 2026 Huawei Developer Competition · Xiaohongshu Skill Innovation Competition.

## Warum dieses Projekt

Die Nachfrage nach manuellem Testen schrumpft, während Stellen für KI-Testing wachsen – doch auf dem Markt fehlt ein systematischer Übergangspfad: Interview-Fragensammlungen sind statischer Inhalt, und Testfall-Generatoren lösen nur Einzelpunkte. Dieses Skill verkettet **Diagnose → Lernen → Üben → Verifizieren** zu einer Kette – vier Stufen, vier ausführbare Skripte, keine vier nebeneinanderstehenden Werkzeuge.

Bewertung, Benotung, Vergleich und Konnektivitätsprüfungen werden tatsächlich von Skripten ausgeführt; das Modell erklärt nur. Skripte geben ausschließlich Fakten aus – das Modell darf niemals Ergebnisse an ihrer Stelle erfinden.

## Abgrenzung

- **Macht**: Diagnose der fünf Kompetenzschichten für KI-Testing und Lernpfade; Qualitäts-Gate für KI-generierte Testfälle; Erkennung von Fehlermustern und Wissenssicherung; Laufzeit-Fehlerdiagnose für Agent / Skill (Verhaltensdrift, Abweichungen zwischen Engines, fehlgeschlagene MCP-Aufrufe, Endlosschleifen).
- **Macht nicht**: Analyse von Fehlern auf der **Anwendungsschicht** wie hängende Anwendungen, JS/C++-Abstürze, Speicherlecks und Performance-Flame-Graphs – dafür sind die HarmonyOS DFX Skills zuständig. Dieses Skill deckt nur die **Infrastrukturschicht** ab und ergänzt sie, statt zu konkurrieren.

## Verzeichnisstruktur

```
test-mentor/
├── SKILL.md                 # Hauptdatei: Routing + harte Vorgaben
├── data/
│   ├── questions.json       # 247 Fragen: 50 fünf Schichten + 72 Infrastruktur + 125 Grundlagen
│   ├── capabilities.json    # Gewichte der fünf Schichten, Stufen, Sampling-Schwellen
│   ├── learning-paths.json  # Lernaktionen und Ressourcen pro Schicht × Niveau-Band
│   ├── defect-patterns.json # 15 Fehlermuster
│   └── defects.jsonl        # Fehler-Wissensbasis (nur anhängen)
├── scripts/
│   ├── diagnose.js          # Fünf-Schichten-Diagnose, Radar, Lernpfad, Kompetenzkarte
│   ├── case-gate.js         # Qualitäts-Gate für Testfälle (23 Prüfungen / fünf Dimensionen)
│   ├── defect-kb.js         # Fehlermusterabgleich und Wissenssicherung
│   └── agent-diag.js        # Laufzeitdiagnose: Drift / Engines / MCP / Endlosschleife
├── references/              # Modelldetails: fünf Schichten, Gate-Regeln, Diagnosebelege
├── schema/                  # Testfälle, Review-, Diagnoseberichte, Fehlerdatensätze, Diagnoseberichte
├── examples/                # direkt ausführbare Abnahmebeispiele
└── versions/
    ├── xiaohongshu/SKILL.md # schlanke Xiaohongshu-Edition (reines Markdown, ≤500 Zeilen)
    └── edu/SKILL.md         # Hochschul-Edition
```

## Schnellstart

Voraussetzung: Node.js (keine Fremdabhängigkeiten; `node scripts/*.js` läuft direkt).

```bash
# 1. Kompetenzdiagnose (6 Fragen pro Schicht, standardmäßig 30)
node scripts/diagnose.js
node scripts/diagnose.js --layer skill          # Fokus auf eine Schicht
node scripts/diagnose.js --level 2 --n 5        # Schwierigkeit und Fragenanzahl begrenzen
node scripts/diagnose.js --card card.md         # teilbare Kompetenzkarte exportieren

# 2. Qualitäts-Gate für Testfälle (Prüfung KI-generierter Fälle)
node scripts/case-gate.js --file cases.json
node scripts/case-gate.js --file cases.json --min 80 --md

# 3. Wissenssicherung für Defekte
node scripts/defect-kb.js match  --file bug.json   # Muster + ähnliche historische Bugs
node scripts/defect-kb.js record --file bug.json   # Validierung + Bericht + Ablage

# 4. Laufzeit-Fehlerdiagnose für Agent / Skill
node scripts/agent-diag.js drift  --baseline a.json --current b.json
node scripts/agent-diag.js engine --a engine-a.json --b engine-b.json
node scripts/agent-diag.js mcp    --config mcp.json --timeout 2000
node scripts/agent-diag.js loop   --trace trace.jsonl --max-steps 40 --repeat 3
```

## Schnelle Abnahme (von Prüfenden direkt ausführbar)

```bash
node scripts/diagnose.js --answers examples/answers-demo.json --no-save
node scripts/case-gate.js --file examples/cases-pass.json        # erwartet: bestanden
node scripts/case-gate.js --file examples/cases-audit.json       # erwartet: nicht bestanden, Exit-Code 1
node scripts/agent-diag.js drift --baseline examples/skill-run-baseline.json --current examples/skill-run-current.json
node scripts/agent-diag.js loop --trace examples/agent-trace.jsonl
node scripts/defect-kb.js match --file examples/bug.json
```

## Mehrere Plattform-Editionen

| Edition | Ort | Form | Für |
| :--- | :--- | :--- | :--- |
| Vollversion Huawei | Repository-Wurzel | Trio aus SKILL.md + scripts + references, mit ausführbaren Skripten | Huawei Developer Competition · Agent-Innovation |
| Schlanke Xiaohongshu-Edition | `versions/xiaohongshu/SKILL.md` | reines Markdown ≤500 Zeilen, keine Skripte | Xiaohongshu Skill Innovation Competition |
| Hochschul-Edition | `versions/edu/SKILL.md` | ohne Einstiegshürde, Fokus auf Lernpfad | HarmonyOS University Innovation Competition |

Alle drei Editionen teilen dasselbe Fünf-Schichten-Modell, dieselben Checklisten und dieselbe Fehlermusterbibliothek; nur die äußere Form unterscheidet sich.

## Drei verbindliche Regeln

1. **Echte Ausführung**: Punktzahlen, Ähnlichkeiten, Port-Status und Bewertungsergebnisse stammen ausschließlich aus der Skriptausgabe; das Modell erklärt nur.
2. **Keine Erfindungen**: keine erfundenen Ressourcen, historischen Bugs oder Testergebnisse; bei unzureichenden Daten „zu bestätigen“ kennzeichnen.
3. **Sicherheit und Urheberrecht**: Anmeldedaten erscheinen nie in Konfigurationen oder Berichten, Ausgaben werden maskiert; Fragen- und Musterbibliothek sind vollständig originär, keine Übernahme von Interviewfragen großer Tech-Konzerne.

## Veröffentlichungs-Tags

`#小红书Skill创新赛 #2026华为开发者大赛`

## Hinweis

Dieses Repository ist eine originäre Wettbewerbseinreichung. Die `--json`-Ausgabe von Diagnose und Gate kann als Kennzahleneingabe für die automatisierte Bewertung von AgentArts dienen, und Fehlerdiagnoseberichte lassen sich als Ereignisse der End-to-End-Observability anschließen; dieses Repository enthält keine AgentArts-Integration auf Serverseite und behauptet auch nicht, eine solche bereitgestellt zu haben.