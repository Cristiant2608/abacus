import SwiftUI
import WidgetKit
import AppIntents

struct ExpenseWidgetConfiguration: WidgetConfigurationIntent {
    static var title: LocalizedStringResource = "Accesos de Abacus"
    static var description = IntentDescription("Copia un enlace desde Accesos rápidos en Abacus y pégalo aquí.")
    @Parameter(title: "Nombre del primer acceso", default: "Mi gasto") var firstName: String
    @Parameter(title: "Enlace del primer acceso") var firstLink: String?
    @Parameter(title: "Nombre del segundo acceso", default: "Otro gasto") var secondName: String
    @Parameter(title: "Enlace del segundo acceso") var secondLink: String?
}

private let newExpenseURL = URL(string: "__ABACUS_SCHEME__://quick/expense?v=1")!
private let templatesURL = URL(string: "__ABACUS_SCHEME__://quick/templates?v=1")!

// Widgets hold links and user-supplied labels only. They never read the app's
// credentials, transaction data or private storage, and require no App Group.
private func templateURL(_ value: String?) -> URL? {
    guard let value, let url = URL(string: value),
          url.scheme == "__ABACUS_SCHEME__", url.host == "quick", url.path == "/expense",
          url.user == nil, url.password == nil, url.port == nil, url.fragment == nil,
          let components = URLComponents(url: url, resolvingAgainstBaseURL: false) else { return nil }
    let items = components.queryItems ?? []
    guard items.count == 2,
          items.filter({ $0.name == "v" && $0.value == "1" }).count == 1,
          let identifier = items.first(where: { $0.name == "templateId" })?.value,
          identifier.range(of: "^[a-zA-Z0-9-]{1,64}$", options: .regularExpression) != nil else { return nil }
    return url
}

struct ExpenseWidgetEntry: TimelineEntry {
    let date: Date
    let configuration: ExpenseWidgetConfiguration
}

struct ExpenseWidgetProvider: AppIntentTimelineProvider {
    func placeholder(in context: Context) -> ExpenseWidgetEntry {
        ExpenseWidgetEntry(date: .now, configuration: ExpenseWidgetConfiguration())
    }
    func snapshot(for configuration: ExpenseWidgetConfiguration, in context: Context) async -> ExpenseWidgetEntry {
        ExpenseWidgetEntry(date: .now, configuration: configuration)
    }
    func timeline(for configuration: ExpenseWidgetConfiguration, in context: Context) async -> Timeline<ExpenseWidgetEntry> {
        Timeline(entries: [ExpenseWidgetEntry(date: .now, configuration: configuration)], policy: .never)
    }
}

struct ExpenseWidgetView: View {
    @Environment(\.widgetFamily) private var family
    let entry: ExpenseWidgetEntry

    var body: some View {
        let first = templateURL(entry.configuration.firstLink)
        let second = templateURL(entry.configuration.secondLink)
        VStack(alignment: .leading, spacing: 12) {
            Text("Abacus").font(.caption.bold()).foregroundStyle(.secondary)
            if family == .systemSmall {
                Image(systemName: "plus.circle.fill").font(.largeTitle).foregroundStyle(.orange)
                Text(first == nil ? "Nuevo gasto" : entry.configuration.firstName).font(.headline)
                Text("Revisar y guardar").font(.caption).foregroundStyle(.secondary)
            } else {
                Link(destination: newExpenseURL) {
                    Label("Nuevo gasto", systemImage: "plus.circle.fill").font(.headline).foregroundStyle(.orange)
                        .frame(maxWidth: .infinity, alignment: .leading).padding(.vertical, 4)
                }
                HStack(spacing: 16) {
                    Link(destination: first ?? templatesURL) {
                        Label(first == nil ? "Plantillas" : entry.configuration.firstName, systemImage: "bolt.fill")
                            .font(.subheadline).frame(maxWidth: .infinity, alignment: .leading)
                    }
                    if let second {
                        Link(destination: second) {
                            Text(entry.configuration.secondName).font(.subheadline)
                                .frame(maxWidth: .infinity, alignment: .leading)
                        }
                    }
                }
            }
        }
        .frame(maxWidth: .infinity, maxHeight: .infinity, alignment: .leading)
        .containerBackground(.fill.tertiary, for: .widget)
        .widgetURL(family == .systemSmall ? (first ?? newExpenseURL) : newExpenseURL)
    }
}

@main
struct AbacusExpenseWidget: Widget {
    var body: some WidgetConfiguration {
        AppIntentConfiguration(kind: "AbacusExpenseWidget", intent: ExpenseWidgetConfiguration.self, provider: ExpenseWidgetProvider()) { entry in
            ExpenseWidgetView(entry: entry)
        }
        .configurationDisplayName("Captura rápida")
        .description("Prepara un gasto o abre tus plantillas de Abacus.")
        .supportedFamilies([.systemSmall, .systemMedium])
    }
}
