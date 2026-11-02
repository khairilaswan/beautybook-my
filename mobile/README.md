# BeautyBook mobile app (iOS and Android)

The BeautyBook phone app, built with Expo (SDK 58, React Native, Expo Router).
It talks to the same Supabase project as the website and uses the website's
`/api/mobile/*` routes for the steps that must run on a server.

## What's in the app

For customers (in English, Bahasa Melayu and 中文):

- Home: search, near me, open now, recent searches, services, cities, deals, shopping malls.
- Explore: search with filters (service, area and neighbourhood, distance, mall, men or women, open now or late, price, sort, "good to know" tags).
- Shop page: photos, video, menu and prices, deals, packages, team, portfolio, reviews, hours, closures, map directions, call, share, loyalty card, gift vouchers and claim links.
- Booking on WhatsApp (request mode) or instant booking with live free slots, quote requests for bridal and event packages.
- Saved shops with private notes, account page (bookings, quotes, book again, loyalty, points, vouchers, profile, language), reviews of completed visits.
- Delete account inside the app (required by Apple and Google).

For shop owners (in English, like the website's owner dashboard):

- 30-day stats, booking requests (confirm, decline, completed, no-show), quote requests, review replies.
- Edit shop profile, menu and prices, opening hours and closures, and photos.
- Everything else (deals, packages, team, portfolio, instant-booking settings, loyalty, vouchers, themes) opens the full dashboard on the website.

Members-only works as on the website: someone who signs in waits on a "pending" screen
until an admin approves them in `/admin/members`. When `SITE_ACCESS=public` is set on
Vercel, the app opens to everyone too (it reads this from `/api/mobile/config`).

Sign-in options follow the website: Google today. Facebook and phone codes stay hidden
until they are set up in Supabase, the same as on the website. Email sign-in links and
email + password also work (the password is mainly for the App Store review account).
Sign in with Apple shows on iPhone once the Apple provider is on in Supabase.

## Run it on your phone (Expo Go)

```bash
cd mobile
npm install
npx expo start
```

Scan the QR code with the Camera app (iPhone) or the Expo Go app (Android). The app
uses the live BeautyBook Supabase project by default; copy `.env.example` to `.env`
to point it somewhere else.

`EXPO_PUBLIC_SITE_URL` decides which website the app calls for bookings, quotes and
account deletion. Until this branch is merged, set it to the Vercel preview URL of the
pull request, because beautybook.my doesn't have the `/api/mobile` routes yet.

## One-time setup in Supabase (Authentication)

1. **URL configuration → Redirect URLs**: add `beautybook://**` (the store app) and
   `exp://**` (Expo Go while testing). Without these, Google and email sign-in from the
   app return to the website instead of the app.
2. **Sign in with Apple** (Apple requires it in an iPhone app that offers Google sign-in):
   in the Apple Developer site create a Services ID and a key for Sign in with Apple, then
   in Supabase → Sign In / Providers → Apple, switch it on and add `my.beautybook.app`
   to "Client IDs" (plus the Services ID if you also want it on the website).
3. **Email template (Magic link)**: optional. If you add `{{ .Token }}` to the template,
   people can type the 6-digit code into the app instead of tapping the link.

## Store review account

Apple and Google need a working login to review a members-only app:

1. In Supabase → Authentication → Users → Add user, create e.g. `appreview@beautybook.my`
   with a password and "Auto confirm" ticked.
2. Approve that account in `/admin/members` on the website.
3. Give the email and password in App Store Connect (App Review Information) and in Google
   Play Console (App content → App access). In the app, type the email, then tap
   "Sign in with a password instead".

## Build and publish

You need:

- An **Apple Developer Program** membership (USD 99 a year): https://developer.apple.com/programs/
- A **Google Play Console** developer account (USD 25 once): https://play.google.com/console/signup
- A free **Expo** account: https://expo.dev/signup

Then, from the `mobile` folder:

```bash
npm install -g eas-cli
eas login
eas init                       # links the project to your Expo account (adds the project id to app.json)
eas build --platform all --profile production
eas submit --platform ios      # uploads to App Store Connect / TestFlight
eas submit --platform android  # uploads to Google Play (the first upload can also be done by hand)
```

EAS creates and stores the iOS certificates and the Android signing key for you; answer
"yes" when it offers. `eas build --profile preview` makes an Android APK and an iOS
internal build to share with testers before going to the stores.

The app ids are `my.beautybook.app` on both stores.

### Store listing checklist

- Name: BeautyBook. Category: Lifestyle (or Health & Fitness → Beauty on Google Play).
- Privacy policy URL: https://beautybook.my/privacy. Support URL: https://beautybook.my
- Data the app collects (for Apple's privacy labels and Google's data safety form): name,
  email, phone number, approximate and precise location (only while searching "near me",
  not stored), photos (shop owners only), booking requests, reviews. Nothing is sold or used
  for tracking or ads. Account deletion: in the app (Account → Delete account).
- Screenshots: 6.9" and 6.5" iPhone, and phone screenshots for Google Play.
- Age rating: 4+ / Everyone.

### Releasing updates

- Bump `version` in `app.json` for each store release (build numbers go up by themselves).
- To make everyone update after a breaking change, set `MOBILE_MIN_VERSION` (e.g. `1.1.0`)
  on Vercel. Older apps then show an "update the app" screen.

## Checks

```bash
npm run lint
npm run typecheck
```

CI runs both on every pull request (`.github/workflows/ci.yml`, job `mobile`).

## Where things are

- `src/app/`: screens (Expo Router). `(tabs)` holds Home, Explore, Saved and Account.
- `src/lib/auth.tsx`: session, members-only status and app settings from `/api/mobile/config`.
- `src/lib/data.ts`: directory reads (same queries as the website).
- `src/lib/api.ts`: calls to the website's `/api/mobile/*` routes.
- `src/lib/i18n/`: the app's English, Malay and Chinese text.
- Website side: `src/app/api/mobile/*` and `src/lib/mobile-api.ts` in the repo root.
