export type Language = "en" | "ar";

export interface TranslationDict {
  nav: {
    tools: string;
    howItWorks: string;
    platforms: string;
    faq: string;
    upgrade: string;
    account: string;
    signIn: string;
    signOut: string;
    installApp: string;
  };
  hero: {
    badge: string;
    headline1: string;
    headlineHighlight: string;
    subheadline: string;
    placeholder: string;
    pasteBtn: string;
    analyzeBtn: string;
    analyzingBtn: string;
    supportedText: string;
  };
  tabs: {
    all: string;
    video: string;
    audio: string;
    image: string;
  };
  playlist: {
    detected: string;
    videosCount: (count: number) => string;
    downloadZip: string;
    downloadItem: string;
    zipping: string;
    zipReady: string;
  };
  progress: {
    downloading: string;
    speed: string;
    remaining: string;
    eta: string;
    completed: string;
    interrupted: string;
    retry: string;
  };
  cards: {
    bestQuality: string;
    original: string;
    downloadBtn: string;
    preparingBtn: string;
    allImagesZip: string;
    copyLink: string;
  };
  pwa: {
    installTitle: string;
    installDesc: string;
    installBtn: string;
    dismiss: string;
  };
}

export const TRANSLATIONS: Record<Language, TranslationDict> = {
  en: {
    nav: {
      tools: "Free Tools",
      howItWorks: "How it works",
      platforms: "Platforms",
      faq: "FAQ",
      upgrade: "Upgrade",
      account: "Account",
      signIn: "Sign in",
      signOut: "Sign out",
      installApp: "Install App",
    },
    hero: {
      badge: "MEDIA, MADE SIMPLE",
      headline1: "Download media,",
      headlineHighlight: "simply",
      subheadline:
        "Paste a public social-media URL and get started in seconds. CBdrop keeps the workflow clear, lightweight, and permission-first.",
      placeholder: "Paste a video, photo, or audio link here...",
      pasteBtn: "Paste",
      analyzeBtn: "Download",
      analyzingBtn: "Analyzing...",
      supportedText: "Supports YouTube, TikTok, Instagram, Facebook, X, and Snapchat.",
    },
    tabs: {
      all: "All Formats",
      video: "Video",
      audio: "Audio",
      image: "Images",
    },
    playlist: {
      detected: "Playlist Detected",
      videosCount: (count: number) => `${count} videos found in this playlist`,
      downloadZip: "Download Entire Playlist (ZIP)",
      downloadItem: "Download",
      zipping: "Creating ZIP Archive...",
      zipReady: "Downloading playlist ZIP file...",
    },
    progress: {
      downloading: "Downloading...",
      speed: "Speed",
      remaining: "Remaining",
      eta: "ETA",
      completed: "Download Complete!",
      interrupted: "Download Interrupted",
      retry: "Retry Download",
    },
    cards: {
      bestQuality: "Best Quality",
      original: "Original",
      downloadBtn: "Download",
      preparingBtn: "Preparing...",
      allImagesZip: "Download All (ZIP)",
      copyLink: "Copy Link",
    },
    pwa: {
      installTitle: "Install CBdrop App",
      installDesc: "Add CBdrop to your home screen for ultra-fast, 1-tap video and playlist downloads.",
      installBtn: "Install App",
      dismiss: "Dismiss",
    },
  },

  ar: {
    nav: {
      tools: "أدوات مجانية",
      howItWorks: "كيف يعمل",
      platforms: "المنصات المدعومة",
      faq: "الأسئلة الشائعة",
      upgrade: "ترقية الحساب",
      account: "حسابي",
      signIn: "تسجيل الدخول",
      signOut: "تسجيل الخروج",
      installApp: "تثبيت التطبيق",
    },
    hero: {
      badge: "الوسائط، بكل بساطة",
      headline1: "تحميل الوسائط،",
      headlineHighlight: "بكل بساطة",
      subheadline:
        "الصق رابط الوسائط من وسائل التواصل الاجتماعي وابدأ في ثوانٍ. يحافظ CBdrop على سير العمل واضحاً وخفيفاً.",
      placeholder: "الصق رابط الفيديو أو الصورة أو الصوت هنا...",
      pasteBtn: "لصق",
      analyzeBtn: "تحميل",
      analyzingBtn: "جارٍ التحليل...",
      supportedText: "يدعم يوتيوب، تيك توك، إنستغرام، فيسبوك، إكس، وسناب شات.",
    },
    tabs: {
      all: "جميع الصيغ",
      video: "فيديو",
      audio: "صوت فقط",
      image: "صور",
    },
    playlist: {
      detected: "تم اكتشاف قائمة تشغيل",
      videosCount: (count: number) => `تم العثور على ${count} مقطع فيديو في هذه القائمة`,
      downloadZip: "تحميل قائمة التشغيل بالكامل (ZIP)",
      downloadItem: "تحميل",
      zipping: "جارٍ تجهيز ملف ZIP المجمع...",
      zipReady: "جارٍ بدء تحميل ملف ZIP...",
    },
    progress: {
      downloading: "جارٍ التنزيل الآن...",
      speed: "السرعة",
      remaining: "المتبقي",
      eta: "الوقت المقدر",
      completed: "اكتمل التحميل بنجاح!",
      interrupted: "انقطع الاتصال بالتحميل",
      retry: "إعادة المحاولة",
    },
    cards: {
      bestQuality: "أعلى جودة",
      original: "الجودة الأصلية",
      downloadBtn: "تحميل",
      preparingBtn: "جارٍ التجهيز...",
      allImagesZip: "تحميل الكل (ZIP)",
      copyLink: "نسخ الرابط",
    },
    pwa: {
      installTitle: "تثبيت تطبيق CBdrop",
      installDesc: "أضف تطبيق CBdrop إلى شاشتك الرئيسية للتحميل الفوري بلمسة واحدة بدون متصفح.",
      installBtn: "تثبيت التطبيق",
      dismiss: "إغلاق",
    },
  },
};
