# M5: evidence audit register, 12 November 2026

**Scope:** canonical dataset at commit `3fbad89` (Fonte_00–Fonte_09) and the M5 publication gate in PR #2.

**Status:** evidence verification in progress. This is a **work queue**, not a finding of culpability, human editorial approval, or a completed source-by-source audit. No `review.status` was promoted to `reviewed`.

## Reproducibility and baseline

Run `pnpm audit:publication` to report current canonical/public counts, review-state distribution and person relationships missing `primary_url`. The original `sources/original/` and `sources/incremental/` files remain untouched.

The immutable Fonte_07 edge/node CSV files contain **36** relationships with a person as subject or object but no `primary_url`: **15 direct relationships** and **21 event-participation links**. There are **17 other person relationships that already include a primary URL**. These are counts of **edges**, not allegations or persons under suspicion. The 36 edges are quarantined from public site and exports by the M5 gate; their canonical records and Git history remain accessible.

The new Fonte_09 contains 30 proposed `EXT-005`–`EXT-034` event/update records, including multiple phases of the *same* incident. None should be counted as 30 separate attacks. They remain `needs_review` and `pending_integration`, absent from public projections.

## Queue A: direct relationships without a primary URL (15)

| ID | Claim represented in baseline | Verification category / next step |
| --- | --- | --- |
| `G-0024` | Manafort organised Hapsburg Group | Find court records / sworn admission; distinguish arrangement from direction by Moscow |
| `G-0025` | Gates organised Hapsburg Group | Independent court record or guilty plea, not only an indictment |
| `G-0026` | Hapsburg lobbying benefiting Yanukovych | Separate the lobbying arrangement from the alleged ultimate sponsor |
| `G-0027` | Yanukovych leadership of Party of Regions | Public electoral or parliamentary record |
| `G-0040` | MI5 links Christine Lee to United Front structures | Document the *MI5 attribution*, not a criminal conviction; see [Rycroft Review](https://www.gov.uk/government/publications/the-rycroft-review-report-of-the-independent-review-into-countering-foreign-financial-influence-and-interference-in-uk-politics/the-rycroft-review-report-of-the-independent-review-into-countering-foreign-financial-influence-and-interference-in-uk-politics) |
| `G-0041` | MI5 attributed concealment of foreign origin of political donations to Lee | Record the exact MI5 allegation, scope and response; Rycroft Review as official secondary report |
| `G-0042` | German conviction of Jian G. for espionage for China | Obtain dated original court/judicial authority statement; do not conflate with indictment |
| `G-0043` | Jian G. gathered European Parliament information | Match precise proven conduct to the court judgment |
| `G-0071` | Trump as US executive during 2025–26 | Official presidential/administrative documentation; role is not an allegation |
| `G-0073` | Musk control of X | Corporate filing identifying ownership/control and date |
| `G-0074` | Musk control of SpaceX | Corporate governance/source for the actual notion of control |
| `G-0077` | Musk publicly supports AfD | Direct dated statement; no inference about federal mandate or electoral effects |
| `G-0088` | GVA Capital managed a sanctioned Kerimov investment | [US OFAC action, 12 June 2025](https://ofac.treasury.gov/recent-actions/20250612), a regulator finding, not proof of ownership of other SpaceX vehicles |
| `G-0089` | Heritage Trust assets attributed to Kerimov | [US Treasury announcement, 30 June 2022](https://home.treasury.gov/news/press-releases/jy0841); distinguish blocked trust from criminal conviction |
| `G-0090` | IPI Partners investments traced to Kerimov | [US OFAC settlement, 2 December 2025](https://ofac.treasury.gov/recent-actions/20251202); does not imply any GVA/HAL9001/SpaceX causal chain |

**Source status:** The four primary/regulatory documents linked above were opened as public government pages during M5. They are *candidate source links* for particular edge predicates; they have **not** yet been committed to the data model as approved evidence. Each needs exact-scope checking and, for sensitive persons, editorial review before publication. The Rycroft Review is an official synthesis of an MI5 alert, not the MI5 alert itself.

## Queue B: event-participation relationships without a primary URL (21)

| Group / event involvement | Record IDs | Verification priority |
| --- | --- | --- |
| Manafort and Hapsburg timeline | `G-0117` | Court record and event/role date |
| Kerimov finances/sanctions | `G-0132`, `G-0137`, `G-0274` | OFAC/Treasury decisions; do not infer unrelated ownership |
| Gill payments, intermediary, conviction | `G-0138`, `G-0139`, `G-0287` | [Crown Prosecution Service, 21 November 2025](https://www.cps.gov.uk/cps/news/former-ukip-mep-jailed-taking-bribes); ascertain each person's procedural status individually |
| Christine Lee and MI5 alert | `G-0159`, `G-0176` | Official MI5/public review and wording of the alert |
| Musk acquisition, public support | `G-0170`, `G-0266` | Dated corporate transaction and primary public statement |
| Șor's sanctions, conviction and alleged networks | `G-0179`, `G-0193`, `G-0213`, `G-0259`, `G-0336` | Separate sanctions designations, domestic conviction and intelligence attribution |
| Medvedchuk and European influence | `G-0219` | EU sanctions decision for the exact event |
| Papp as target of alleged plot | `G-0230` | Formal law-enforcement account; preserve **alleged** status |
| Jian G. conviction | `G-0254` | German court ruling / formal statement |
| Trump office-holder | `G-0262` | Official term/date; no adverse inference |
| Koulamallah as affected actor | `G-0327` | Official incident record; being targeted does not imply wrongdoing |

Event participation is a navigation/role link, **not** evidence of command, financing, affiliation or criminal intent.

## Fonte_09: initial source-level spot checks (not event approvals)

| Topic | Source examined | Supported statement | Unsupported leap to avoid |
| --- | --- | --- | --- |
| French commercial refrigeration, October attack | [French foreign ministry attribution, 9–10 November 2026](https://www.diplomatie.gouv.fr/en/presse-et-ressources/decouvrir-et-informer/actualites/declaration-d-attribution-a-l-iran-de-cyberattaques-visant-la-france) | France **formally attributes** the October attack to an IRGC-linked cyber unit (institutional E2) | Independent legal proof or attribution of the November wave to the same unit |
| 1–2 November refrigeration incidents | [ENISA joint statement, 4 November 2026](https://www.enisa.europa.eu/news/joint-statement-on-cyber-incidents-in-refrigeration-systems-across-the-eu) | EU incident response and a separate wave | Russian–Iranian joint command based on self-claimed participation |
| US midterms | [AP coverage of congressional control](https://www.ap.org/the-definitive-source/behind-the-news/calling-control-of-congress-in-the-2026-midterm-elections/) | Reported election outcomes / projections, with counting-status caveats | Formal final certification or attribution of outcome to an information operation |
| RAF Fairford and alleged proxy network | [US DOJ indictment announcement, 10 November 2026](https://www.justice.gov/opa/pr/three-iranian-backed-operatives-indicted-their-roles-nearly-20-terrorist-attacks-and) | The DOJ filed an **indictment** | Converting allegations into a criminal conviction |

These checks do **not** verify all figures, exact chronology, target counts, downstream damages, or each link in the proposed Fonte_09 graph.

## Acceptance criteria still open

1. Verify the exact predicate of each of the 15 direct sensitive edges against a stable primary source and check contradictions, court status and dates; then separately check the 21 event-role edges.
2. For Fonte_09, group the 30 update records by underlying incident, compare with `TL-*` and `EXT-001`–`EXT-004` to prevent event duplication, and document the decision for each: merge, update, standalone event or reject.
3. Move from record-wide E1–E4 labels to individually sourced atomic claims for event occurrence, material actor, alleged sponsor, intent and measured impact. One label cannot imply the entire paragraph or graph path is proven.
4. Introduce durable reference metadata (publisher, issued/published date, retrieved date, archived URL/checksum when rights permit, exact supported proposition, disputed response) without rewriting historic `provenance`.
5. Have a human reviewer approve material claims before marking records `reviewed` and integrating pending candidates. Machine audits and primary source URLs alone do not constitute that approval.
6. Keep GitHub Actions `pnpm check`, `pnpm build`, `pnpm check:links` green and perform manual spot checks on representative pages and exported artifacts.

**Editorial note:** This PR deliberately prefers a conservative, reversible publication boundary over bulk-promoting evidence whose exact scope has not been individually checked.
