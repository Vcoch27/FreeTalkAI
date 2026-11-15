import SwiftUI
import UIKit
import UserNotifications
import WebKit
import WidgetKit

@main
struct FreeTalkApp: App {
    @UIApplicationDelegateAdaptor(NotificationsDelegate.self) private var delegate
    @Environment(\.scenePhase) private var phase

    @State private var widgetLink: WidgetLinkRequest?

    var body: some Scene {
        WindowGroup {
            FreeTalkWebView(active: phase == .active, widgetLink: widgetLink)
                .onOpenURL { widgetLink = WidgetLinkRequest(url: $0) }
        }
    }
}

final class NotificationsDelegate: NSObject, UIApplicationDelegate, UNUserNotificationCenterDelegate {
    func application(_ application: UIApplication, didFinishLaunchingWithOptions options: [UIApplication.LaunchOptionsKey: Any]? = nil) -> Bool {
        UNUserNotificationCenter.current().delegate = self
        return true
    }

    func userNotificationCenter(_ center: UNUserNotificationCenter, willPresent notification: UNNotification,
                                withCompletionHandler completionHandler: @escaping (UNNotificationPresentationOptions) -> Void) {
        completionHandler([.banner, .sound])
    }
}

struct WidgetLinkRequest {
    let url: URL
    let id = UUID()
}

struct FreeTalkWebView: UIViewRepresentable {
    let active: Bool
    let widgetLink: WidgetLinkRequest?

    func makeCoordinator() -> Coordinator { Coordinator() }

    func makeUIView(context: Context) -> WKWebView {
        context.coordinator.makeView()
    }

    func updateUIView(_ view: WKWebView, context: Context) {
        context.coordinator.openWidgetLink(widgetLink)
        context.coordinator.update(active: active)
    }

    @MainActor
    final class Coordinator: NSObject, WKNavigationDelegate, WKScriptMessageHandler {
        private weak var web: WKWebView?
        private var active = false
        private var lastWidgetLink: UUID?
        private var linkedSlot: String?
        private var linkedID: String?
        private var syncTask: Task<Void, Never>?
        private var reminderTask: Task<Void, Never>?
        private let defaults = UserDefaults.standard
        private let center = UNUserNotificationCenter.current()

        private var preferences: [String: Any] {
            ["translation": defaults.object(forKey: "translation") as? Bool ?? true,
             "enabled": defaults.bool(forKey: "remindersEnabled"),
             "start": defaults.string(forKey: "reminderStart") ?? "08:00",
             "end": defaults.string(forKey: "reminderEnd") ?? "22:00"]
        }

        private func json(_ value: Any) -> String {
            guard let data = try? JSONSerialization.data(withJSONObject: value, options: [.fragmentsAllowed]),
                  let result = String(data: data, encoding: .utf8) else { return "null" }
            return result
        }

        private func feedLiteral() -> String {
            guard let data = PromptSchedule.cached, let string = String(data: data, encoding: .utf8) else { return "null" }
            return json(string)
        }

        func makeView() -> WKWebView {
            let configuration = WKWebViewConfiguration()
            configuration.userContentController.add(self, name: "freetalk")
            let source = """
                window.ftPreferences = \(json(preferences));
                window.ftFeed = \(feedLiteral());
                window.FreeTalkIOS = {
                  preferences: () => JSON.stringify(window.ftPreferences),
                  discussionSchedule: () => window.ftFeed,
                  linkedAssignment: () => window.ftLinkedAssignment || "null",
                  dismissLinkedAssignment: () => {
                    window.ftLinkedAssignment = null;
                    window.webkit.messageHandlers.freetalk.postMessage({action:"dismissLink"});
                  },
                  savePreferences: raw => {
                    window.ftPreferences = JSON.parse(raw);
                    window.webkit.messageHandlers.freetalk.postMessage({action:"save", values:window.ftPreferences});
                    return true;
                  },
                  testReminder: () => window.webkit.messageHandlers.freetalk.postMessage({action:"test"})
                };
                """
            configuration.userContentController.addUserScript(WKUserScript(source: source, injectionTime: .atDocumentStart, forMainFrameOnly: true))
            let view = WKWebView(frame: .zero, configuration: configuration)
            view.navigationDelegate = self
            view.isOpaque = false
            web = view
            if let url = Bundle.main.url(forResource: "index", withExtension: "html", subdirectory: "Client") {
                view.loadFileURL(url, allowingReadAccessTo: url.deletingLastPathComponent())
            }
            return view
        }

        func webView(_ webView: WKWebView, decidePolicyFor action: WKNavigationAction,
                     decisionHandler: @escaping (WKNavigationActionPolicy) -> Void) {
            let url = action.request.url
            decisionHandler(url?.isFileURL == true && url?.lastPathComponent == "index.html" ? .allow : .cancel)
        }

        func webView(_ webView: WKWebView, didFinish navigation: WKNavigation!) { updateWeb() }

        func openWidgetLink(_ request: WidgetLinkRequest?) {
            guard let request, request.id != lastWidgetLink,
                  request.url.scheme == "freetalk-jp", request.url.host == "question",
                  let parts = URLComponents(url: request.url, resolvingAgainstBaseURL: false),
                  let slot = parts.queryItems?.first(where: { $0.name == "slot" })?.value,
                  let id = parts.queryItems?.first(where: { $0.name == "id" })?.value,
                  ISO8601DateFormatter().date(from: slot) != nil, id.count <= 100 else { return }
            lastWidgetLink = request.id
            linkedSlot = slot
            linkedID = id
            updateWeb()
        }

        private func linkedAssignmentLiteral() -> String {
            guard let slot = linkedSlot, let id = linkedID, let data = PromptSchedule.cached,
                  let raw = (try? JSONSerialization.jsonObject(with: data)) as? [String: Any],
                  let entries = raw["entries"] as? [[String: Any]],
                  let entry = entries.first(where: {
                      $0["slot"] as? String == slot && ($0["question"] as? [String: Any])?["id"] as? String == id
                  }) else { return "null" }
            return json(json(entry))
        }

        private func updateWeb() {
            web?.evaluateJavaScript("""
                window.ftPreferences = \(json(preferences));
                window.ftFeed = \(feedLiteral());
                window.ftLinkedAssignment = \(linkedAssignmentLiteral());
                window.dispatchEvent(new Event('freetalk-update'));
                """, completionHandler: nil)
        }

        func update(active: Bool) {
            guard self.active != active else { return }
            self.active = active
            syncTask?.cancel()
            if active {
                syncTask = Task {
                    while !Task.isCancelled {
                        _ = await PromptSchedule.sync()
                        guard !Task.isCancelled else { return }
                        updateWeb()
                        updateReminders(askPermission: false)
                        WidgetCenter.shared.reloadTimelines(ofKind: "FreeTalkQuestion")
                        try? await Task.sleep(for: .seconds(900))
                    }
                }
            }
        }

        func userContentController(_ controller: WKUserContentController, didReceive message: WKScriptMessage) {
            guard message.frameInfo.isMainFrame, let command = message.body as? [String: Any] else { return }
            switch command["action"] as? String {
            case "save":
                guard let values = command["values"] as? [String: Any],
                      let translation = values["translation"] as? Bool, let enabled = values["enabled"] as? Bool,
                      let start = values["start"] as? String, let end = values["end"] as? String,
                      validTime(start), validTime(end), start < end else { return }
                defaults.set(translation, forKey: "translation")
                defaults.set(enabled, forKey: "remindersEnabled")
                defaults.set(start, forKey: "reminderStart")
                defaults.set(end, forKey: "reminderEnd")
                updateWeb()
                updateReminders(askPermission: true)
            case "dismissLink":
                linkedSlot = nil
                linkedID = nil
                updateWeb()
            case "test":
                Task {
                    guard await permitted(ask: true),
                          let slot = PromptSchedule.decode(PromptSchedule.cached)?.current(at: .now) else { return }
                    try? await center.add(UNNotificationRequest(identifier: "freetalk-test", content: content(slot),
                        trigger: UNTimeIntervalNotificationTrigger(timeInterval: 1, repeats: false)))
                }
            default: break
            }
        }

        private func validTime(_ value: String) -> Bool {
            value.range(of: "^(?:[01][0-9]|2[0-3]):[0-5][0-9]$", options: .regularExpression) != nil
        }

        private func permitted(ask: Bool) async -> Bool {
            let status = await center.notificationSettings().authorizationStatus
            if status == .notDetermined && ask { return (try? await center.requestAuthorization(options: [.alert, .sound])) == true }
            return status == .authorized || status == .provisional
        }

        private func content(_ slot: PromptSlot) -> UNMutableNotificationContent {
            let item = UNMutableNotificationContent()
            item.title = slot.question.ja
            if preferences["translation"] as? Bool == true { item.body = slot.question.vi }
            item.sound = UNNotificationSound(named: UNNotificationSoundName(rawValue: "lets_talk.wav"))
            return item
        }

        private func updateReminders(askPermission: Bool) {
            reminderTask?.cancel()
            reminderTask = Task {
                let pending = await center.pendingNotificationRequests()
                guard !Task.isCancelled else { return }
                center.removePendingNotificationRequests(withIdentifiers: pending.map(\.identifier).filter { $0.hasPrefix("practice-") })
                guard preferences["enabled"] as? Bool == true, await permitted(ask: askPermission),
                      !Task.isCancelled, let feed = PromptSchedule.decode(PromptSchedule.cached) else { return }
                let now = Date()
                let calendar = Calendar.current
                let format = DateFormatter()
                format.locale = Locale(identifier: "en_US_POSIX")
                format.dateFormat = "HH:mm"
                let start = preferences["start"] as? String ?? "08:00"
                let end = preferences["end"] as? String ?? "22:00"
                for slot in feed.entries where slot.date > now && slot.date < feed.expiration {
                    guard !Task.isCancelled else { return }
                    let time = format.string(from: slot.date)
                    guard time >= start && time < end else { continue }
                    let date = calendar.dateComponents([.timeZone, .year, .month, .day, .hour, .minute], from: slot.date)
                    let trigger = UNCalendarNotificationTrigger(dateMatching: date, repeats: false)
                    try? await center.add(UNNotificationRequest(identifier: "practice-" + slot.slot, content: content(slot), trigger: trigger))
                }
            }
        }
    }
}
