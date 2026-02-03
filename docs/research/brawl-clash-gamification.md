# Brawl Stars + Clash of Clans UI/Theme Research and Gamification Investigation

## Executive Summary
This research reviews the visual language of **Brawl Stars** and **Clash of Clans** (color, shape, UI motifs), and synthesizes evidence-backed gamification frameworks and competitive design principles (hooks, achievements, and leaderboards). The goal is to translate those game-grade patterns into a compact, high-clarity desktop UI for WakaWars while avoiding common gamification pitfalls.

Key conclusions:
- Both games use **bold, high-contrast, cartoon-stylized UI** with chunky shapes, thick outlines, bright palettes, and strongly framed panels. The interface emphasizes clarity and immediate feedback through large iconography and medal-like status indicators. (Brawl Stars screenshots; Clash of Clans screenshots)
- Effective gamified systems align **motivation, ability, and prompts** at the moment of action (Fogg Behavior Model), and can be reinforced by a **habit loop** of trigger → action → variable reward → investment (Hooked Model). (Stanford Behavior Design Lab; Behavioral Scientist)
- **Octalysis** provides a practical map of eight motivation drives, useful for balancing achievement, social competition, creativity, and scarcity to avoid burn-out. (Yu-kai Chou)
- **Leaderboards** are powerful but need careful design: research recommends **macro + micro leaderboards** together to reduce failure experiences and increase attainable goals. (JMIR Serious Games)
- Evidence shows gamification can increase adoption or engagement, but **badges/points/leaderboards can also cause negative effects** when overemphasized or poorly balanced. (arXiv 2208.05860; arXiv 2305.08346; arXiv 2203.16175)

## Visual/UI Theme Analysis

### Brawl Stars (UI language)
Observed in official screenshots:
- **Vivid, saturated color palette** (electric blue, magenta, neon accents) with heavy contrast against dark outlines and shadowed shapes.
- **Chunky, rounded cards** and panels; bold drop shadows; large, easy-to-tap iconography.
- **Medals/trophies and rank badges** placed near avatars and names to emphasize status.
- **Left-rail icon menu** with stacked square buttons and visible “badge” counters (e.g., notifications).

Source screenshots:
- https://images.mobi.gg/uploads/2023/10/516/brawl-stars-screenshot-3.webp
- https://images.mobi.gg/uploads/2023/10/514/brawl-stars-screenshot-1.webp

### Clash of Clans (UI language)
Observed in official screenshots:
- **Banner-and-ribbon UI framing** (red ribbons, embossed headers) used to announce actions and rewards.
- **Card-based character tiles** with thick borders and bright highlights.
- **Warm, saturated fantasy palette** with wood/metal textures, framed panels, and strong bevel-like styling.
- **Status emphasis** via bold iconography and large UI callouts.

Source screenshots:
- https://images.mobi.gg/uploads/2023/10/509/clash-of-clans-screenshot-1.webp
- https://images.mobi.gg/uploads/2023/10/508/clash-of-clans-screenshot-6.webp

### Translating These Themes into WakaWars
Design cues to carry over:
- **“Tournament grade” UI framing**: banners, ribbons, medals, shield shapes for rank and achievements.
- **High-contrast primary actions** with thick outlines and inset shadows.
- **Compact but bold typography** (tight spacing, heavy weights, strong hierarchy).
- **Vibrant background gradients** with subtle patterns instead of flat gray/white.


## Gamification and Competitive Design Research

### Foundational Behavior Models
- **Fogg Behavior Model**: behavior happens when **Motivation + Ability + Prompt** converge at the same time. This implies WakaWars should reduce friction on key actions (check leaderboard, add friend) while timing prompts around natural user “ability” windows. 
  Source: https://behaviordesign.stanford.edu/resources/fogg-behavior-model

- **Hooked Model**: habit-forming loop of **Trigger → Action → Variable Reward → Investment**. This supports cycles like: reminder → quick check-in → random reward (bonus medal) → invest (add note, set goal). 
  Source: https://www.thebehavioralscientist.com/glossary/hooked-model

### Motivation Frameworks
- **Octalysis**: eight core drives (e.g., accomplishment, social influence, ownership, unpredictability). Useful for balancing **competitive pressure (social influence)** with **intrinsic motivation (creativity, mastery)**. 
  Source: https://yukaichou.com/gamification-examples/octalysis-gamification-framework/

- **Gamification definition**: classic academic framing defines gamification as the **use of game design elements in non-game contexts**. 
  Source: https://www.gbl.uzh.ch/quartz/references/Deterding-et-al.-%282011%29

### Achievements, Badges, and Leaderboards (Evidence)
- **Badges/points/leaderboards** are widely used game elements in gamified systems; a large-scale DevOps study reported accelerated adoption when badges were introduced. 
  Source: https://arxiv.org/abs/2208.05860

- **Negative effects exist**: a systematic mapping study found badges, leaderboards, competitions, and points are the elements most often reported as causing negative effects (lack of effect, motivational issues, gaming the system). 
  Source: https://arxiv.org/abs/2305.08346

- **Gamification misuse** can lead users to fixate on rewards and neglect the underlying task, harming learning and well-being. 
  Source: https://arxiv.org/abs/2203.16175

### Leaderboard Design Principles
- Research recommends **macro + micro leaderboards** together to reduce failure experiences for lower-ranked users and provide more attainable goals. Micro leaderboards can be tied to specific activities, while macro shows overall rank. 
  Source: https://games.jmir.org/2021/2/e14746/


## Design Implications for WakaWars (Actionable)

1) **Multi-layered leaderboards**
- Macro leaderboard for overall hours.
- Micro leaderboards for streaks, daily gains, best sessions, or improvement delta.
- “Near me” ranking to reduce discouragement.

2) **Achievement system that reinforces quality**
- Badges based on **behavior quality** (focus blocks, consistency) rather than only raw hours.
- Tiered trophies (bronze/silver/gold) to echo game UI while avoiding “only top 1% wins.”

3) **Hook loop + Fogg alignment**
- Trigger: daily check-in reminder at a predictable time.
- Action: one-click open with immediate leaderboard view.
- Variable reward: rotating challenge or surprise medal.
- Investment: set a small goal or log a highlight.

4) **Visual language**
- Bold, cartoon-competitive UI with high-contrast panels, banners, medal rings, and big iconography.
- Color-coded ranks with strong motion cues on unlocks.

5) **Ethical guardrails**
- Avoid constant “loss” framing (don’t default to negative comparisons).
- Provide opt-in visibility for public rankings.
- Reward progress and personal bests, not only top positions.


## References
- Brawl Stars screenshots (UI reference): https://mobi.gg/en/brawl-stars/screenshots/
- Clash of Clans screenshots (UI reference): https://mobi.gg/en/clash-of-clans/screenshots/
- Fogg Behavior Model: https://behaviordesign.stanford.edu/resources/fogg-behavior-model
- Hooked Model: https://www.thebehavioralscientist.com/glossary/hooked-model
- Octalysis Framework: https://yukaichou.com/gamification-examples/octalysis-gamification-framework/
- Gamification definition (Deterding et al.): https://www.gbl.uzh.ch/quartz/references/Deterding-et-al.-%282011%29
- Leaderboard design principles (JMIR Serious Games): https://games.jmir.org/2021/2/e14746/
- Gamification in industry (badge study): https://arxiv.org/abs/2208.05860
- Negative effects mapping study: https://arxiv.org/abs/2305.08346
- Gamification misuse study: https://arxiv.org/abs/2203.16175
