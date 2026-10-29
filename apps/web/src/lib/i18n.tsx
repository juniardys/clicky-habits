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
    "habit.todayCrossed": "✓ Today crossed off (tap to undo)",
    "habit.crossToday": "✗ Cross Off Today",
    "habit.calendarHint": "Click any date to cross it off / undo.",
    "habit.jarLabel": "Jar {cur}/{total} · {coins}/{cap} coins",
    "habit.prevJar": "Previous jar",
    "habit.nextJar": "Next jar",
    "habit.addCoin": "🪙 Drop a Coin",
    "habit.jarHint":
      "Drag the jar to rotate. One jar holds {cap} coins. When it fills up, you move on to the next jar.",
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
    "login.googleFailed":
      "Google sign-in failed. Make sure GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET are set in .env (project root)",
    "login.signUpFailed": "Sign up failed",
    "login.wrongCreds": "Wrong email or password",
    "login.genericError": "Something went wrong",
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
    "habit.todayCrossed": "✓ Hari ini tercoret (klik untuk batalkan)",
    "habit.crossToday": "✗ Coret Hari Ini",
    "habit.calendarHint": "Klik tanggal mana pun untuk mencoret / membatalkan.",
    "habit.jarLabel": "Toples {cur}/{total} · {coins}/{cap} koin",
    "habit.prevJar": "Toples sebelumnya",
    "habit.nextJar": "Toples berikutnya",
    "habit.addCoin": "🪙 Masukkan Koin",
    "habit.jarHint":
      "Tarik toples untuk memutar. Satu toples muat {cap} koin. Kalau penuh, otomatis lanjut ke toples berikutnya.",
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
    "login.googleFailed":
      "Login Google gagal. Pastikan GOOGLE_CLIENT_ID dan GOOGLE_CLIENT_SECRET sudah diisi di .env (root project)",
    "login.signUpFailed": "Gagal daftar",
    "login.wrongCreds": "Email atau password salah",
    "login.genericError": "Terjadi kesalahan",
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
