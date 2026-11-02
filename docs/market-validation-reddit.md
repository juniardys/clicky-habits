# Market validation: Reddit (Nov 2026)

Method: search Reddit (logged-in Chrome, last year, relevance sort), open each
top post, read title and body. 7 queries, about 30 posts. Comments were mostly
not captured, so this is post-level evidence only.

## Verdict

1. **Is the pain real?** Yes. The strongest signal is abandonment, not logging
   effort: people quit habit apps after 2-3 weeks because the app becomes
   another chore, streaks reset to zero, and the app only reports what they
   missed.
2. **Does "replacement for a physical tracker" fit?** Partly. A real but small
   group wants tactile trackers (marble tracker, paper trackers, bullet
   journals, Everyday Calendar). The mainstream complaint is guilt and
   maintenance, not "my app is not physical enough". Lead with "satisfying and
   no guilt", use physical as the proof of how.
3. **Warning:** the niche is flooded with "I built a habit tracker" posts and
   the sentiment "we don't need another habit tracker app". Differentiation
   must be obvious in one sentence.

## Evidence for the problem

| Theme | Post | Sub |
|---|---|---|
| App is another chore | [Am I the only one who finds habit-tracking apps more exhausting than helpful](https://www.reddit.com/r/getdisciplined/comments/1x7u0yg/am_i_the_only_one_who_finds_habittracking_apps/) | r/getdisciplined |
| Abandon after 2-3 weeks | [When you stop using a habit tracker, does the habit die with it?](https://www.reddit.com/r/Habits/comments/1wn9rbx/when_you_stop_using_a_habit_tracker_does_the/) | r/Habits |
| Deleted every app | [I deleted every habit app and went back to Apple Reminders](https://www.reddit.com/r/Habits/comments/1tay1p5/i_deleted_every_habit_app_and_went_back_to_apple/) | r/Habits |
| Streak resets cause quitting | [I think most habit trackers accidently make people quit](https://www.reddit.com/r/getdisciplined/comments/1ujwoov/i_think_most_habit_trackers_accidently_make/) | r/getdisciplined |
| Red X and guilt | [I built a habit tracker for people who quit habit trackers](https://www.reddit.com/r/SideProject/comments/1x78gid/i_built_a_habit_tracker_for_people_who_quit_habit/) | r/SideProject |
| Day 2 then never again | [My habit trackers doesn't know why my day fell apart](https://www.reddit.com/r/QuantifiedSelf/comments/1t8cwfm/my_habit_trackers_doesnt_know_why_my_day_fell/) | r/QuantifiedSelf |
| Gave up, ADHD, flexible paper | [I gave up on habit tracking and feel disappointed/relieved](https://www.reddit.com/r/hobonichi/comments/1woa9mv/i_gave_up_on_habit_tracking_and_feel/) | r/hobonichi |
| Grid looks nice but does not stick | [Most habit trackers just give you a satisfying grid to look at](https://www.reddit.com/r/getdisciplined/comments/1wkoidq/most_habit_trackers_just_give_you_a_satisfying/) | r/getdisciplined |
| Cue beats desire | [I tracked every habit I tried for 18 months](https://www.reddit.com/r/getdisciplined/comments/1ucgvof/i_tracked_every_habit_i_tried_for_18_months_one/) | r/getdisciplined |
| Rest day, no punishment | [I made a habit tracker that doesn't punish you for missing days](https://www.reddit.com/r/bulletjournal/comments/1x01381/i_made_a_habit_tracker_that_doesnt_punish_you_for/) | r/bulletjournal |

Titles found without a captured link (search the title on Reddit):

- "Anyone giving up on the habit/to-do App because of the extra work it requires?"
- "The 'don't break the chain' method worked for 60 days. Then it backfired. Here's what I do instead."
- "Beta testers for ADHD habit app wanted"

## Evidence for the physical-tracker angle

| Post | Sub | Why it matters |
|---|---|---|
| [Made a wall mounted monthly marble habit tracker](https://www.reddit.com/r/3Dprinting/comments/1q9azcx/made_a_wall_mounted_monthly_marble_habit_tracker/) | r/3Dprinting | "Got tired of apps", wants tactile feedback. Closest match to the coin jar. Inspired by the Everyday Calendar. |
| [Looking for a paper-based habit tracker](https://www.reddit.com/r/ProductivityGuide/comments/1x33arv/looking_for_a_paperbased_habit_tracker/) | r/ProductivityGuide | Explicit demand for paper. |
| [Physical Tools for Habit Tracking](https://www.reddit.com/r/Habits/comments/1wsouik/physical_tools_for_habit_tracking/) | r/Habits | People compare sticky notes, planners, whiteboards. |
| [I gave up on habit tracking](https://www.reddit.com/r/hobonichi/comments/1woa9mv/i_gave_up_on_habit_tracking_and_feel/) | r/hobonichi | Paper stays because it is flexible and forgiving. |

Gap: no post asked for "a digital version of a physical tracker". Users who
like physical trackers mostly want to stay physical. Your pitch has to be
"keeps the feeling, drops the setup and the guilt", not "physical but digital".

## Feature ideas mapped to complaints

1. **Forgiving streaks.** Rest day, "never miss twice", recovery after a miss.
   Most repeated complaint. Check how the current streak logic handles a single
   missed day.
2. **Zero-maintenance setup.** Add a habit in seconds, no template weekend.
   Complaint: the app becomes its own chore.
3. **Tactile payoff as the hook.** Coin drop sound, haptics, jar filling, pen
   cross-off animation. This is what physical trackers have that grids lack.
4. **Cue anchoring.** "After I [existing thing], I will [habit]" field. Cited in
   three posts as what actually predicts survival.
5. **Limit visible habits.** Sections with at most 3 habits at a time (ADHD
   overwhelm).
6. **No shaming UI.** Missed days are empty, not red.
7. **Context for bad days.** A short "why did today fall apart" note, which
   Mochi could summarize. Fits the QuantifiedSelf complaint.
8. **Offline, no account, export.** Repeated as a trust feature in builder
   posts.
9. **Physical bridge.** Printable monthly calendar or a shareable image of the
   jar, for bullet journal and marble-tracker people.

## Comment findings (9 threads, about 10-25 comments captured each)

Paraphrased from comments, no usernames.

**Confirms the pain**

- "Felt like updating the Jira board at work." "Apps feel like one more thing to
  manage." Any change in routine forces a full reshuffle.
  ([thread](https://www.reddit.com/r/getdisciplined/comments/1x7u0yg/am_i_the_only_one_who_finds_habittracking_apps/))
- Streak zero is a reason to avoid the app: "I miss one, then leave the app
  closed. I still want the habit, I just don't want to see that." Same thread.
- Tracking only works as a reminder for some people, and they stop once the
  habit is automatic.
  ([thread](https://www.reddit.com/r/hobonichi/comments/1woa9mv/i_gave_up_on_habit_tracking_and_feel/))

**Supports the tactile and physical angle**

- A commenter wants "a tactile way to keep track, because apps don't work well
  and I won't pay a monthly sub", and says they built their own app but rarely
  use it.
  ([thread](https://www.reddit.com/r/3Dprinting/comments/1q9azcx/made_a_wall_mounted_monthly_marble_habit_tracker/))
- Several people run paper and app together and mark in all of them "to get more
  dopamine". The marking act itself is the reward.
  ([thread](https://www.reddit.com/r/Habits/comments/1wsouik/physical_tools_for_habit_tracking/))
- The paper-tracker seeker wants "as little friction as possible, effortless,
  even enjoyable". Top suggestion: a join-the-dots picture, one dot per day, so
  you see an image form.
  ([thread](https://www.reddit.com/r/ProductivityGuide/comments/1x33arv/looking_for_a_paperbased_habit_tracker/))
- "Pen and paper is still king": people feel closer to their own thoughts.

**Counter signals (be careful)**

- Gamification is split. One side: "the app isn't going to the gym for me no
  matter how many cartoons you add". Other side: XP and cosmetics motivate them.
  Safer to make the reward a physical metaphor (coins, jar) than an RPG.
- Some people think tracking is mostly a waste and quit on purpose. Not your
  market.
- Push reminders are the one thing people keep using a calendar app for.
- Subscription aversion: one-time purchase or generous free tier is a selling
  point.

**New feature ideas from comments**

1. **Reveal picture.** A dot-to-dot or hidden image that fills as you complete
   days, as an alternative visual to the calendar and jar.
2. **Rotating or weekly habits and a "free week".** Users cross off an
   over-ambitious goal and give themselves free checks without guilt.
3. **One-tap done from a widget or reminder notification.** Cuts the "open app,
   find habit, tap" friction.
4. **Reminder-first mode.** Track as a reminder list, auto-hide a habit once it
   is automatic.
5. **Reframe copy.** "Tiny things I do to look after myself" worked better than
   "habit tracker" for one commenter.

## Willingness to pay

**Short answer: Reddit shows price sensitivity and subscription aversion, but
almost no one says "I paid for this and would again".** Direct proof of
willingness to pay is not found here. Treat as unvalidated.

What the threads do show:

| Signal | Source |
|---|---|
| Wants no subscription: "a REAL free habit tracker", subscription wall is the dealbreaker | [r/productivity](https://www.reddit.com/r/productivity/comments/1wlytc0/real_free_habit_tracker_you_can_recommend_to_me/) |
| Asks for the best tracker "under $5 a month" | [r/ProductivityApps](https://www.reddit.com/r/ProductivityApps/comments/1xgc5qk/can_someone_help_my_find_the_best_cheap_habit/) |
| Builder says subscriptions are "paying monthly for basically a calendar with checkboxes", ships no account, no subscription | [r/AppIdeas](https://www.reddit.com/r/AppIdeas/comments/1whqkot/i_built_a_habit_tracker_with_no_accounts_no/) |
| Complaint that wanted features are "locked behind a subscription", and "how much can I do for free, what do I get for paying?" is a top criterion | [r/Habits tier list](https://www.reddit.com/r/Habits/comments/1wse40l/ultimate_habit_tracker_tier_list/) |
| Market price points in one comparison thread: one-time $5.99 (Apple only), $59.99 lifetime or $2.49 per month annual, $35.99 per year, $4.99 per month, $5 per month or $48 per year, about $10 per month (Atomic Habits app). Free tiers cap at 1 to 5 habits | [r/ProductivityApps](https://www.reddit.com/r/ProductivityApps/comments/1usmqrt/best_habit_tracker_apps_what_are_your_experiences/) |
| A paid app at $47 lifetime is being given away free for 48h to get reviews, a sign that paid conversion is hard | [r/AppGiveaway](https://www.reddit.com/r/AppGiveaway/comments/1vovr74/ios_47_free_lifetime_48h_habits_habit_tracker/) |
| Many builders now compete on "free lifetime" for early users, which anchors expectations at free | [r/ShowYourApp](https://www.reddit.com/r/ShowYourApp/comments/1q91do7/stop_paying_for_habit_trackers_i_am_giving_away/) |
| Money-on-the-line model: stake $1.99, $5.99 or $24.99 per habit, no evidence of uptake in the post | [r/SideProject](https://www.reddit.com/r/SideProject/comments/1qrmbse/built_a_habit_tracker_that_charges_you_money_if/) |
| A solo dev asks "if you ever paid for one, what pushed you over the line?", answers in the thread are about quitting, not paying | [r/getdisciplined](https://www.reddit.com/r/getdisciplined/comments/1x096xs/if_youve_used_a_habit_tracker_and_stopped_i_want/) |

What kind of app people say they would value (not the same as paying):

- Flexible plans that survive a bad day, light fun and collecting things
  ("watching something grow"), quick to understand, not another set of
  responsibilities.
- Free tier that is actually usable, paid tier clearly different.

Reading for Clicky (hypothesis, not proven):

- Avoid a monthly subscription as the headline. Expectation is free or one-time.
- A one-time purchase or lifetime tier in the low double digits is within
  seen price points ($5.99 to $59.99). A cheap annual plan is the other
  option.
- Free tier should include the core tactile loop (one calendar, one jar) so
  the feeling is felt before paying. Gate extras: more habits, multiple jars
  or skins, export, widgets.
- Because Reddit cannot prove payment, test it directly: a landing page with a
  price and a pre-order or waitlist-with-deposit button, shown to
  r/bulletjournal and r/Habits users. Count clicks on "pay", not likes.

## Caveats

- About 30 posts plus comments on 9 threads, one year window, relevance sort.
  Treat as directional. Two threads returned no readable comments.
- Many hits are builders promoting their own app, not users. Pain statements in
  those posts are real but filtered through a sales pitch.
- Only top-loaded comments were captured (a few scrolls per thread), so deeper
  replies are missing.
- Reddit's `.json` endpoint was blocked by network security and was not used.
