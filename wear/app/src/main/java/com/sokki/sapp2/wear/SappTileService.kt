package com.sokki.sapp2.wear

import androidx.wear.protolayout.ActionBuilders
import androidx.wear.protolayout.ColorBuilders
import androidx.wear.protolayout.DimensionBuilders
import androidx.wear.protolayout.LayoutElementBuilders
import androidx.wear.protolayout.ModifiersBuilders
import androidx.wear.protolayout.ResourceBuilders
import androidx.wear.protolayout.TimelineBuilders
import androidx.wear.tiles.RequestBuilders
import androidx.wear.tiles.TileBuilders
import androidx.wear.tiles.TileService
import com.google.common.util.concurrent.Futures
import com.google.common.util.concurrent.ListenableFuture
import org.json.JSONObject

// Kafelek Sapp (2026-11-14; od 2026-11-22: najbliższe wydarzenie z odliczaniem + liczba zadań). Stuknięcie otwiera appkę. Dane: ostatni snapshot z telefonu (Snapshot.KEY).
class SappTileService : TileService() {
    private val res = "1"

    override fun onTileRequest(requestParams: RequestBuilders.TileRequest): ListenableFuture<TileBuilders.Tile> {
        BatteryReporter.schedule(this)
        val json = getSharedPreferences(Snapshot.PREFS, MODE_PRIVATE).getString(Snapshot.KEY, null)
        val snap = try { if (json != null) JSONObject(json) else null } catch (e: Exception) { null }

        val col = LayoutElementBuilders.Column.Builder()
            .setHorizontalAlignment(LayoutElementBuilders.HORIZONTAL_ALIGN_CENTER)
        col.addContent(text("Sapp", 11f, 0xFFA3A3A3.toInt(), bold = true))
        if (snap == null) {
            col.addContent(spacer(6f))
            col.addContent(text("Otwórz Sapp", 14f, 0xFFF2F2F2.toInt()))
            col.addContent(text("na telefonie", 14f, 0xFFF2F2F2.toInt()))
        } else {
            // 2026-11-22 (user: "zamiast liczby zadań najbliższy event jak na Dashboardzie z odliczaniem"):
            // najbliższe wydarzenie z godziną (snapshot "next"), pod nim liczba zadań. Odliczanie
            // liczone przy odświeżeniu kafelka (co ~5 min) — na żywo jest w appce.
            val now = System.currentTimeMillis()
            var ev: JSONObject? = null
            val nx = snap.optJSONArray("next")
            if (nx != null) for (i in 0 until nx.length()) { val o = nx.optJSONObject(i) ?: continue; if (o.optLong("e") > now || o.optLong("s") > now) { ev = o; break } }
            if (ev != null) {
                val s0 = ev.optLong("s"); val e0 = ev.optLong("e")
                val tag = if (ev.isNull("tag")) "" else ev.optString("tag")
                val color = try { android.graphics.Color.parseColor(ev.optString("color", "#A3A3A3")) } catch (x: Exception) { 0xFFA3A3A3.toInt() }
                col.addContent(spacer(4f))
                if (tag.isNotEmpty()) col.addContent(text(tag, 11f, color, bold = true))
                col.addContent(text(if (now < s0) "za " + countdown(s0 - now) else "teraz", 22f, 0xFFF2F2F2.toInt(), bold = true))
                col.addContent(text(whenLabel(s0, e0, now), 11f, 0xFFA3A3A3.toInt()))
                col.addContent(text(ev.optString("title"), 13f, 0xFFF2F2F2.toInt()))
            } else {
                col.addContent(spacer(6f))
                col.addContent(text("Nic w kalendarzu", 14f, 0xFFF2F2F2.toInt(), bold = true))
            }
            val tasks = snap.optJSONArray("tasks")
            val n = tasks?.length() ?: 0
            var overdue = 0
            for (i in 0 until n) if (tasks!!.optJSONObject(i)?.optBoolean("overdue") == true) overdue++
            col.addContent(spacer(6f))
            col.addContent(text(if (n == 0) "✓ zadania zrobione" else "$n do zrobienia" + (if (overdue > 0) " · $overdue zaległe" else ""), 11f, if (overdue > 0) 0xFFF87171.toInt() else 0xFFA3A3A3.toInt()))
        }

        val open = ModifiersBuilders.Clickable.Builder()
            .setId("open")
            .setOnClick(
                ActionBuilders.LaunchAction.Builder()
                    .setAndroidActivity(
                        ActionBuilders.AndroidActivity.Builder()
                            .setPackageName(packageName)
                            .setClassName(MainActivity::class.java.name)
                            .build(),
                    ).build(),
            ).build()

        val root = LayoutElementBuilders.Box.Builder()
            .setWidth(DimensionBuilders.expand())
            .setHeight(DimensionBuilders.expand())
            .setModifiers(ModifiersBuilders.Modifiers.Builder().setClickable(open).build())
            .addContent(col.build())
            .build()

        val tile = TileBuilders.Tile.Builder()
            .setResourcesVersion(res)
            .setFreshnessIntervalMillis(5 * 60 * 1000L)
            .setTileTimeline(TimelineBuilders.Timeline.fromLayoutElement(root))
            .build()
        return Futures.immediateFuture(tile)
    }

    override fun onTileResourcesRequest(requestParams: RequestBuilders.ResourcesRequest): ListenableFuture<ResourceBuilders.Resources> =
        Futures.immediateFuture(ResourceBuilders.Resources.Builder().setVersion(res).build())

    private fun countdown(ms: Long): String {
        val m = Math.max(0L, (ms + 59999) / 60000)
        return when {
            m >= 24 * 60 -> "${m / 1440} d ${(m % 1440) / 60} h"
            m >= 60 -> if (m % 60 == 0L) "${m / 60} h" else "${m / 60} h ${m % 60} min"
            else -> "$m min"
        }
    }

    private fun whenLabel(s: Long, e: Long, now: Long): String {
        val hm = java.text.SimpleDateFormat("HH:mm", Snapshot.PL)
        val day = java.text.SimpleDateFormat("yyyyMMdd", java.util.Locale.US)
        val ds = day.format(java.util.Date(s))
        val d = when (ds) { day.format(java.util.Date(now)) -> "dziś"; day.format(java.util.Date(now + 86400000L)) -> "jutro"; else -> java.text.SimpleDateFormat("EEE d MMM", Snapshot.PL).format(java.util.Date(s)) }
        return d + " " + hm.format(java.util.Date(s)) + (if (e > s) "–" + hm.format(java.util.Date(e)) else "")
    }

    private fun spacer(dp: Float) = LayoutElementBuilders.Spacer.Builder().setHeight(DimensionBuilders.dp(dp)).build()

    private fun text(s: String, sp: Float, argb: Int, bold: Boolean = false) = LayoutElementBuilders.Text.Builder()
        .setText(s)
        .setMaxLines(1)
        .setFontStyle(
            LayoutElementBuilders.FontStyle.Builder()
                .setSize(DimensionBuilders.sp(sp))
                .setColor(ColorBuilders.argb(argb))
                .setWeight(if (bold) LayoutElementBuilders.FONT_WEIGHT_BOLD else LayoutElementBuilders.FONT_WEIGHT_NORMAL)
                .build(),
        ).build()
}
