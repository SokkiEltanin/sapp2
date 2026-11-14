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

// Kafelek Sapp2 (2026-11-14): wydatki dziś (duże), w miesiącu, liczba zadań + pierwsze
// zadanie. Stuknięcie otwiera appkę. Dane: ostatni snapshot z telefonu (Snapshot.KEY).
class SappTileService : TileService() {
    private val res = "1"

    override fun onTileRequest(requestParams: RequestBuilders.TileRequest): ListenableFuture<TileBuilders.Tile> {
        val json = getSharedPreferences(Snapshot.PREFS, MODE_PRIVATE).getString(Snapshot.KEY, null)
        val snap = try { if (json != null) JSONObject(json) else null } catch (e: Exception) { null }

        val col = LayoutElementBuilders.Column.Builder()
            .setHorizontalAlignment(LayoutElementBuilders.HORIZONTAL_ALIGN_CENTER)
        col.addContent(text("SAPP2", 11f, 0xFFA3A3A3.toInt(), bold = true))
        if (snap == null) {
            col.addContent(spacer(6f))
            col.addContent(text("Otwórz Sapp2", 14f, 0xFFF2F2F2.toInt()))
            col.addContent(text("na telefonie", 14f, 0xFFF2F2F2.toInt()))
        } else {
            col.addContent(spacer(4f))
            val fresh = Snapshot.isToday(snap)
            col.addContent(text(if (fresh) Snapshot.money(snap.optDouble("today", 0.0)) else "—", 26f, 0xFFF2F2F2.toInt(), bold = true))
            col.addContent(text(if (fresh) "dziś · " + Snapshot.money(snap.optDouble("month", 0.0)) + " w mies." else "brak danych z dziś", 11f, 0xFFA3A3A3.toInt()))
            val tasks = snap.optJSONArray("tasks")
            val n = tasks?.length() ?: 0
            var overdue = 0
            for (i in 0 until n) if (tasks!!.optJSONObject(i)?.optBoolean("overdue") == true) overdue++
            col.addContent(spacer(8f))
            col.addContent(text(
                if (n == 0) "Zadania: nic" else "Zadania: $n" + (if (overdue > 0) " · $overdue zaległe" else ""),
                12f, if (overdue > 0) 0xFFF87171.toInt() else 0xFFD6D6D6.toInt(), bold = true,
            ))
            if (n > 0) col.addContent(text(tasks!!.optJSONObject(0)?.optString("title") ?: "", 13f, 0xFFF2F2F2.toInt()))
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
            .setFreshnessIntervalMillis(30 * 60 * 1000L)
            .setTileTimeline(TimelineBuilders.Timeline.fromLayoutElement(root))
            .build()
        return Futures.immediateFuture(tile)
    }

    override fun onTileResourcesRequest(requestParams: RequestBuilders.ResourcesRequest): ListenableFuture<ResourceBuilders.Resources> =
        Futures.immediateFuture(ResourceBuilders.Resources.Builder().setVersion(res).build())

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
