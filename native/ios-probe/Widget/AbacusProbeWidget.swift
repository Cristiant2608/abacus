import SwiftUI
import WidgetKit

struct ProbeEntry: TimelineEntry {
    let date: Date
}

struct ProbeProvider: TimelineProvider {
    func placeholder(in context: Context) -> ProbeEntry { ProbeEntry(date: .now) }
    func getSnapshot(in context: Context, completion: @escaping (ProbeEntry) -> Void) {
        completion(ProbeEntry(date: .now))
    }
    func getTimeline(in context: Context, completion: @escaping (Timeline<ProbeEntry>) -> Void) {
        completion(Timeline(entries: [ProbeEntry(date: .now)], policy: .never))
    }
}

@main
struct AbacusProbeWidget: Widget {
    var body: some WidgetConfiguration {
        StaticConfiguration(kind: "AbacusProbeWidget", provider: ProbeProvider()) { _ in
            VStack(alignment: .leading, spacing: 12) {
                Text("Abacus Test").font(.headline)
                Label("Nuevo gasto", systemImage: "plus.circle.fill")
                    .foregroundStyle(.orange)
            }
            .containerBackground(.fill.tertiary, for: .widget)
            .widgetURL(URL(string: "abacus-personal-probe://expense"))
        }
        .configurationDisplayName("Prueba de captura")
        .description("Comprueba que el widget abre Abacus.")
        .supportedFamilies([.systemSmall, .systemMedium])
    }
}
