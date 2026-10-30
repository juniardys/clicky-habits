import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useState,
  type ReactNode,
} from "react";

export type Lang = "en" | "id";

const STORAGE_KEY = "clicky-lang";

const translations = {
  en: {
    // nav
    "nav.home": "Home",
    "nav.dashboard": "Dashboard",
    "nav.logout": "Log out",
    // common
    "common.back": "← Home",
    "common.tracking": "Track",
    "common.stats": "Stats",
    "common.delete": "Delete",
    "common.cancel": "Cancel",
    "common.save": "Save",
    // home
    "home.myHabits": "My Habits",
    "home.addHabit": "+ Add Habit",
    "home.empty":
      "No habits yet. Add one, then choose to cross off a calendar or drop coins into a jar.",
    "home.typeCalendar": "🗓️ Cross-off Calendar",
    "home.typeJar": "🪙 Coins in a Jar",
    "home.daysCrossed": "{n} days crossed off",
    "home.coinsMeta": "{n} coins · {jars} jars full",
    "home.activeJar": "Active jar: {pct}%",
    "home.doneToday": "✓ Done today",
    "home.newHabit": "New Habit",
    "home.namePlaceholder": "e.g. daily workout, create content…",
    "home.calendarOption": "Cross-off Calendar",
    "home.calendarDesc": "Once a day, cross off the date",
    "home.jarOption": "Coins in a Jar",
    "home.jarDesc": "Multiple times a day, 100 coins per jar",
    "home.createFailed": "Failed to create habit",
    "home.deleteConfirm": 'Delete habit "{name}" and all its data?',
    // habit page
    "habit.calendarSub": "🗓️ Cross-off calendar. Click a date when your habit is done.",
    "habit.jarSub": "🪙 Total {total} coins · {jars} jars full",
    "habit.prevMonth": "Previous month",
    "habit.nextMonth": "Next month",
    "habit.todayCrossed": "✓ Today crossed off",
    "habit.crossToday": "✗ Cross Off Today",
    "habit.calendarHint": "Click any date to cross it off / undo. Tap the button again to undo today.",
    "habit.jarLabel": "Jar {cur}/{total} · {coins}/{cap} coins",
    "habit.jarLabelShort": "{cur}/{total} · {coins}/{cap}",
    "habit.prevJar": "Previous jar",
    "habit.nextJar": "Next jar",
    "habit.addCoin": "🪙 Drop a Coin",
    "habit.removeCoin": "Remove 1 Coin",
    "habit.removeCoinShort": "-1 Coin",
    "habit.jarHint":
      "Drag the jar to rotate. One jar holds {cap} coins. When it fills up, you move on to the next jar. Remove 1 Coin takes the last coin back out.",
    // stats page
    "stats.title": "Stats: {name}",
    "stats.currentStreak": "Current streak (days)",
    "stats.bestStreak": "Best streak (days)",
    "stats.totalCoins": "Total coins",
    "stats.totalDays": "Total days crossed",
    "stats.jarsFull": "Jars full",
    "stats.consistency30": "Consistency last 30 days",
    "stats.activeThisMonth": "Active days this month",
    "stats.chartJar": "Coins per day, last 30 days",
    "stats.chartCalendar": "Activity, last 30 days",
    "stats.unitCoins": "coins",
    "stats.unitDone": "done",
    // dashboard
    "dash.title": "Dashboard",
    "dash.subtitle": "All your habits at a glance",
    "dash.totalHabits": "Habits",
    "dash.activeDays30": "Active days (30d)",
    "dash.totalCoins": "Total coins",
    "dash.totalDaysMarked": "Total days crossed",
    "dash.bestStreak": "Best streak (days)",
    "dash.consistency30": "Consistency (30d)",
    "dash.chartTitle": "Combined activity, last 30 days",
    "dash.perHabit": "Per habit",
    "dash.colHabit": "Habit",
    "dash.colType": "Type",
    "dash.colTotal": "Total",
    "dash.colStreak": "Streak",
    "dash.colBest": "Best",
    "dash.colConsistency": "30d",
    "dash.empty": "No habits yet. Add one from Home to see your dashboard come alive.",
    "dash.unitActivity": "activity",
    "chart.sparse": "Your chart fills in after a few active days. Keep going!",
    // chat
    "chat.fab": "Ask Mochi",
    "chat.title": "Mochi",
    "chat.statusOnline": "Online - ask me anything",
    "chat.statusThinking": "Thinking…",
    "chat.statusWorking": "Working on it…",
    "chat.statusSpeaking": "Replying…",
    "chat.statusCelebrate": "Done! 🎉",
    "chat.statusError": "Something went wrong",
    "chat.newChat": "New chat",
    "chat.close": "Close chat",
    "chat.placeholder": "Ask Mochi anything...",
    "chat.send": "Send",
    "chat.stop": "Stop",
    "chat.retry": "Try again",
    "chat.undo": "Undo",
    "chat.undone": "Undone",
    "chat.confirmTitle": "Delete this habit?",
    "chat.confirmBody":
      "“{name}” and all its data will be permanently deleted. This cannot be undone.",
    "chat.delete": "Delete",
    "chat.confirmApproved": "Deleted ✓",
    "chat.confirmDeclined": "Kept - not deleted",
    "chat.confirmExpired": "This confirmation has expired",
    "chat.confirmCancelled": "Cancelled",
    "chat.promptStats": "How are my stats?",
    "chat.promptCheckin": "Check in my habits for today",
    "chat.promptNew": "Add a new habit",
    "chat.emptyTitle": "Hi! I'm Mochi 🌱",
    "chat.emptyBody":
      "Ask me about your streaks and stats, tell me to add a habit, or say you just finished one - I'll record it.",
    "chat.notConfiguredTitle": "Mochi isn't configured yet",
    "chat.notConfiguredBody":
      "Set LLM_BASE_URL, LLM_API_KEY and LLM_MODEL in the root .env, then restart the API.",
    "chat.loadFailed": "Couldn't load the chat. Check your connection and reopen the panel.",
    "chat.interrupted": "Stopped",
    "chat.genericError": "Something went wrong. Try again?",
    "chat.activityDone": "Worked through {count} steps",
    "chat.activityDoneWithErrors": "Worked through {count} steps - {errors} failed",
    // landing
    "landing.navHow": "How it works",
    "landing.navModes": "Two modes",
    "landing.navStats": "Stats",
    "landing.navFaq": "FAQ",
    "landing.signIn": "Sign in",
    "landing.badge": "🪙 Physical habit trackers, gone digital",
    "landing.heroTitleA": "Habits are ",
    "landing.heroTitleB": "play",
    "landing.heroTitleC": ", not a chore.",
    "landing.heroLede":
      "Clicky Habits turns a finished habit into something you can see and feel: cross off today's date, or drop a coin into a jar. One click per win - your streak does the persuading.",
    "landing.heroPrimary": "Start free",
    "landing.heroSecondary": "See how it works",
    "landing.heroMicro": "Free to start · 1-minute sign-up · No credit card",
    "landing.proofModes": "2 tracker modes",
    "landing.proofJar": "100 coins per jar",
    "landing.proofStats": "30-day stats",
    "landing.demoEyebrow": "Try it - no account needed",
    "landing.demoTitle": "This is the whole loop",
    "landing.demoCalTitle": "Cross-off Calendar",
    "landing.demoCalHint": "Tap a date you “did”. Tap again to undo.",
    "landing.demoCrossed": "{n} days crossed",
    "landing.demoJarTitle": "Coins in a Jar",
    "landing.demoJarHint": "Did it again? Drop another coin.",
    "landing.demoDrop": "🪙 Drop a coin",
    "landing.demoCoins": "{n} coins in this jar",
    "landing.demoJarFull": "{n} full jar(s)",
    "landing.demoReset": "Reset demo",
    "landing.demoDragJar": "Drag to spin the jar · It wobbles when a coin lands",
    "landing.demoDragCal": "Move your pointer to tilt the board · Click a tile to cross it",
    "landing.tryMode": "Try this mode ↑",
    "landing.problemEyebrow": "Why streaks die",
    "landing.problemTitle": "Checklists are easy to ignore. A jar filling up isn't.",
    "landing.problemBody":
      "Most habit apps give you a grey checkbox and a guilt trip. Clicky Habits borrows two physical rituals people already love - so finishing feels like finishing.",
    "landing.p1Title": "No satisfying “done” moment",
    "landing.p1Body":
      "A tiny tick disappears into a list. Crossing a date and dropping a coin gives your brain a finish line it can feel.",
    "landing.p2Title": "Progress you can't see",
    "landing.p2Body":
      "If last month's effort hides behind menus, motivation fades. Here progress sits on the surface: red crosses, coins, full jars.",
    "landing.p3Title": "One format for every habit",
    "landing.p3Body":
      "“Meditate once a day” and “write 500 words, three sessions a day” are not the same shape. Pick the tracker that matches the habit.",
    "landing.howEyebrow": "How it works",
    "landing.howTitle": "From sign-up to first coin in under a minute",
    "landing.s1Title": "Create a habit",
    "landing.s1Body": "Name it - daily workout, reading, creating content, anything you want to repeat.",
    "landing.s2Title": "Pick its tracker",
    "landing.s2Body": "Calendar for once-a-day habits. Jar for habits you can repeat and count, many times a day.",
    "landing.s3Title": "Click every time you finish",
    "landing.s3Body": "Cross the date or drop the coin. Streaks, totals, and charts update instantly - no journaling required.",
    "landing.modesEyebrow": "Two modes, explained",
    "landing.modesTitle": "Choose how your habit counts",
    "landing.modesLead": "This is the question every new user asks - here is the honest difference.",
    "landing.calRule": "Once per day, max.",
    "landing.calBody":
      "Finish today's habit, cross today's date with a fat red ✕. Miss a day and the chain visibly breaks - that is the point.",
    "landing.calBest": "Best for: once-a-day habits",
    "landing.calExamples": "Workout · Reading · Meditate · No sugar",
    "landing.jarRule": "As many times a day as you do it.",
    "landing.jarBody":
      "Every repetition drops one chunky coin into a glass jar. A jar holds exactly 100 coins; fill it and a fresh jar starts - hundreds become visible.",
    "landing.jarBest": "Best for: countable repetitions",
    "landing.jarExamples": "Push-ups · Writing sessions · Sales calls · Practice rounds",
    "landing.modesNote": "You can run both at once - different habits, different trackers, one account.",
    "landing.statsEyebrow": "Proof, not vibes",
    "landing.statsTitle": "See whether you're actually consistent",
    "landing.statsBody":
      "Every cross and coin feeds the same dashboard: current streak, best streak, consistency over the last 30 days, and activity charts per habit and across all habits.",
    "landing.statsL1": "Current streak",
    "landing.statsL2": "Consistency, last 30 days",
    "landing.statsL3": "Coins collected",
    "landing.statsL4": "Active days this month",
    "landing.chartTitle": "Activity, last 30 days",
    "landing.statsCta": "Start tracking to make these numbers yours",
    "landing.examplesEyebrow": "What people track",
    "landing.examplesTitle": "If it repeats, it fits in a jar - or on a calendar",
    "landing.ex1": "🏃 Daily run - Calendar",
    "landing.ex2": "📚 Read 10 pages - Calendar",
    "landing.ex3": "✍️ Writing sessions - Jar",
    "landing.ex4": "💪 Push-up sets - Jar",
    "landing.ex5": "🎹 Piano practice - Jar",
    "landing.ex6": "🧘 Meditation - Calendar",
    "landing.faqEyebrow": "Frequently asked",
    "landing.faqTitle": "Still unsure? Here are the answers.",
    "landing.q1": "What exactly is Clicky Habits?",
    "landing.a1":
      "A digital version of two physical habit trackers: crossing days off a wall calendar, and dropping a coin in a jar for every rep. You create habits, choose one tracker per habit, and click each time you finish.",
    "landing.q2": "Which mode should I choose?",
    "landing.a2":
      "If the habit is done once a day, choose Calendar. If you can do it several times a day and want to count repetitions, choose Jar (100 coins per jar).",
    "landing.q3": "What happens when a jar fills up?",
    "landing.a3":
      "Nothing is lost. The jar is marked full and a new empty jar starts, so 250 coins reads as 2 full jars plus 50 in the current one.",
    "landing.q4": "Do I need an account? Is it free?",
    "landing.a4":
      "Yes, an account keeps your habits saved and synced; sign up free with Google or email in about a minute. No credit card is asked for.",
    "landing.q5": "Can I undo a mistake?",
    "landing.a5":
      "Yes. On a calendar, click a crossed date again to undo it. Your stats recalculate from the corrected history.",
    "landing.finalTitle": "A blank calendar and an empty jar. Fill one today.",
    "landing.finalBody":
      "Create your first habit, pick a tracker, and earn your first cross - or your first coin - in the next minute.",
    "landing.finalButton": "Create my free account",
    "landing.footer": "Clicky Habits - cross the calendar, fill the jar.",
    // login
    "login.tagline":
      "Physical habit trackers, gone digital. Cross off a calendar or drop a coin into a jar every time your habit is done.",
    "login.google": "Sign in with Google",
    "login.orEmail": "or use email",
    "login.name": "Name",
    "login.password": "Password (min. 8 characters)",
    "login.signIn": "Sign In",
    "login.signUp": "Sign Up",
    "login.noAccount": "No account yet? Sign up",
    "login.hasAccount": "Already have an account? Sign in",
    "login.backHome": "← Back to home",
    "login.googleFailed":
      "Google sign-in failed. Make sure GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET are set in .env (project root)",
    "login.signUpFailed": "Sign up failed",
    "login.wrongCreds": "Wrong email or password",
    "login.genericError": "Something went wrong",
    // nav: profile
    "nav.profile": "Profile",
    // profile
    "profile.title": "Profile",
    "profile.nameSection": "Your name",
    "profile.name": "Name",
    "profile.nameSaved": "Name saved",
    "profile.emailSection": "Email",
    "profile.currentEmail": "Current email",
    "profile.verified": "Verified",
    "profile.unverified": "Not verified",
    "profile.newEmail": "New email",
    "profile.changeEmail": "Change email",
    "profile.emailChangeSent":
      "Check the inbox of your new email and click the link to confirm the change.",
    "profile.emailChangedUnverified":
      "Email updated. Check your inbox to verify the new address.",
    "profile.emailChanged": "Your email has been changed and verified.",
    "profile.passwordSection": "Password",
    "profile.currentPassword": "Current password",
    "profile.newPassword": "New password (min. 8 characters)",
    "profile.confirmPassword": "Confirm new password",
    "profile.changePassword": "Change password",
    "profile.setPassword": "Set password",
    "profile.setPasswordNote":
      "You sign in with Google. Set a password to also sign in with your email and password.",
    "profile.passwordSaved": "Password saved. Other devices have been signed out.",
    "profile.passwordSet": "Password set. You can now sign in with your email too.",
    "profile.password_too_short": "Password must be at least 8 characters",
    "profile.password_too_long": "Password must be at most 128 characters",
    "profile.password_mismatch": "The passwords do not match",
    "profile.already_has_password": "This account already has a password",
    "profile.saveFailed": "Could not save. Please try again.",
    // verify email
    "verify.banner": "Please verify your email address. We sent a link to {email}.",
    "verify.resend": "Resend link",
    "verify.sent": "Link sent!",
    "verify.done": "Your email is verified. Thanks!",
    "verify.failed": "Could not send the link. Please try again.",
  },
  id: {
    // nav
    "nav.home": "Beranda",
    "nav.dashboard": "Dashboard",
    "nav.logout": "Keluar",
    // common
    "common.back": "← Beranda",
    "common.tracking": "Tracking",
    "common.stats": "Statistik",
    "common.delete": "Hapus",
    "common.cancel": "Batal",
    "common.save": "Simpan",
    // home
    "home.myHabits": "Kebiasaanku",
    "home.addHabit": "+ Tambah Kebiasaan",
    "home.empty":
      "Belum ada kebiasaan. Tambah satu, lalu pilih mau coret kalender atau masukkan koin ke toples.",
    "home.typeCalendar": "🗓️ Coret Kalender",
    "home.typeJar": "🪙 Koin dalam Toples",
    "home.daysCrossed": "{n} hari tercoret",
    "home.coinsMeta": "{n} koin · {jars} toples penuh",
    "home.activeJar": "Toples aktif: {pct}%",
    "home.doneToday": "✓ Sudah hari ini",
    "home.newHabit": "Kebiasaan Baru",
    "home.namePlaceholder": "Contoh: olahraga rutin, bikin konten…",
    "home.calendarOption": "Coret Kalender",
    "home.calendarDesc": "1x per hari, coret tanggalnya",
    "home.jarOption": "Koin dalam Toples",
    "home.jarDesc": "Bisa berkali-kali, 100 koin per toples",
    "home.createFailed": "Gagal membuat kebiasaan",
    "home.deleteConfirm": 'Hapus kebiasaan "{name}" beserta semua datanya?',
    // habit page
    "habit.calendarSub": "🗓️ Coret kalender. Klik tanggal saat kebiasaanmu selesai.",
    "habit.jarSub": "🪙 Total {total} koin · {jars} toples penuh",
    "habit.prevMonth": "Bulan sebelumnya",
    "habit.nextMonth": "Bulan berikutnya",
    "habit.todayCrossed": "✓ Hari ini tercoret",
    "habit.crossToday": "✗ Coret Hari Ini",
    "habit.calendarHint": "Klik tanggal mana pun untuk mencoret / membatalkan. Klik tombol lagi untuk membatalkan hari ini.",
    "habit.jarLabel": "Toples {cur}/{total} · {coins}/{cap} koin",
    "habit.jarLabelShort": "{cur}/{total} · {coins}/{cap}",
    "habit.prevJar": "Toples sebelumnya",
    "habit.nextJar": "Toples berikutnya",
    "habit.addCoin": "🪙 Masukkan Koin",
    "habit.removeCoin": "Keluarkan 1 Koin",
    "habit.removeCoinShort": "-1 Koin",
    "habit.jarHint":
      "Tarik toples untuk memutar. Satu toples muat {cap} koin. Kalau penuh, otomatis lanjut ke toples berikutnya. Keluarkan 1 Koin mengambil koin terakhir kembali.",
    // stats page
    "stats.title": "Statistik: {name}",
    "stats.currentStreak": "Streak saat ini (hari)",
    "stats.bestStreak": "Streak terbaik (hari)",
    "stats.totalCoins": "Total koin",
    "stats.totalDays": "Total hari tercoret",
    "stats.jarsFull": "Toples penuh",
    "stats.consistency30": "Konsistensi 30 hari terakhir",
    "stats.activeThisMonth": "Hari aktif bulan ini",
    "stats.chartJar": "Koin per hari, 30 hari terakhir",
    "stats.chartCalendar": "Aktivitas, 30 hari terakhir",
    "stats.unitCoins": "koin",
    "stats.unitDone": "selesai",
    // dashboard
    "dash.title": "Dashboard",
    "dash.subtitle": "Semua kebiasaanmu dalam satu layar",
    "dash.totalHabits": "Kebiasaan",
    "dash.activeDays30": "Hari aktif (30h)",
    "dash.totalCoins": "Total koin",
    "dash.totalDaysMarked": "Total hari tercoret",
    "dash.bestStreak": "Streak terbaik (hari)",
    "dash.consistency30": "Konsistensi (30h)",
    "dash.chartTitle": "Aktivitas gabungan, 30 hari terakhir",
    "dash.perHabit": "Per kebiasaan",
    "dash.colHabit": "Kebiasaan",
    "dash.colType": "Jenis",
    "dash.colTotal": "Total",
    "dash.colStreak": "Streak",
    "dash.colBest": "Terbaik",
    "dash.colConsistency": "30h",
    "dash.empty":
      "Belum ada kebiasaan. Tambah dulu dari Beranda biar dashboard-nya hidup.",
    "dash.unitActivity": "aktivitas",
    "chart.sparse": "Grafik mulai terisi setelah beberapa hari aktif. Lanjutkan!",
    // chat
    "chat.fab": "Tanya Mochi",
    "chat.title": "Mochi",
    "chat.statusOnline": "Online - tanya apa saja",
    "chat.statusThinking": "Lagi mikir…",
    "chat.statusWorking": "Lagi ngerjain…",
    "chat.statusSpeaking": "Lagi jawab…",
    "chat.statusCelebrate": "Berhasil! 🎉",
    "chat.statusError": "Ada yang salah",
    "chat.newChat": "Chat baru",
    "chat.close": "Tutup chat",
    "chat.placeholder": "Tanya Mochi apa saja...",
    "chat.send": "Kirim",
    "chat.stop": "Berhenti",
    "chat.retry": "Coba lagi",
    "chat.undo": "Urungkan",
    "chat.undone": "Dibatalkan",
    "chat.confirmTitle": "Hapus habit ini?",
    "chat.confirmBody":
      "“{name}” beserta semua datanya akan dihapus permanen. Ini tidak bisa dibatalkan.",
    "chat.delete": "Hapus",
    "chat.confirmApproved": "Sudah dihapus ✓",
    "chat.confirmDeclined": "Tidak jadi dihapus",
    "chat.confirmExpired": "Konfirmasi ini sudah kedaluwarsa",
    "chat.confirmCancelled": "Dibatalkan",
    "chat.promptStats": "Statistikku gimana?",
    "chat.promptCheckin": "Catat habit-ku hari ini",
    "chat.promptNew": "Tambah habit baru",
    "chat.emptyTitle": "Hai! Aku Mochi 🌱",
    "chat.emptyBody":
      "Tanya soal streak dan statistikmu, suruh aku tambah habit, atau bilang kamu barusan selesai - nanti kucatat.",
    "chat.notConfiguredTitle": "Mochi belum dikonfigurasi",
    "chat.notConfiguredBody":
      "Isi LLM_BASE_URL, LLM_API_KEY dan LLM_MODEL di .env root, lalu restart API.",
    "chat.loadFailed": "Chat gagal dimuat. Cek koneksi lalu buka lagi panelnya.",
    "chat.interrupted": "Dihentikan",
    "chat.genericError": "Terjadi kesalahan. Coba lagi ya?",
    "chat.activityDone": "Selesai lewat {count} langkah",
    "chat.activityDoneWithErrors": "Selesai lewat {count} langkah - {errors} gagal",
    // landing
    "landing.navHow": "Cara Kerja",
    "landing.navModes": "Dua Mode",
    "landing.navStats": "Statistik",
    "landing.navFaq": "FAQ",
    "landing.signIn": "Masuk",
    "landing.badge": "🪙 Habit tracker fisik, jadi digital",
    "landing.heroTitleA": "Kebiasaan itu ",
    "landing.heroTitleB": "mainan",
    "landing.heroTitleC": ", bukan beban.",
    "landing.heroLede":
      "Clicky Habits mengubah kebiasaan yang selesai jadi sesuatu yang terlihat dan terasa: coret tanggal hari ini, atau jatuhkan koin ke toples. Satu klik per kemenangan - streak yang akan membujukmu lanjut.",
    "landing.heroPrimary": "Mulai gratis",
    "landing.heroSecondary": "Lihat cara kerjanya",
    "landing.heroMicro": "Gratis untuk mulai · Daftar 1 menit · Tanpa kartu kredit",
    "landing.proofModes": "2 mode tracker",
    "landing.proofJar": "100 koin per toples",
    "landing.proofStats": "Statistik 30 hari",
    "landing.demoEyebrow": "Coba langsung - tanpa daftar",
    "landing.demoTitle": "Ini inti permainannya",
    "landing.demoCalTitle": "Coret Kalender",
    "landing.demoCalHint": "Ketuk tanggal yang “selesai”. Ketuk lagi untuk membatalkan.",
    "landing.demoCrossed": "{n} hari tercoret",
    "landing.demoJarTitle": "Koin dalam Toples",
    "landing.demoJarHint": "Selesai lagi? Jatuhkan koin lagi.",
    "landing.demoDrop": "🪙 Jatuhkan koin",
    "landing.demoCoins": "{n} koin di toples ini",
    "landing.demoJarFull": "{n} toples penuh",
    "landing.demoReset": "Ulangi demo",
    "landing.demoDragJar": "Seret untuk memutar toples · Dia bergoyang saat koin mendarat",
    "landing.demoDragCal": "Gerakkan pointer untuk memiringkan papan · Klik ubin untuk mencoretnya",
    "landing.tryMode": "Coba mode ini ↑",
    "landing.problemEyebrow": "Kenapa streak putus",
    "landing.problemTitle": "Checklist gampang diabaikan. Toples yang terisi tidak.",
    "landing.problemBody":
      "Kebanyakan aplikasi habit memberimu checkbox abu-abu dan rasa bersalah. Clicky Habits meminjam dua ritual fisik yang sudah terbukti disukai orang - jadi selesai terasa benar-benar selesai.",
    "landing.p1Title": "Tidak ada momen “selesai” yang memuaskan",
    "landing.p1Body":
      "Centang kecil hilang di dalam daftar. Mencoret tanggal dan menjatuhkan koin memberi otakmu garis finis yang terasa.",
    "landing.p2Title": "Progres tidak terlihat",
    "landing.p2Body":
      "Kalau usaha bulan lalu tersembunyi di balik menu, motivasi memudar. Di sini progres ada di permukaan: coretan merah, koin, toples penuh.",
    "landing.p3Title": "Satu format untuk semua kebiasaan",
    "landing.p3Body":
      "“Meditasi sekali sehari” dan “tulis 500 kata, tiga sesi sehari” bentuknya beda. Pilih tracker yang cocok dengan kebiasaannya.",
    "landing.howEyebrow": "Cara kerja",
    "landing.howTitle": "Dari daftar sampai koin pertama di bawah satu menit",
    "landing.s1Title": "Buat kebiasaan",
    "landing.s1Body": "Beri nama - olahraga harian, membaca, bikin konten, apa pun yang mau kamu ulangi.",
    "landing.s2Title": "Pilih tracker-nya",
    "landing.s2Body": "Kalender untuk kebiasaan sekali sehari. Toples untuk kebiasaan yang bisa diulang dan dihitung berkali-kali sehari.",
    "landing.s3Title": "Klik tiap kali selesai",
    "landing.s3Body": "Coret tanggalnya atau jatuhkan koinnya. Streak, total, dan grafik langsung terupdate - tanpa perlu jurnal.",
    "landing.modesEyebrow": "Dua mode, dijelaskan",
    "landing.modesTitle": "Pilih cara kebiasaanmu dihitung",
    "landing.modesLead": "Ini pertanyaan yang selalu ditanyakan user baru - ini perbedaan jujurnya.",
    "landing.calRule": "Sekali per hari, maksimal.",
    "landing.calBody":
      "Selesaikan kebiasaan hari ini, coret tanggalnya dengan ✕ merah gendut. Bolong sehari, rantainya terlihat putus - memang itu tujuannya.",
    "landing.calBest": "Cocok untuk: kebiasaan sekali sehari",
    "landing.calExamples": "Olahraga · Membaca · Meditasi · Tanpa gula",
    "landing.jarRule": "Sebanyak kamu melakukannya dalam sehari.",
    "landing.jarBody":
      "Tiap repetisi menjatuhkan satu koin chunky ke toples kaca. Satu toples muat tepat 100 koin; penuh, toples baru mulai - ratusan jadi terlihat.",
    "landing.jarBest": "Cocok untuk: repetisi yang bisa dihitung",
    "landing.jarExamples": "Push-up · Sesi menulis · Telepon sales · Latihan",
    "landing.modesNote": "Keduanya bisa jalan bersamaan - kebiasaan berbeda, tracker berbeda, satu akun.",
    "landing.statsEyebrow": "Bukti, bukan perasaan",
    "landing.statsTitle": "Lihat apakah kamu benar-benar konsisten",
    "landing.statsBody":
      "Tiap coretan dan koin masuk ke dashboard yang sama: streak saat ini, streak terbaik, konsistensi 30 hari terakhir, dan grafik aktivitas per kebiasaan maupun gabungan.",
    "landing.statsL1": "Streak saat ini",
    "landing.statsL2": "Konsistensi 30 hari terakhir",
    "landing.statsL3": "Koin terkumpul",
    "landing.statsL4": "Hari aktif bulan ini",
    "landing.chartTitle": "Aktivitas 30 hari terakhir",
    "landing.statsCta": "Mulai tracking agar angka ini jadi milikmu",
    "landing.examplesEyebrow": "Yang biasa dilacak",
    "landing.examplesTitle": "Kalau bisa diulang, muat di toples - atau di kalender",
    "landing.ex1": "🏃 Lari harian - Kalender",
    "landing.ex2": "📚 Baca 10 halaman - Kalender",
    "landing.ex3": "✍️ Sesi menulis - Toples",
    "landing.ex4": "💪 Set push-up - Toples",
    "landing.ex5": "🎹 Latihan piano - Toples",
    "landing.ex6": "🧘 Meditasi - Kalender",
    "landing.faqEyebrow": "Sering ditanyakan",
    "landing.faqTitle": "Masih ragu? Ini jawabannya.",
    "landing.q1": "Sebenarnya Clicky Habits itu apa?",
    "landing.a1":
      "Versi digital dari dua habit tracker fisik: mencoret hari di kalender dinding, dan memasukkan koin ke toples tiap repetisi. Kamu membuat kebiasaan, memilih satu tracker per kebiasaan, dan klik tiap kali selesai.",
    "landing.q2": "Pilih mode yang mana?",
    "landing.a2":
      "Kalau kebiasaannya selesai sekali sehari, pilih Kalender. Kalau bisa dilakukan beberapa kali sehari dan mau menghitung repetisi, pilih Toples (100 koin per toples).",
    "landing.q3": "Apa yang terjadi kalau toples penuh?",
    "landing.a3":
      "Tidak ada yang hilang. Toples ditandai penuh dan toples kosong baru dimulai, jadi 250 koin terbaca sebagai 2 toples penuh plus 50 di toples berjalan.",
    "landing.q4": "Harus punya akun? Gratis?",
    "landing.a4":
      "Ya, akun membuat kebiasaanmu tersimpan dan tersinkron; daftar gratis pakai Google atau email sekitar satu menit. Tidak ada kartu kredit yang diminta.",
    "landing.q5": "Kalau salah klik bisa dibatalkan?",
    "landing.a5":
      "Bisa. Di kalender, klik lagi tanggal yang tercoret untuk membatalkannya. Statistikmu dihitung ulang dari riwayat yang sudah diperbaiki.",
    "landing.finalTitle": "Kalender kosong, toples kosong. Isi salah satunya hari ini.",
    "landing.finalBody":
      "Buat kebiasaan pertamamu, pilih tracker, dan dapatkan coretan pertama - atau koin pertamamu - dalam semenit ke depan.",
    "landing.finalButton": "Buat akun gratisku",
    "landing.footer": "Clicky Habits - coret kalendernya, isi toplesnya.",
    // login
    "login.tagline":
      "Habit tracker fisik, jadi digital. Coret kalender atau masukkan koin ke toples tiap kali kebiasaanmu selesai.",
    "login.google": "Masuk dengan Google",
    "login.orEmail": "atau pakai email",
    "login.name": "Nama",
    "login.password": "Password (min. 8 karakter)",
    "login.signIn": "Masuk",
    "login.signUp": "Daftar",
    "login.noAccount": "Belum punya akun? Daftar",
    "login.hasAccount": "Sudah punya akun? Masuk",
    "login.backHome": "← Kembali ke beranda",
    "login.googleFailed":
      "Login Google gagal. Pastikan GOOGLE_CLIENT_ID dan GOOGLE_CLIENT_SECRET sudah diisi di .env (root project)",
    "login.signUpFailed": "Gagal daftar",
    "login.wrongCreds": "Email atau password salah",
    "login.genericError": "Terjadi kesalahan",
    // nav: profile
    "nav.profile": "Profil",
    // profile
    "profile.title": "Profil",
    "profile.nameSection": "Nama kamu",
    "profile.name": "Nama",
    "profile.nameSaved": "Nama disimpan",
    "profile.emailSection": "Email",
    "profile.currentEmail": "Email sekarang",
    "profile.verified": "Terverifikasi",
    "profile.unverified": "Belum diverifikasi",
    "profile.newEmail": "Email baru",
    "profile.changeEmail": "Ganti email",
    "profile.emailChangeSent":
      "Cek inbox email baru kamu dan klik link-nya untuk konfirmasi perubahan.",
    "profile.emailChangedUnverified":
      "Email diperbarui. Cek inbox untuk verifikasi alamat baru.",
    "profile.emailChanged": "Email kamu sudah diganti dan terverifikasi.",
    "profile.passwordSection": "Password",
    "profile.currentPassword": "Password sekarang",
    "profile.newPassword": "Password baru (min. 8 karakter)",
    "profile.confirmPassword": "Konfirmasi password baru",
    "profile.changePassword": "Ubah password",
    "profile.setPassword": "Buat password",
    "profile.setPasswordNote":
      "Kamu masuk pakai Google. Buat password supaya bisa masuk juga dengan email dan password.",
    "profile.passwordSaved": "Password disimpan. Perangkat lain sudah dikeluarkan.",
    "profile.passwordSet": "Password dibuat. Sekarang kamu bisa masuk pakai email juga.",
    "profile.password_too_short": "Password minimal 8 karakter",
    "profile.password_too_long": "Password maksimal 128 karakter",
    "profile.password_mismatch": "Password tidak sama",
    "profile.already_has_password": "Akun ini sudah punya password",
    "profile.saveFailed": "Gagal menyimpan. Coba lagi.",
    // verify email
    "verify.banner": "Verifikasi alamat email kamu. Kami sudah kirim link ke {email}.",
    "verify.resend": "Kirim ulang link",
    "verify.sent": "Link terkirim!",
    "verify.done": "Email kamu sudah terverifikasi. Makasih!",
    "verify.failed": "Gagal mengirim link. Coba lagi.",
  },
} as const;

export type TranslationKey = keyof (typeof translations)["en"];

type Vars = Record<string, string | number>;

interface I18nValue {
  lang: Lang;
  setLang: (lang: Lang) => void;
  t: (key: TranslationKey, vars?: Vars) => string;
  locale: string;
}

const I18nContext = createContext<I18nValue | null>(null);

function initialLang(): Lang {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored === "en" || stored === "id") return stored;
  } catch {
    // storage unavailable
  }
  return "en";
}

export function I18nProvider({ children }: { children: ReactNode }) {
  const [lang, setLangState] = useState<Lang>(initialLang);

  const setLang = useCallback((next: Lang) => {
    setLangState(next);
    try {
      localStorage.setItem(STORAGE_KEY, next);
    } catch {
      // storage unavailable
    }
  }, []);

  const t = useCallback(
    (key: TranslationKey, vars?: Vars) => {
      let text: string = translations[lang][key] ?? translations.en[key] ?? key;
      if (vars) {
        for (const [k, v] of Object.entries(vars)) {
          text = text.split(`{${k}}`).join(String(v));
        }
      }
      return text;
    },
    [lang]
  );

  const value = useMemo<I18nValue>(
    () => ({ lang, setLang, t, locale: lang === "id" ? "id-ID" : "en-US" }),
    [lang, setLang, t]
  );

  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>;
}

export function useI18n(): I18nValue {
  const ctx = useContext(I18nContext);
  if (!ctx) throw new Error("useI18n must be used inside <I18nProvider>");
  return ctx;
}
