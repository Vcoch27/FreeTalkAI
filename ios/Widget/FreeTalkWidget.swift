import SwiftUI
import WidgetKit

struct QuestionEntry: TimelineEntry {
    let date: Date
    let slot: PromptSlot
}

struct QuestionProvider: TimelineProvider {
    func placeholder(in context: Context) -> QuestionEntry {
        let now = Date()
        return QuestionEntry(date: now, slot: PromptSchedule.current(at: now))
    }

    func getSnapshot(in context: Context, completion: @escaping (QuestionEntry) -> Void) {
        completion(placeholder(in: context))
    }

    func getTimeline(in context: Context, completion: @escaping (Timeline<QuestionEntry>) -> Void) {
        let now = Date()
        let entries = [placeholder(in: context)] + PromptSchedule.future(after: now, days: 4)
            .map { QuestionEntry(date: $0.date, slot: $0) }
        completion(Timeline(entries: entries, policy: .atEnd))
    }
}

@main
struct FreeTalkWidget: Widget {
    var body: some WidgetConfiguration {
        StaticConfiguration(kind: "FreeTalkQuestion", provider: QuestionProvider()) { entry in
            VStack(alignment: .leading, spacing: 5) {
                Text(entry.slot.prompt.ja)
                    .font(.system(.headline, design: .default, weight: .bold))
                    .foregroundStyle(.primary)
                    .lineLimit(4)
                Text(entry.slot.prompt.vi)
                    .font(.caption2)
                    .foregroundStyle(.secondary)
                    .lineLimit(2)
                Spacer(minLength: 0)
                Text(entry.slot.date, format: .dateTime.hour().minute().day().month())
                    .font(.caption2.monospacedDigit())
                    .foregroundStyle(.secondary)
            }
            .frame(maxWidth: .infinity, maxHeight: .infinity, alignment: .leading)
            .widgetURL(entry.slot.link)
            .containerBackground(.fill.tertiary, for: .widget)
        }
        .configurationDisplayName("FreeTalk 日本語")
        .description("Câu luyện nói tiếng Nhật và bản dịch tiếng Việt.")
        .supportedFamilies([.systemSmall, .systemMedium])
    }
}
