import Foundation
import AppIntents

private let templateCatalogueKey = "AbacusExpenseTemplatesV1"
private let inboxKey = "AbacusExpenseInboxV1"
private let inboxNotification = Notification.Name("AbacusExpenseInboxChanged")

private enum ExpenseInbox {
    static let lock = NSLock()

    static func append(_ url: URL) {
        lock.lock()
        let current = UserDefaults.standard.stringArray(forKey: inboxKey) ?? []
        UserDefaults.standard.set(Array((current + [url.absoluteString]).suffix(5)), forKey: inboxKey)
        lock.unlock()
        NotificationCenter.default.post(name: inboxNotification, object: nil)
    }

    static func consume() -> [String] {
        lock.lock()
        defer { lock.unlock() }
        let current = UserDefaults.standard.stringArray(forKey: inboxKey) ?? []
        UserDefaults.standard.removeObject(forKey: inboxKey)
        return current
    }
}

#if canImport(React)
import React

@objc(AbacusQuickAccess)
class AbacusQuickAccess: RCTEventEmitter {
    private var observer: NSObjectProtocol?

    @objc override static func requiresMainQueueSetup() -> Bool { false }
    override func supportedEvents() -> [String]! { ["AbacusQuickAccessRequest"] }
    override func startObserving() {
        observer = NotificationCenter.default.addObserver(forName: inboxNotification, object: nil, queue: .main) { [weak self] _ in
            self?.sendEvent(withName: "AbacusQuickAccessRequest", body: nil)
        }
    }
    override func stopObserving() {
        if let observer { NotificationCenter.default.removeObserver(observer) }
        observer = nil
    }

    @objc func consumeRequests(_ resolve: RCTPromiseResolveBlock, rejecter reject: RCTPromiseRejectBlock) {
        resolve(ExpenseInbox.consume())
    }

    @objc func setTemplates(_ json: String) {
        guard let data = json.data(using: .utf8),
              let records = try? JSONDecoder().decode([ExpenseTemplateRecord].self, from: data),
              let sanitized = try? JSONEncoder().encode(Array(records.prefix(100))) else { return }
        UserDefaults.standard.set(sanitized, forKey: templateCatalogueKey)
        if #available(iOS 17.0, *) {
            AbacusExpenseShortcuts.updateAppShortcutParameters()
        }
    }
}
#endif

private struct ExpenseTemplateRecord: Codable {
    let id: String
    let name: String
}

@available(iOS 17.0, *)
struct ExpenseTemplateEntity: AppEntity {
    static var typeDisplayRepresentation = TypeDisplayRepresentation(name: "Plantilla de gasto")
    static var defaultQuery = ExpenseTemplateQuery()
    var id: String
    var name: String
    var displayRepresentation: DisplayRepresentation { DisplayRepresentation(title: "\(name)") }
}

@available(iOS 17.0, *)
struct ExpenseTemplateQuery: EntityStringQuery {
    private func catalogue() -> [ExpenseTemplateEntity] {
        guard let data = UserDefaults.standard.data(forKey: templateCatalogueKey),
              let records = try? JSONDecoder().decode([ExpenseTemplateRecord].self, from: data) else { return [] }
        return records.map { ExpenseTemplateEntity(id: $0.id, name: $0.name) }
    }

    func entities(for identifiers: [String]) async throws -> [ExpenseTemplateEntity] {
        catalogue().filter { identifiers.contains($0.id) }
    }

    func entities(matching string: String) async throws -> [ExpenseTemplateEntity] {
        catalogue().filter { $0.name.localizedCaseInsensitiveContains(string) }
    }

    func suggestedEntities() async throws -> [ExpenseTemplateEntity] { catalogue() }
}

@available(iOS 17.0, *)
struct PrepareAbacusExpenseIntent: AppIntent {
    static var title: LocalizedStringResource = "Preparar gasto"
    static var description = IntentDescription("Abre un gasto en Abacus para revisarlo y guardarlo.")
    static var openAppWhenRun: Bool = true

    @Parameter(title: "Importe") var amount: Double?
    @Parameter(title: "Descripción") var expenseDescription: String?
    @Parameter(title: "Plantilla") var template: ExpenseTemplateEntity?

    static var parameterSummary: some ParameterSummary {
        Summary("Preparar gasto en Abacus") {
            \.$amount
            \.$expenseDescription
            \.$template
        }
    }

    func perform() async throws -> some IntentResult {
        var components = URLComponents(string: "__ABACUS_SCHEME__://quick/expense")!
        var items = [URLQueryItem(name: "v", value: "1"), URLQueryItem(name: "requestId", value: UUID().uuidString)]
        if let amount {
            guard amount.isFinite, amount > 0 else { throw ExpenseIntentError.invalidAmount }
            // Decimal notation avoids exponent strings that the capture validator rejects.
            let formatter = NumberFormatter()
            formatter.locale = Locale(identifier: "en_US_POSIX")
            formatter.numberStyle = .decimal
            formatter.usesGroupingSeparator = false
            formatter.maximumFractionDigits = 16
            items.append(URLQueryItem(name: "amount", value: formatter.string(from: NSNumber(value: amount))))
        }
        if let expenseDescription { items.append(URLQueryItem(name: "description", value: expenseDescription)) }
        if let template { items.append(URLQueryItem(name: "templateId", value: template.id)) }
        components.queryItems = items
        components.percentEncodedQuery = components.percentEncodedQuery?.replacingOccurrences(of: "+", with: "%2B")
        // openAppWhenRun foregrounds the host app. OpenURLIntent only accepts
        // universal links, so hand this request to React Native through the
        // private inbox instead of requiring Associated Domains or App Groups.
        ExpenseInbox.append(components.url!)
        return .result()
    }
}

@available(iOS 17.0, *)
private enum ExpenseIntentError: Error, CustomLocalizedStringResourceConvertible {
    case invalidAmount
    var localizedStringResource: LocalizedStringResource { "El importe debe ser mayor que cero." }
}

@available(iOS 17.0, *)
struct AbacusExpenseShortcuts: AppShortcutsProvider {
    static var appShortcuts: [AppShortcut] {
        AppShortcut(
            intent: PrepareAbacusExpenseIntent(),
            phrases: ["Preparar gasto en \(.applicationName)"],
            shortTitle: "Preparar gasto",
            systemImageName: "plus.circle"
        )
    }
}
