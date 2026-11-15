import SwiftUI
import UserNotifications

@main
struct FreeTalkApp: App {
    var body: some Scene {
        WindowGroup { QuestionView() }
    }
}

struct QuestionView: View {
    @Environment(\.scenePhase) private var scenePhase
    @AppStorage("remindersEnabled") private var remindersEnabled = false
    @State private var openedSlot: Date?
    @State private var reminderMessage = ""

    var body: some View {
        NavigationStack {
            ScrollView {
                TimelineView(.everyMinute) { context in
                    let slot = PromptSchedule.current(at: openedSlot ?? context.date)
                    VStack(alignment: .leading, spacing: 12) {
                        Text(slot.prompt.ja)
                            .font(.title.bold())
                            .environment(\.locale, Locale(identifier: "ja"))
                        Text(slot.prompt.vi)
                            .font(.subheadline)
                            .foregroundStyle(.secondary)
                        Text(slot.date, format: .dateTime.hour().minute().day().month().year())
                            .font(.caption.monospacedDigit())
                            .foregroundStyle(.secondary)
                    }
                    .frame(maxWidth: .infinity, alignment: .leading)
                    .padding(20)
                    .background(.background, in: RoundedRectangle(cornerRadius: 14))
                    .padding()
                }
                if openedSlot != nil {
                    Button("Về câu hiện tại") { openedSlot = nil }
                }
                Toggle("Thông báo luyện nói", isOn: $remindersEnabled)
                    .padding()
                if !reminderMessage.isEmpty {
                    Text(reminderMessage)
                        .font(.footnote)
                        .foregroundStyle(.secondary)
                        .padding(.horizontal)
                }
            }
            .background(Color(uiColor: .systemGroupedBackground))
            .navigationTitle("FreeTalk 日本語")
        }
        .onOpenURL { url in
            guard url.scheme == "freetalk-jp", url.host == "question",
                  let parts = URLComponents(url: url, resolvingAgainstBaseURL: false),
                  let value = parts.queryItems?.first(where: { $0.name == "slot" })?.value,
                  let seconds = Double(value), seconds.isFinite,
                  abs(seconds - Date().timeIntervalSince1970) < 31 * 86400 else { return }
            openedSlot = Date(timeIntervalSince1970: seconds)
        }
        .task(id: remindersEnabled) {
            if remindersEnabled {
                await refreshReminders(askPermission: true)
            } else {
                UNUserNotificationCenter.current().removeAllPendingNotificationRequests()
                reminderMessage = ""
            }
        }
        .onChange(of: scenePhase) { _, phase in
            if phase == .active && remindersEnabled {
                Task { await refreshReminders(askPermission: false) }
            }
        }
    }

    @MainActor
    private func refreshReminders(askPermission: Bool) async {
        let center = UNUserNotificationCenter.current()
        do {
            let settings = await center.notificationSettings()
            if settings.authorizationStatus == .notDetermined && askPermission {
                guard try await center.requestAuthorization(options: [.alert, .sound]) else {
                    remindersEnabled = false
                    return
                }
            } else if settings.authorizationStatus != .authorized && settings.authorizationStatus != .provisional {
                if settings.authorizationStatus == .denied {
                    reminderMessage = "Bạn có thể cấp quyền thông báo trong Cài đặt iPhone."
                }
                return
            }
            guard remindersEnabled, !Task.isCancelled else { return }
            let calendar = Calendar.current
            let slots = PromptSchedule.future(after: Date(), days: 8, calendar: calendar)
            for slot in slots {
                guard remindersEnabled, !Task.isCancelled else { return }
                let content = UNMutableNotificationContent()
                content.title = slot.prompt.ja
                content.body = slot.prompt.vi
                content.sound = UNNotificationSound(named: UNNotificationSoundName(rawValue: "lets_talk.wav"))
                let date = calendar.dateComponents([.year, .month, .day, .hour, .minute], from: slot.date)
                let trigger = UNCalendarNotificationTrigger(dateMatching: date, repeats: false)
                try await center.add(UNNotificationRequest(
                    identifier: "practice-\(Int(slot.date.timeIntervalSince1970))",
                    content: content, trigger: trigger))
            }
            reminderMessage = "Đã lên lịch nhắc cho tuần tới. Mở lại app để gia hạn lịch."
        } catch {
            reminderMessage = "Chưa lên lịch nhắc được. Bạn có thể thử bật lại."
        }
    }
}
