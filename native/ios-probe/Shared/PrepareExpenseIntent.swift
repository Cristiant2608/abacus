import AppIntents

struct PrepareExpenseIntent: AppIntent {
    static var title: LocalizedStringResource = "Preparar gasto de prueba"
    static var description = IntentDescription("Comprueba que Abacus puede abrirse desde Atajos.")
    static var openAppWhenRun: Bool = true

    func perform() async throws -> some IntentResult {
        return .result()
    }
}

struct AbacusProbeShortcuts: AppShortcutsProvider {
    static var appShortcuts: [AppShortcut] {
        AppShortcut(
            intent: PrepareExpenseIntent(),
            phrases: ["Preparar gasto en \(.applicationName)"],
            shortTitle: "Preparar gasto",
            systemImageName: "plus.circle"
        )
    }
}
