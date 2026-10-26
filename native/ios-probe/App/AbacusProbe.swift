import SwiftUI
import AppIntents

@main
struct AbacusProbe: App {
    @State private var message = "Abre esta app desde Atajos o el widget."

    init() {
        #if ABACUS_VALIDATION_PROBE
        AbacusProbeShortcuts.updateAppShortcutParameters()
        #endif
    }

    var body: some Scene {
        WindowGroup {
            VStack(spacing: 24) {
                Image(systemName: "plus.circle.fill")
                    .font(.system(size: 64))
                    .foregroundStyle(.orange)
                Text("Abacus · prueba de instalación").font(.title2.bold())
                Text(message).multilineTextAlignment(.center)
                Text("Esta prueba no conecta con Firefly ni registra gastos.")
                    .font(.footnote).foregroundStyle(.secondary)
                #if ABACUS_VALIDATION_PROBE
                Text(Bundle.main.bundleIdentifier ?? "Sin identificador")
                    .font(.caption2).textSelection(.enabled)
                Button("Comprobar registro de Atajos") {
                    Task {
                        do {
                            AbacusProbeShortcuts.updateAppShortcutParameters()
                            try await PrepareExpenseIntent().donate()
                            message = "iOS aceptó la donación de la acción. Pulsa el botón de Atajos de abajo."
                        } catch {
                            message = "Error de registro: \(error.localizedDescription)\n\(String(reflecting: error))"
                        }
                    }
                }
                ShortcutsLink()
                #endif
            }
            .padding(24)
            .onOpenURL { url in
                guard url.scheme == "abacus-personal-probe", url.host == "expense" else { return }
                message = "Acceso desde el widget correcto."
            }
        }
    }
}
