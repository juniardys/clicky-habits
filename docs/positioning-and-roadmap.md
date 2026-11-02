# Positioning and roadmap (draft)

Based on [market-validation-reddit.md](market-validation-reddit.md). Directional,
not proven. Date: Nov 2026.

## Positioning

**One line:** A habit tracker that feels like crossing off a calendar and filling
a jar. Missing a day does not punish you.

Three pillars: **satisfying, forgiving, light.**

Why:

- Biggest pain is emotional: apps feel like a chore, and a streak that resets to
  zero makes people avoid the app. It is not about missing features.
- Physical trackers win on two things: a satisfying act of marking, and no
  punishment. Clicky copies those two.
- People who like physical trackers mostly want to stay physical. "Replacement
  for a physical tracker" is not the headline. Use it as proof of how, for
  example "inspired by marble jars and the Everyday Calendar".
- The market is flooded with "another habit tracker". The difference must be
  visible in 5 seconds, and the tactile calendar and jar are that difference.

## Feature changes

Streak and recording logic has not been checked in code yet. Items 1 and 2 need
a code review first.

### High priority (hits the core pain)

1. **Forgiving streaks.** Rest day, "never miss twice" rule, recovery after a
   miss. Do not show a loud zero. A missed day is empty, not red.
2. **Check current streak logic.** If one missed day resets everything, that is
   the biggest risk, because it is the most repeated complaint.
3. **One-tap logging.** Done button from a widget or notification. A great
   tactile feel is wasted if people do not open the app.
4. **Polish the tactile payoff.** Coin sound, haptics, pen animation, jar full
   then next jar transition. This is the unique strength.

### Medium priority

5. **Fast setup, few habits.** Start with one to three habits, hide the rest.
   Many checkboxes overwhelm people.
6. **Reveal picture view.** Dot-to-dot or hidden image that fills one day at a
   time, as an alternative to calendar and jar.
7. **Rotating weekly habits and a free week.** Allow crossing off an over
   ambitious goal without guilt.
8. **Reliable reminders.** Many people keep a calendar app only for alerts.
9. **Cue anchor.** One field: "After I [thing], I will [habit]". Cited in
   three posts as what makes a habit last.

### Defer or do not headline

- **Stats dashboard and charts.** Not a stated need. Keep as a supporting
  feature.
- **Mochi chat.** Weak as a general chatbot. If kept, narrow it to one job:
  summarize "why today fell apart".
- **RPG gamification, XP, leaderboards, social.** Opinions are split and it
  clashes with "light, no pressure".

## Pricing direction (hypothesis, unproven)

- Avoid a monthly subscription as the headline. Market expectation is free or
  one-time.
- Free: the core tactile loop (one calendar, one jar).
- Locked (guess): more habits, multiple jars or skins, export, widgets.
- Seen price points: one-time $5.99, lifetime $59.99, $35.99 per year, $4.99
  per month.
- Reddit cannot prove payment. Test with a landing page that shows a price and a
  pre-order or deposit button.

## Biggest untested assumptions

1. Does the 3D tactile effect feel good and useful on a phone screen, not only
   on desktop?
2. Will people pay for "satisfying" alone?

Cheap test: record a 15 second demo (cross off, coin drop, jar fills) and show
it on r/bulletjournal or r/Habits. Watch for "where can I get this?".

## Next steps for tomorrow

- [ ] Review streak logic in the API and web app against item 1 and 2.
- [ ] Review the logging flow and count taps from open to done.
- [ ] Decide the primary target: ADHD and bullet journal users (ritual,
      forgiving) or general workers (low friction, widget). This sets the order
      of items 1-9.
- [ ] Record the 15 second demo and post for feedback.
- [ ] Draft the pricing landing page with a pre-order button.
- [ ] Read deeper comments on the r/getdisciplined and r/Habits threads for
      more user language.
