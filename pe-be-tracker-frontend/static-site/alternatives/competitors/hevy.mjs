export default {
  slug: "hevy",
  name: "Hevy",
  published: "2026-09-30",
  modified: "2026-09-30",
  verified: "2026-09-30",
  sources: [{ label: "Hevy's in-app plan selection screen" }],
  seo: {
    title: "Best Free Hevy Alternative: PersonalBestie vs Hevy (2026 Comparison)",
    ogTitle: "Best Free Hevy Alternative: PersonalBestie vs Hevy",
    description:
      "Looking for a Hevy alternative? Compare PersonalBestie vs Hevy: unlimited free routines, instant guest workout logging, and AI coaching recaps without paywalls.",
    headline: "Best Free Hevy Alternative: PersonalBestie vs Hevy",
    articleDescription:
      "A comprehensive comparison between PersonalBestie and Hevy for lifters looking for unlimited routines, local-first guest logging, and AI coaching.",
  },
  indexBlurb:
    "Hevy caps free accounts at 4 routines. See how PersonalBestie compares on routines, guest logging, AI recaps, and price.",
  llmsSummary:
    "in-depth breakdown comparing PersonalBestie to Hevy (unlimited routines, local-first guest logging, AI coaching recaps, and MCP integration)",
  hero: {
    eyebrow: "In-Depth App Comparison · 2026",
    h1: "Looking for a free Hevy alternative without the routine paywall?",
    leadHtml:
      "Hevy is a solid gym logger, but capping free lifters at just <strong>4 routines</strong> and locking core features behind a subscription gets frustrating fast.\n                    <strong>PersonalBestie</strong> gives you unlimited routines, instant guest logging, and intelligent AI coaching recaps—completely free and open source.",
    primaryCta: "Start Workout (Free & Unlimited)",
  },
  verdict: {
    heading: "Why lifters switch from Hevy to PersonalBestie",
    items: [
      { title: "No Routine Caps:", text: "Save 10, 20, or 50 routines. Perfect for PPL splits, deloads, and custom variations." },
      { title: "AI Workout Recaps:", text: "Automated, grounded coaching insights and PR detection after every finished session, for signed-in users." },
      { title: "Custom Exercises & Activities:", text: "Add your own exercises and activities, including cardio and bouldering, and keep them in the same workout log." },
      { title: "Instant Guest Mode:", text: "Start logging on the gym floor in seconds without mandatory registration." },
      { title: "Open Source & Extensible:", text: "Connect your training data to Claude or ChatGPT via Model Context Protocol (MCP)." },
    ],
  },
  table: {
    heading: "Feature breakdown: PersonalBestie vs Hevy",
    intro: "An honest look at how both trackers compare for strength athletes and everyday gym goers.",
    columns: ["Hevy (Free Tier)", "Hevy Pro (from $2.99/mo)"],
    rows: [
      {
        feature: "Saved Routine Templates",
        cells: [
          { kind: "check", text: "Unlimited (Free)" },
          { kind: "cross", text: "4 Routines Max" },
          { kind: "check", text: "Unlimited" },
        ],
      },
      {
        feature: "Start Logging Friction",
        cells: [
          { kind: "check", text: "Instant Guest Mode" },
          { kind: "cross", text: "Sign-up mandatory" },
          { kind: "cross", text: "Sign-up mandatory" },
        ],
      },
      {
        feature: "Automated AI Coaching Recap",
        cells: [
          { kind: "check", text: "Yes, for signed-in users (Gemini-powered)" },
          { kind: "cross", text: "None" },
          { kind: "cross", text: "None" },
        ],
      },
      {
        feature: "PR & Progressive Overload Tracking",
        cells: [
          { kind: "check", text: "Included Free" },
          { kind: "neutral", text: "Basic stats" },
          { kind: "check", text: "Advanced charts" },
        ],
      },
      {
        feature: "Web App & Cross-Device Access",
        cells: [
          { kind: "check", text: "Responsive Web + PWA" },
          { kind: "neutral", text: "Limited web view" },
          { kind: "check", text: "Web App" },
        ],
      },
      {
        feature: "Extensibility & AI Integration",
        cells: [
          { kind: "check", text: "Model Context Protocol (MCP)" },
          { kind: "cross", text: "No API access" },
          { kind: "neutral", text: "Public API (Pro); no native MCP" },
        ],
      },
      {
        feature: "Routine Sharing Via Web Link",
        cells: [
          { kind: "check", text: "One-click cloneable links" },
          { kind: "neutral", text: "Shareable web links" },
          { kind: "neutral", text: "Shareable web links" },
        ],
      },
      {
        feature: "Social Community Feed",
        cells: [
          { kind: "neutral", text: "Focused on personal training" },
          { kind: "check", text: "Active social feed" },
          { kind: "check", text: "Active social feed" },
        ],
      },
      {
        feature: "Apple Watch Standalone App",
        cells: [
          { kind: "neutral", text: "Mobile PWA / Browser" },
          { kind: "check", text: "Native Watch App" },
          { kind: "check", text: "Native Watch App" },
        ],
      },
      {
        feature: "Pricing",
        cells: [
          { kind: "highlight", text: "100% Free & Open Source" },
          { kind: "plain", text: "Free (limited)" },
          { kind: "plain", text: "$2.99/mo, $23.99/yr, or $74.99 lifetime" },
        ],
      },
    ],
  },
  reasons: {
    heading: "5 Reasons lifters prefer PersonalBestie",
    items: [
      {
        title: "No 4-routine paywall",
        body: "Most effective strength programs (Push/Pull/Legs, Upper/Lower, Candito 6-week, 5/3/1) require 4 to 6 distinct workout templates. With Hevy's free tier, you're constantly forced to delete routines or pay a yearly subscription just to manage your training schedule. PersonalBestie gives you unlimited routine creation out of the box.",
      },
      {
        title: "Grounded AI workout recaps",
        body: 'Logging sets is only half the battle; knowing what to do next time is what drives progressive overload. When a signed-in user completes a workout in PersonalBestie, an automated AI recap highlights new PRs, total tonnage changes, and analyzes your notes (e.g. "felt shoulder twinge on set 3") to provide practical, grounded coaching feedback.',
      },
      {
        title: "Zero-friction guest logging",
        body: "You shouldn't have to fill out an onboarding survey or give up your email address while standing next to the squat rack. PersonalBestie runs locally in your browser with IndexedDB storage. You can log exercises, track weights, and view progression as a guest immediately. When you're ready, one-click Google Sign-in seamlessly syncs your existing data.",
      },
      {
        title: "Custom exercises beyond lifting",
        body: "Your training does not have to fit a fixed exercise library. Create your own exercises and activities, including cardio and bouldering, and include them in your routines and workout log alongside strength training. Use notes to add context about the session.",
      },
      {
        title: "Connect your own AI with MCP",
        body: "Unlike apps with no native AI integration, PersonalBestie exposes Model Context Protocol (MCP) endpoints. You can connect Claude Desktop or custom AI assistants directly to your workout history, analyze long-term trends in natural language, or generate custom training blocks based on your real logs.",
      },
    ],
  },
  fair: {
    heading: "When does Hevy still make sense?",
    intro:
      "We believe in honest comparisons. Hevy is an excellent application, and there are situations where it might still be the better choice for you:",
    items: [
      {
        title: "You want an Instagram-like social feed:",
        body: 'If your primary workout motivation comes from scrolling through friends\' workouts, giving "fists" (likes), and posting gym selfies to an in-app community, Hevy has an active social network built-in. PersonalBestie is built for focused training without social media clutter.',
      },
      {
        title: "You rely on a standalone Apple Watch app:",
        body: "If you leave your phone in the locker and log every set directly from an Apple Watch or WearOS device, Hevy's native wearable app is well-developed. PersonalBestie is currently phone and desktop-first via a responsive PWA.",
      },
    ],
  },
  faq: [
    {
      q: "How do I switch from Hevy to PersonalBestie?",
      a: "Switching takes under two minutes. You can open PersonalBestie, head over to the Routines tab, and recreate your training split with our fast exercise search. You can also paste your workout notes directly into the AI chat, and PersonalBestie will automatically parse and save the routine for you.",
    },
    {
      q: "Is PersonalBestie really free without hidden paywalls?",
      a: "Yes. PersonalBestie is an open-source project. Unlimited routines, workout history, PR tracking, and routine sharing are free. There is no trial period or arbitrary cap on how many routines you can save.",
    },
    {
      q: "Does PersonalBestie work offline in the gym?",
      a: "Yes. In guest mode, all your training data is stored directly in your browser's IndexedDB storage. You don't need a reliable gym Wi-Fi or cellular connection to log your exercises, check weights, or view routine templates.",
    },
    {
      q: "Can I share my routines with training partners?",
      a: "Yes. Every routine created in PersonalBestie has a shareable link. Your training partner can click the link and instantly inspect your sets, reps, and exercises, or clone it into their own account with a single click.",
    },
  ],
  cta: {
    label: "Ready for a cleaner workout logger?",
    heading: "Start tracking your training without routine caps.",
    body: "Join lifters who want fast, unrestricted workout logging and grounded AI coaching insights.",
  },
};
