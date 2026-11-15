import Foundation

struct Prompt: Codable {
    let id: String
    let ja: String
    let vi: String
}

struct PromptSlot {
    let date: Date
    let prompt: Prompt

    var link: URL? {
        var components = URLComponents()
        components.scheme = "freetalk-jp"
        components.host = "question"
        components.queryItems = [URLQueryItem(name: "slot", value: String(date.timeIntervalSince1970))]
        return components.url
    }
}

enum PromptSchedule {
    private static let catalog: [Prompt] = {
        guard let url = Bundle.main.url(forResource: "questions", withExtension: "json"),
              let data = try? Data(contentsOf: url),
              let decoded = try? JSONDecoder().decode([Prompt].self, from: data),
              !decoded.isEmpty else {
            return [Prompt(id: "fallback", ja: "今日はどんな一日でしたか？", vi: "Hôm nay của bạn thế nào?")]
        }
        return decoded
    }()

    static func current(at now: Date, calendar: Calendar = .current) -> PromptSlot {
        let day = calendar.startOfDay(for: now)
        return slots(on: day, calendar: calendar).last { $0.date <= now }
            ?? slots(on: calendar.date(byAdding: .day, value: -1, to: day) ?? day, calendar: calendar).last!
    }

    static func future(after now: Date, days: Int, calendar: Calendar = .current) -> [PromptSlot] {
        let today = calendar.startOfDay(for: now)
        return (0..<days).compactMap { calendar.date(byAdding: .day, value: $0, to: today) }
            .flatMap { slots(on: $0, calendar: calendar) }
            .filter { $0.date > now }
    }

    private static func slots(on day: Date, calendar: Calendar) -> [PromptSlot] {
        // Use the local civil date as the rotation index, including on DST transition days.
        let parts = calendar.dateComponents([.year, .month, .day], from: day)
        var utc = Calendar(identifier: .gregorian)
        utc.timeZone = TimeZone(secondsFromGMT: 0)!
        let date = utc.date(from: parts) ?? day
        let dayNumber = Int(floor(date.timeIntervalSince1970 / 86400))
        return (0..<7).map { index in
            let slot = calendar.date(bySettingHour: 8 + index * 2, minute: 0, second: 0, of: day) ?? day
            let offset = (dayNumber * 7 + index) % catalog.count
            return PromptSlot(date: slot, prompt: catalog[(offset + catalog.count) % catalog.count])
        }
    }
}
