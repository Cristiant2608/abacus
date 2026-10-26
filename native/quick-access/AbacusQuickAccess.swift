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
    static func consume() -> [[String: Any]] {
        lock.lock()
        defer { lock.unlock() }
        let current = UserDefaults.standard.stringArray(forKey: inboxKey) ?? []
        UserDefaults.standard.removeObject(forKey: inboxKey)
        return current.map { ["url": $0, "operation": "prepare"] }
    }
}

// Direct saves live only in memory and require an atomic claim immediately
// before the HTTP request. They cannot be replayed after an app restart.
private enum DirectMovementCoordinator {
    struct Pending {
        let url: URL
        let deadline: Date
        let continuation: CheckedContinuation<String, Error>
        var delivered = false
        var claimed = false
    }
    static let lock = NSLock()
    static var pending: [String: Pending] = [:]

    static func wait(for url: URL, requestId: String) async throws -> String {
        try await withTaskCancellationHandler(operation: {
            try await withCheckedThrowingContinuation { continuation in
                lock.lock()
                if Task.isCancelled {
                    lock.unlock()
                    continuation.resume(throwing: CancellationError())
                    return
                }
                pending[requestId] = Pending(url: url, deadline: Date().addingTimeInterval(60), continuation: continuation)
                lock.unlock()
                NotificationCenter.default.post(name: inboxNotification, object: nil)
                DispatchQueue.global().asyncAfter(deadline: .now() + 60) { expire(requestId) }
            }
        }, onCancel: {
            finish(requestId, result: .failure(CancellationError()))
        })
    }

    static func consume() -> [[String: Any]] {
        lock.lock()
        defer { lock.unlock() }
        var records: [[String: Any]] = []
        for id in Array(pending.keys).sorted() {
            guard var item = pending[id], !item.delivered else { continue }
            item.delivered = true
            pending[id] = item
            records.append([
                "url": item.url.absoluteString, "operation": "save",
                "requestId": id, "expiresAt": item.deadline.timeIntervalSince1970 * 1000
            ])
        }
        return records
    }

    static func claim(_ id: String) -> Bool {
        lock.lock()
        defer { lock.unlock() }
        guard var item = pending[id], item.delivered, !item.claimed, item.deadline > Date() else { return false }
        item.claimed = true
        pending[id] = item
        return true
    }

    static func finish(_ id: String, result: Result<String, Error>) {
        lock.lock()
        let item = pending.removeValue(forKey: id)
        lock.unlock()
        item?.continuation.resume(with: result)
    }

    static func expire(_ id: String) {
        lock.lock()
        let item = pending.removeValue(forKey: id)
        lock.unlock()
        guard let item else { return }
        let message = item.claimed
            ? "No se pudo confirmar el movimiento. Comprueba Firefly antes de volver a intentarlo."
            : "La solicitud caducó antes de enviarse. Abre Abacus, inicia sesión y vuelve a intentarlo."
        item.continuation.resume(throwing: MovementExecutionError(message: message))
    }
}

private struct MovementExecutionError: LocalizedError {
    let message: String
    var errorDescription: String? { message }
}

#if canImport(React)
import React

@objc(AbacusQuickAccess)
class AbacusQuickAccess: RCTEventEmitter {
    private var observer: NSObjectProtocol?
    @objc override static func requiresMainQueueSetup() -> Bool { false }
    override func supportedEvents() -> [String]! { ["AbacusQuickAccessRequest"] }

    @objc static func registerShortcuts() {
        DispatchQueue.main.async {
            if #available(iOS 17.2, *) { AbacusExpenseShortcuts.updateAppShortcutParameters() }
        }
    }

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
        resolve(ExpenseInbox.consume() + DirectMovementCoordinator.consume())
    }
    @objc func claimSave(_ requestId: String, resolver resolve: RCTPromiseResolveBlock, rejecter reject: RCTPromiseRejectBlock) {
        resolve(DirectMovementCoordinator.claim(requestId))
    }
    @objc func completeSave(_ requestId: String, transactionId: String?, errorMessage: String?) {
        if let transactionId, !transactionId.isEmpty {
            DirectMovementCoordinator.finish(requestId, result: .success(transactionId))
        } else {
            DirectMovementCoordinator.finish(requestId, result: .failure(MovementExecutionError(message: errorMessage ?? "No se pudo confirmar el movimiento.")))
        }
    }
    @objc func setTemplates(_ json: String) {
        guard let data = json.data(using: .utf8),
              let records = try? JSONDecoder().decode([ExpenseTemplateRecord].self, from: data),
              let sanitized = try? JSONEncoder().encode(Array(records.prefix(100))) else { return }
        UserDefaults.standard.set(sanitized, forKey: templateCatalogueKey)
        Self.registerShortcuts()
    }
}
#endif

private struct ExpenseTemplateRecord: Codable {
    let id: String
    let name: String
    let kind: String?
}

@available(iOS 17.0, *)
struct ExpenseTemplateEntity: AppEntity {
    static var typeDisplayRepresentation = TypeDisplayRepresentation(name: "Plantilla de movimiento")
    static var defaultQuery = ExpenseTemplateQuery()
    var id: String
    var name: String
    var kind: String?
    var displayRepresentation: DisplayRepresentation {
        let label = kind == "deposit" ? "Ingreso" : kind == "transfer" ? "Transferencia" : "Gasto"
        return DisplayRepresentation(title: "\(name)", subtitle: "\(label)")
    }
}

@available(iOS 17.0, *)
struct ExpenseTemplateQuery: EntityStringQuery {
    private func catalogue() -> [ExpenseTemplateEntity] {
        guard let data = UserDefaults.standard.data(forKey: templateCatalogueKey),
              let records = try? JSONDecoder().decode([ExpenseTemplateRecord].self, from: data) else { return [] }
        return records.map { ExpenseTemplateEntity(id: $0.id, name: $0.name, kind: $0.kind) }
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
enum MovementKind: String, AppEnum {
    case withdrawal, deposit, transfer
    static var typeDisplayRepresentation = TypeDisplayRepresentation(name: "Tipo de movimiento")
    static var caseDisplayRepresentations: [MovementKind: DisplayRepresentation] = [
        .withdrawal: "Gasto", .deposit: "Ingreso", .transfer: "Transferencia"
    ]
}

@available(iOS 17.0, *)
private func movementURL(amount: Double?, description: String?, templateId: String?, kind: MovementKind?, requestId: String) throws -> URL {
    var components = URLComponents(string: "__ABACUS_SCHEME__://quick/expense")!
    var items = [URLQueryItem(name: "v", value: "1"), URLQueryItem(name: "requestId", value: requestId)]
    if let amount {
        guard amount.isFinite, amount > 0 else { throw MovementExecutionError(message: "El importe debe ser mayor que cero.") }
        let formatter = NumberFormatter()
        formatter.locale = Locale(identifier: "en_US_POSIX")
        formatter.numberStyle = .decimal
        formatter.usesGroupingSeparator = false
        formatter.maximumFractionDigits = 16
        items.append(URLQueryItem(name: "amount", value: formatter.string(from: NSNumber(value: amount))))
    }
    if let description { items.append(URLQueryItem(name: "description", value: description)) }
    if let templateId { items.append(URLQueryItem(name: "templateId", value: templateId)) }
    if let kind { items.append(URLQueryItem(name: "kind", value: kind.rawValue)) }
    components.queryItems = items
    components.percentEncodedQuery = components.percentEncodedQuery?.replacingOccurrences(of: "+", with: "%2B")
    return components.url!
}

@available(iOS 17.2, *)
struct PrepareAbacusExpenseIntent: AppIntent {
    static var title: LocalizedStringResource = "Preparar movimiento"
    static var description = IntentDescription("Abre un gasto, ingreso o transferencia para revisarlo y guardarlo.")
    static var openAppWhenRun: Bool = true
    @Parameter(title: "Importe") var amount: Double?
    @Parameter(title: "Descripción") var expenseDescription: String?
    @Parameter(title: "Plantilla") var template: ExpenseTemplateEntity?
    @Parameter(title: "Tipo") var kind: MovementKind?

    static var parameterSummary: some ParameterSummary {
        Summary("Preparar movimiento de \(\.$amount)") {
            \.$template
            \.$kind
            \.$expenseDescription
        }
    }

    func perform() async throws -> some IntentResult {
        let url = try movementURL(amount: amount, description: expenseDescription, templateId: template?.id, kind: kind, requestId: UUID().uuidString)
        ExpenseInbox.append(url)
        return .result()
    }
}

@available(iOS 17.2, *)
struct SaveAbacusMovementIntent: AppIntent {
    static var title: LocalizedStringResource = "Guardar movimiento"
    static var description = IntentDescription("Registra el movimiento de una plantilla sin abrir el formulario. Abacus se abre para autenticar y completar el envío.")
    static var openAppWhenRun: Bool = true
    static var authenticationPolicy: IntentAuthenticationPolicy = .requiresLocalDeviceAuthentication
    @Parameter(title: "Plantilla") var template: ExpenseTemplateEntity
    @Parameter(title: "Importe") var amount: Double?
    @Parameter(title: "Descripción") var movementDescription: String?

    static var parameterSummary: some ParameterSummary {
        Summary("Guardar movimiento con \(\.$template)") {
            \.$amount
            \.$movementDescription
        }
    }

    func perform() async throws -> some IntentResult & ReturnsValue<String> & ProvidesDialog {
        let id = UUID().uuidString
        let url = try movementURL(amount: amount, description: movementDescription, templateId: template.id, kind: nil, requestId: id)
        let transactionId = try await DirectMovementCoordinator.wait(for: url, requestId: id)
        return .result(value: transactionId, dialog: "Movimiento guardado.")
    }
}

@available(iOS 17.2, *)
struct AbacusExpenseShortcuts: AppShortcutsProvider {
    static var appShortcuts: [AppShortcut] {
        AppShortcut(intent: PrepareAbacusExpenseIntent(), phrases: ["Preparar movimiento en \(.applicationName)"], shortTitle: "Preparar movimiento", systemImageName: "square.and.pencil")
        AppShortcut(intent: SaveAbacusMovementIntent(), phrases: ["Guardar movimiento en \(.applicationName)"], shortTitle: "Guardar movimiento", systemImageName: "checkmark.circle")
    }
}
