package com.sokki.sapp2.wear

import android.app.Activity
import android.graphics.Color
import android.graphics.Paint
import android.graphics.Typeface
import android.net.Uri
import android.os.Bundle
import android.util.TypedValue
import android.view.Gravity
import android.view.InputDevice
import android.view.MotionEvent
import android.view.ViewConfiguration
import android.widget.LinearLayout
import android.widget.ScrollView
import android.widget.TextView
import com.google.android.gms.wearable.DataClient
import com.google.android.gms.wearable.DataEvent
import com.google.android.gms.wearable.DataEventBuffer
import com.google.android.gms.wearable.DataMapItem
import com.google.android.gms.wearable.Wearable
import org.json.JSONObject
import java.text.SimpleDateFormat
import java.util.Date
import java.util.Locale
import kotlin.math.roundToInt

// Sapp2 na zegarek (2026-11-14). Pokazuje to, co wysyła telefon (ścieżka Data Layer
// /sapp2/snapshot, treść: src/utils/wearSnapshot.ts): wydatki dziś i w miesiącu,
// zadania do zrobienia (stuknięcie = odhacz → wiadomość /sapp2/toggle do telefonu),
// ostatnie transakcje. Ostatnie dane zapamiętane — działa też bez telefonu w zasięgu.
// Bezel (Galaxy Watch) przewija listę.
class MainActivity : Activity(), DataClient.OnDataChangedListener {
    private lateinit var scroll: ScrollView
    private lateinit var list: LinearLayout
    private val prefs by lazy { getSharedPreferences(Snapshot.PREFS, MODE_PRIVATE) }
    private val doneLocal = mutableSetOf<String>()
    private val pl = Locale("pl", "PL")

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        // Bateria → telefon teraz + co 15 min (BatteryReporter.kt).
        BatteryReporter.report(this)
        BatteryReporter.schedule(this)
        scroll = ScrollView(this).apply {
            isVerticalScrollBarEnabled = false
            isFocusable = true
            isFocusableInTouchMode = true
            setBackgroundColor(Color.BLACK)
        }
        list = LinearLayout(this).apply { orientation = LinearLayout.VERTICAL }
        val side = (resources.displayMetrics.widthPixels * 0.13).roundToInt()
        list.setPadding(side, dp(26), side, dp(40))
        scroll.addView(list)
        scroll.setOnGenericMotionListener { v, ev ->
            if (ev.action == MotionEvent.ACTION_SCROLL && ev.isFromSource(InputDevice.SOURCE_ROTARY_ENCODER)) {
                val delta = -ev.getAxisValue(MotionEvent.AXIS_SCROLL) * ViewConfiguration.get(this).scaledVerticalScrollFactor
                v.scrollBy(0, delta.roundToInt())
                true
            } else false
        }
        setContentView(scroll)
        render(prefs.getString(Snapshot.KEY, null))
    }

    override fun onResume() {
        super.onResume()
        Wearable.getDataClient(this).addListener(this)
        fetch()
        scroll.requestFocus()
    }

    override fun onPause() {
        super.onPause()
        Wearable.getDataClient(this).removeListener(this)
    }

    private fun fetch() {
        Wearable.getDataClient(this).getDataItems(Uri.parse("wear://*/sapp2/snapshot")).addOnSuccessListener { buf ->
            var json: String? = null
            var newest = -1L
            for (item in buf) {
                val map = DataMapItem.fromDataItem(item).dataMap
                val t = map.getLong("t")
                if (t > newest) { newest = t; json = map.getString("json") }
            }
            buf.release()
            if (json != null) save(json)
        }
    }

    override fun onDataChanged(events: DataEventBuffer) {
        var json: String? = null
        for (e in events) {
            if (e.type == DataEvent.TYPE_CHANGED && e.dataItem.uri.path == "/sapp2/snapshot") {
                json = DataMapItem.fromDataItem(e.dataItem).dataMap.getString("json")
            }
        }
        if (json != null) runOnUiThread { doneLocal.clear(); save(json) }
    }

    private fun save(json: String) {
        prefs.edit().putString(Snapshot.KEY, json).apply()
        render(json)
        try { androidx.wear.tiles.TileService.getUpdater(this).requestUpdate(SappTileService::class.java) } catch (e: Exception) {}
    }

    private fun toggle(taskId: String) {
        doneLocal.add(taskId)
        render(prefs.getString(Snapshot.KEY, null))
        Wearable.getNodeClient(this).connectedNodes.addOnSuccessListener { nodes ->
            for (n in nodes) Wearable.getMessageClient(this).sendMessage(n.id, "/sapp2/toggle", taskId.toByteArray(Charsets.UTF_8))
        }
    }

    private fun render(json: String?) {
        list.removeAllViews()
        val snap = try { if (json != null) JSONObject(json) else null } catch (e: Exception) { null }
        if (snap == null) {
            list.addView(text("SAPP2", 11f, "#A3A3A3", bold = true, center = true))
            list.addView(text("Otwórz Sapp2 na telefonie — dane pojawią się tutaj.", 14f, "#F2F2F2", center = true).apply { setPadding(0, dp(10), 0, 0) })
            return
        }
        val at = snap.optLong("t", 0L)
        list.addView(text(if (at > 0) "SAPP2 · " + SimpleDateFormat("HH:mm", pl).format(Date(at)) else "SAPP2", 10f, "#A3A3A3", bold = true, center = true))

        // Wydatki
        val fresh = Snapshot.isToday(snap)
        list.addView(text(if (fresh) money(snap.optDouble("today", 0.0)) else "—", 26f, "#F2F2F2", bold = true, center = true).apply { setPadding(0, dp(4), 0, 0) })
        list.addView(text(if (fresh) "dziś · " + money(snap.optDouble("month", 0.0)) + " w miesiącu" else "brak danych z dziś — otwórz Sapp2 na telefonie", 11f, "#A3A3A3", center = true, maxLines = 2))

        // Zadania
        val tasks = snap.optJSONArray("tasks")
        list.addView(section("ZADANIA"))
        if (tasks == null || tasks.length() == 0) list.addView(text("Nic do zrobienia", 13f, "#A3A3A3"))
        else for (i in 0 until tasks.length()) {
            val t = tasks.optJSONObject(i) ?: continue
            val id = t.optString("id")
            val done = doneLocal.contains(id)
            val row = LinearLayout(this).apply {
                orientation = LinearLayout.HORIZONTAL
                gravity = Gravity.CENTER_VERTICAL
                setPadding(0, dp(6), 0, dp(6))
                isClickable = true
                setOnClickListener { if (!done && id.isNotEmpty()) toggle(id) }
            }
            row.addView(text(if (done) "✓" else "○", 16f, if (done) "#4ADE80" else "#A3A3A3").apply { setPadding(0, 0, dp(8), 0) })
            val col = LinearLayout(this).apply { orientation = LinearLayout.VERTICAL }
            col.addView(text(t.optString("title"), 14f, if (done) "#8A8A8A" else "#F2F2F2", maxLines = 2).apply {
                if (done) paintFlags = paintFlags or Paint.STRIKE_THRU_TEXT_FLAG
            })
            val sub = t.optString("sub")
            if (sub.isNotEmpty()) col.addView(text(sub, 11f, if (t.optBoolean("overdue")) "#F87171" else "#A3A3A3"))
            row.addView(col, LinearLayout.LayoutParams(0, LinearLayout.LayoutParams.WRAP_CONTENT, 1f))
            list.addView(row)
        }

        // Ostatnie transakcje
        val recent = snap.optJSONArray("recent")
        if (recent != null && recent.length() > 0) {
            list.addView(section("OSTATNIE"))
            for (i in 0 until recent.length()) {
                val r = recent.optJSONObject(i) ?: continue
                val amount = r.optDouble("amount", 0.0)
                val row = LinearLayout(this).apply {
                    orientation = LinearLayout.HORIZONTAL
                    gravity = Gravity.CENTER_VERTICAL
                    setPadding(0, dp(4), 0, dp(4))
                }
                row.addView(text(r.optString("label"), 13f, "#F2F2F2"), LinearLayout.LayoutParams(0, LinearLayout.LayoutParams.WRAP_CONTENT, 1f))
                row.addView(text((if (amount > 0) "+" else "") + money(amount), 13f, if (amount > 0) "#4ADE80" else "#D6D6D6", bold = true).apply { setPadding(dp(6), 0, 0, 0) })
                list.addView(row)
            }
        }
    }

    private fun section(label: String) = text(label, 10f, "#A3A3A3", bold = true).apply {
        letterSpacing = 0.08f
        setPadding(0, dp(14), 0, dp(2))
    }

    private fun text(s: String, sp: Float, color: String, bold: Boolean = false, center: Boolean = false, maxLines: Int = 1) = TextView(this).apply {
        text = s
        setTextSize(TypedValue.COMPLEX_UNIT_SP, sp)
        setTextColor(Color.parseColor(color))
        if (bold) typeface = Typeface.DEFAULT_BOLD
        if (center) gravity = Gravity.CENTER_HORIZONTAL
        this.maxLines = maxLines
        ellipsize = android.text.TextUtils.TruncateAt.END
    }

    private fun money(v: Double) = String.format(pl, "%.2f zł", v).replace("-", "−")

    private fun dp(v: Int) = (v * resources.displayMetrics.density).roundToInt()
}
