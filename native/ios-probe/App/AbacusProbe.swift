import SwiftUI

@main
struct AbacusProbe: App {
    @State private var message = "Abre esta app desde Atajos o el widget."

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
            }
            .padding(24)
            .onOpenURL { url in
                guard url.scheme == "abacus-personal-probe", url.host == "expense" else { return }
                message = "Acceso desde el widget correcto."
            }
        }
    }
}
