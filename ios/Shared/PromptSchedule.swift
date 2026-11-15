import Foundation

struct Prompt: Codable {
    let id: String
    let ja: String
    let vi: String
}

struct PromptSlot: Codable {
    let slot: String
    let question: Prompt

    var date: Date { ISO8601DateFormatter().date(from: slot) ?? .distantFuture }
}

struct DiscussionFeed: Decodable {
    let entries: [PromptSlot]
    let validUntil: String

    var expiration: Date { ISO8601DateFormatter().date(from: validUntil) ?? .distantPast }

    func current(at date: Date) -> PromptSlot? { entries.last { $0.date <= date } }
}

enum PromptSchedule {
    static let cacheKey = "discussion.schedule.v1"

    static var cached: Data? { UserDefaults.standard.data(forKey: cacheKey) }

    static func decode(_ data: Data?) -> DiscussionFeed? {
        guard let data else { return nil }
        return try? JSONDecoder().decode(DiscussionFeed.self, from: data)
    }

    static func sync() async -> Data? {
        guard let file = Bundle.main.url(forResource: "backend-url", withExtension: "txt"),
              let raw = try? String(contentsOf: file, encoding: .utf8),
              let url = URL(string: raw.trimmingCharacters(in: .whitespacesAndNewlines) + "/v1/schedule") else { return cached }
        do {
            let (data, response) = try await URLSession.shared.data(for: URLRequest(url: url, timeoutInterval: 5))
            if (response as? HTTPURLResponse)?.statusCode == 200, data.count < 128_000,
               let feed = decode(data), !feed.entries.isEmpty, feed.expiration > Date() {
                UserDefaults.standard.set(data, forKey: cacheKey)
                return data
            }
        } catch { }
        return cached
    }
}
