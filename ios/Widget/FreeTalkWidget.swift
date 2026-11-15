import SwiftUI
import WidgetKit

struct QuestionEntry: TimelineEntry {
    let date: Date
    let slot: PromptSlot?
}

struct QuestionProvider: TimelineProvider {
    func placeholder(in context: Context) -> QuestionEntry {
        QuestionEntry(date: .now, slot: nil)
    }

    func getSnapshot(in context: Context, completion: @escaping (QuestionEntry) -> Void) {
        let now = Date()
        completion(QuestionEntry(date: now, slot: PromptSchedule.decode(PromptSchedule.cached)?.current(at: now)))
    }

    func getTimeline(in context: Context, completion: @escaping (Timeline<QuestionEntry>) -> Void) {
        Task {
            let data = await PromptSchedule.sync()
            let now = Date()
            let feed = PromptSchedule.decode(data)
            let entries = [QuestionEntry(date: now, slot: feed?.current(at: now))]
                + (feed?.entries ?? []).filter { $0.date > now }.map { QuestionEntry(date: $0.date, slot: $0) }
            let needsSync = feed?.expiration ?? .distantPast
            let reload = needsSync > now ? now.addingTimeInterval(2 * 3600) : now.addingTimeInterval(15 * 60)
            completion(Timeline(entries: entries, policy: .after(reload)))
        }
    }
}

struct QuestionWidgetView: View {
    @Environment(\.widgetFamily) private var family
    let entry: QuestionEntry

    var body: some View {
        VStack(alignment: .leading, spacing: 3) {
            if let slot = entry.slot {
                Text(slot.question.ja)
                    .font(family == .accessoryRectangular ? .caption.bold() : .headline)
                    .lineLimit(family == .accessoryRectangular ? 2 : 4)
                Text(slot.question.vi)
                    .font(.caption2)
                    .foregroundStyle(.secondary)
                    .lineLimit(family == .accessoryRectangular ? 1 : 2)
                if family != .accessoryRectangular {
                    Spacer(minLength: 0)
                    Text(slot.date, format: .dateTime.hour().minute().day().month())
                        .font(.caption2.monospacedDigit())
                        .foregroundStyle(.secondary)
                }
            } else {
                Text("FreeTalk 日本語").font(.headline)
                Text("Mở app để đồng bộ").font(.caption2)
            }
        }
        .frame(maxWidth: .infinity, maxHeight: .infinity, alignment: .leading)
        .containerBackground(.fill.tertiary, for: .widget)
    }
}

@main
struct FreeTalkWidget: Widget {
    var body: some WidgetConfiguration {
        StaticConfiguration(kind: "FreeTalkQuestion", provider: QuestionProvider()) { entry in
            QuestionWidgetView(entry: entry)
        }
        .configurationDisplayName("FreeTalk 日本語")
        .description("Tình huống tiếng Nhật theo lịch chung.")
        .supportedFamilies([.systemSmall, .systemMedium, .accessoryRectangular])
    }
}
