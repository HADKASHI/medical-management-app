# Is PWA web push on iPhone good enough for reminders?

Research for issue #3. Researched 2026-10-22. Current shipping release at that date: **iOS 27 / Safari 27.0** (released 2026-09-17).

## Verdict

**PWA web push is good enough for v1 of a single-user reminder app on iPhone. It does not force a move to native (Expo).** The main cost is UX: iOS web notifications **cannot show action buttons** ("Taken" / "Snooze"). Tapping the notification has to open the app on a screen where confirming takes one tap.

Move to native only if one of these becomes a hard requirement:
- reply-from-the-lock-screen action buttons
- reminders that fire offline, scheduled on the device
- iOS "Time Sensitive" interruption level that breaks through Focus

## Key facts

### Platform requirements

| Fact | Source |
|---|---|
| Web Push on iPhone/iPad needs iOS/iPadOS **16.4+** and works **only for web apps added to the Home Screen**. A Safari tab cannot receive push. | [WebKit: Web Push for Web Apps on iOS and iPadOS](https://webkit.org/blog/13878/web-push-for-web-apps-on-ios-and-ipados/); [MDN BCD `PushManager`](https://github.com/mdn/browser-compat-data/blob/main/api/PushManager.json) (safari_ios 16.4, "supported in web apps saved to the home screen") |
| Since **Safari 26 (iOS 26)**, every site added to the Home Screen opens as a web app by default, even without a manifest. A manifest (`display: standalone`, `id`, icons) is still recommended. | [WebKit Features in Safari 26.0](https://webkit.org/blog/17333/webkit-features-in-safari-26-0/) |
| The permission request **must come from a user gesture**, such as tapping an "Enable reminders" button. Call `pushManager.subscribe` straight from that handler. | [Apple: Sending web push notifications in web apps and browsers](https://developer.apple.com/documentation/usernotifications/sending-web-push-notifications-in-web-apps-and-browsers); WebKit 16.4 post |
| **No silent/invisible push.** Every push must show a notification immediately. If it doesn't, Safari revokes the push permission. Use `userVisibleOnly: true`. | Apple doc above |
| No Apple Developer Program membership needed. Delivery goes through APNs, so allow `https://*.push.apple.com` outbound. | Apple doc; WebKit 16.4 post |
| Notifications appear on the Lock Screen, in Notification Center and on a paired Apple Watch. They follow **Focus modes**. The user can allow the app in a Focus, but the web app cannot override Focus. | WebKit 16.4 post |
| The Badging API (`navigator.setAppBadge`) works for Home Screen web apps, including from the push handler. It can show a count of pending doses. | WebKit 16.4 post; Apple doc |
| Safari 26.x and 27.0 release notes contain **no changes** to web push or notification options. The 2023–2025 feature set still applies on iOS 27. | [Safari 26.6](https://webkit.org/blog/18178/webkit-features-for-safari-26-6/); [Safari 27.0](https://webkit.org/blog/18325/webkit-features-for-safari-27-0/) (only a URL-parser fix on `Notification`) |

### Notification options on iOS: action buttons are not supported

From MDN browser-compat-data ([Notification.json](https://github.com/mdn/browser-compat-data/blob/main/api/Notification.json), [ServiceWorkerRegistration.json](https://github.com/mdn/browser-compat-data/blob/main/api/ServiceWorkerRegistration.json)), Safari and Safari iOS have:

| Option | Safari iOS |
|---|---|
| `showNotification()` from a service worker | yes (16.4+, Home Screen only; `new Notification()` in a page is not supported) |
| **`actions` / `Notification.maxActions`** | **not supported** |
| `requireInteraction` | not supported (the notification doesn't stay on screen) |
| `tag` (replace a previous notification) | not supported (WebKit bug [258922](https://bugs.webkit.org/show_bug.cgi?id=258922)) |
| `silent`, `badge`, `image`, `vibrate`, `renotify`, `timestamp` | not supported |
| `title`, `body`, `icon`, `data`, `notificationclick` | supported |

A developer on the [Apple Developer Forums](https://developer.apple.com/forums/thread/726793) confirmed that custom actions are ignored on iOS. Only the default "open" behavior happens.

**Closest UX:** put the reminder's ID in `data`, or in the `navigate` URL for a declarative push (see below). On `notificationclick`, open a deep link such as `/reminders/<id>`. That screen shows large **Taken** and **Snooze 15 min** buttons. This makes the flow two taps (notification, then button) instead of one, and it always opens the app.

### Declarative Web Push (iOS 18.4+)

- WebKit's [Declarative Web Push](https://webkit.org/blog/16535/meet-declarative-web-push/) lets the server send a JSON payload that iOS shows **without running a service worker**. Payload shape: `{"web_push": 8030, "notification": {"title", "body", "navigate", ...}, "app_badge": "1"}`.
- It is more reliable: the notification still shows if the service worker was evicted or its JS throws, and no "silent push penalty" applies. An optional service worker `push` handler can still modify the notification.
- It does **not** add action buttons. `navigate` is the URL opened when the user taps the notification. That fits the deep-link approach above.
- **Recommendation:** send declarative payloads (iOS 18.4+ is fine for a personal iPhone) and keep a small service worker handler as an enhancement.

### Scheduling: the server must send at the due time

- The web has **no local or scheduled notifications on iOS**. Notification Triggers never shipped in Safari. Every reminder has to be a push the **backend sends at the due time**.
- The backend needs:
  1. **VAPID key pair.** The public key is passed to `pushManager.subscribe({ userVisibleOnly: true, applicationServerKey })`. Each request carries a VAPID JWT with `aud` set to the push service origin, `sub` set to a `mailto:` or URL, and an expiry of **24 h or less**. Don't regenerate the JWT more than once an hour. ([Apple doc](https://developer.apple.com/documentation/usernotifications/sending-web-push-notifications-in-web-apps-and-browsers); RFC 8292)
  2. **Store the `PushSubscription`** (endpoint plus `p256dh` and `auth` keys). Payloads are encrypted per RFC 8291 (`aes128gcm`), with a maximum of **4 KB**. Any standard library handles this, e.g. `web-push` for Node.
  3. **A scheduler** (a cron job every minute, or a job queue with delayed jobs) that finds due reminders and POSTs to the endpoint. Set `Urgency: high`. Set a **short `TTL`** (e.g. 1–2 h for a dose, so a stale dose alert isn't delivered the next day; APNs stores messages for up to 30 days otherwise). Use `Topic` to coalesce repeats.
  4. **Subscription lifecycle:** a `410` response means the subscription has expired. Delete it and ask the user to re-enable (Apple doc, response codes). Re-subscribe on app open if `pushManager.getSubscription()` returns null. Expect a new subscription after the app is removed and re-added to the Home Screen, or after permission is revoked.
  5. **Escalation instead of `requireInteraction`:** if a dose isn't marked Taken within N minutes, the server sends a follow-up push. Track acknowledgment in the DB.
- Hosting implication: the backend needs a **reliable always-on scheduler**. A free tier that sleeps when idle would delay reminders.

## Risks and limits to accept

- **Best-effort delivery.** APNs, Focus, Low Power Mode and the user's notification settings can delay or silence a reminder. This applies to native apps too, apart from Time Sensitive and Critical alerts.
- **Fragile install state.** Deleting the Home Screen icon or clearing website data drops the subscription. Show a "Reminders active ✓ / off" status in the app and monitor 410s on the server.
- **No offline scheduling.** Reminders depend on the phone having connectivity near the due time.
- **No action buttons, no `tag` replacement, no persistent notifications** (see table).

## What native (Expo) would add

Background knowledge (Apple UserNotifications framework), not re-verified in this pass:

- Actionable notifications (`UNNotificationCategory` actions) that call the backend without opening the app.
- Local scheduled notifications that work offline.
- The `timeSensitive` interruption level, which can break through Focus with user consent. Critical alerts need a special Apple entitlement, which a personal app is unlikely to get.
- Costs: an Apple Developer Program membership for TestFlight / App Store distribution, plus a second codebase or build pipeline.

## Sources

- WebKit — Web Push for Web Apps on iOS and iPadOS (2023): https://webkit.org/blog/13878/web-push-for-web-apps-on-ios-and-ipados/
- WebKit — Meet Declarative Web Push (2025): https://webkit.org/blog/16535/meet-declarative-web-push/
- WebKit — Features in Safari 26.0: https://webkit.org/blog/17333/webkit-features-in-safari-26-0/
- WebKit — Features for Safari 26.6: https://webkit.org/blog/18178/webkit-features-for-safari-26-6/
- WebKit — Features for Safari 27.0: https://webkit.org/blog/18325/webkit-features-for-safari-27-0/
- Apple — Sending web push notifications in web apps and browsers: https://developer.apple.com/documentation/usernotifications/sending-web-push-notifications-in-web-apps-and-browsers
- MDN browser-compat-data — Notification, ServiceWorkerRegistration, PushManager: https://github.com/mdn/browser-compat-data/tree/main/api
- WebKit bug 258922 (Notification `tag` not supported): https://bugs.webkit.org/show_bug.cgi?id=258922
- Apple Developer Forums — actions ignored on iOS 16.4: https://developer.apple.com/forums/thread/726793
- RFC 8030 (Web Push), RFC 8291 (message encryption), RFC 8292 (VAPID)
