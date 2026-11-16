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

// Sapp2 na zegarek (2026-11-14, przebudowa 2026-11-16). Pokazuje to, co wysyła telefon
// (Data Layer /sapp2/snapshot, treść: src/utils/wearSnapshot.ts): zadania do zrobienia
// (stuknięcie = rozwiń kroki; krok stuknięciem → /sapp2/step; całe zadanie tylko
// przytrzymaniem → /sapp2/toggle) oraz kalendarz/praca dziś i jutro. Bez wydatków. Ostatnie dane zapamiętane — działa też bez telefonu w zasięgu.
// Bezel (Galaxy Watch) przewija listę.
class MainActivity : Activity(), DataClient.OnDataChangedListener {
    private lateinit var scroll: ScrollView
    private lateinit var list: LinearLayout
    private val prefs by lazy { getSharedPreferences(Snapshot.PREFS, MODE_PRIVATE) }
    private val doneLocal = mutableSetOf<String>()
    private val expanded = mutableSetOf<String>()
    private val stepLocal = mutableMapOf<String, Boolean>()
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
        if (json != null) runOnUiThread { doneLocal.clear(); stepLocal.clear(); save(json) }
    }

    private fun save(json: String) {
        prefs.edit().putString(Snapshot.KEY, json).apply()
        render(json)
        try { androidx.wear.tiles.TileService.getUpdater(this).requestUpdate(SappTileService::class.java) } catch (e: Exception) {}
    }

    // Całe zadanie: tylko PRZYTRZYMANIEM przycisku w rozwiniętym zadaniu (2026-11-16,
    // user: "odznaczyło się niechcący zamiast kamienia milowego") → /sapp2/toggle.
    private fun toggle(taskId: String) {
        doneLocal.add(taskId)
        expanded.remove(taskId)
        render(prefs.getString(Snapshot.KEY, null))
        send("/sapp2/toggle", taskId)
    }

    // Krok: stuknięcie → /sapp2/step "taskId|stepId|1/0" (telefon zapisze przy otwarciu appki).
    private fun toggleStep(taskId: String, stepId: String, done: Boolean) {
        stepLocal["$taskId|$stepId"] = done
        render(prefs.getString(Snapshot.KEY, null))
        send("/sapp2/step", "$taskId|$stepId|${if (done) 1 else 0}")
    }

    private fun send(path: String, msg: String) {
        Wearable.getNodeClient(this).connectedNodes.addOnSuccessListener { nodes ->
            for (n in nodes) Wearable.getMessageClient(this).sendMessage(n.id, path, msg.toByteArray(Charsets.UTF_8))
        }
    }

    private fun render(json: String?) {
        list.removeAllViews()
        val snap = try { if (json != null) JSONObject(json) else null } catch (e: Exception) { null }
        if (snap == null) {
            list.addView(text("SAPP2", 11f, "#A3A3A3", bold = true, center = true))
            list.addView(text("Otwórz Sapp2 na telefonie — dane pojawią się tutaj.", 14f, "#F2F2F2", center = true, maxLines = 3).apply { setPadding(0, dp(10), 0, 0) })
            return
        }
        val at = snap.optLong("t", 0L)
        list.addView(text(if (at > 0) "SAPP2 · " + SimpleDateFormat("HH:mm", pl).format(Date(at)) else "SAPP2", 10f, "#A3A3A3", bold = true, center = true))

        // Zadania (bez wydatków — 2026-11-16)
        val tasks = snap.optJSONArray("tasks")
        var open = 0
        var overdue = 0
        if (tasks != null) for (i in 0 until tasks.length()) {
            val t = tasks.optJSONObject(i) ?: continue
            if (doneLocal.contains(t.optString("id"))) continue
            open++
            if (t.optBoolean("overdue")) overdue++
        }
        list.addView(text(if (open == 0) "✓" else "$open", 30f, if (overdue > 0) "#F87171" else "#F2F2F2", bold = true, center = true).apply { setPadding(0, dp(2), 0, 0) })
        list.addView(text(if (open == 0) "wszystko zrobione" else "do zrobienia" + (if (overdue > 0) " · $overdue zaległe" else ""), 11f, "#A3A3A3", center = true))

        list.addView(section("ZADANIA"))
        if (tasks == null || tasks.length() == 0) list.addView(text("Nic do zrobienia", 13f, "#A3A3A3"))
        else for (i in 0 until tasks.length()) {
            val t = tasks.optJSONObject(i) ?: continue
            val id = t.optString("id")
            if (id.isEmpty() || doneLocal.contains(id)) continue
            val steps = t.optJSONArray("steps")
            val isOpen = expanded.contains(id)
            var stepsDone = 0
            val n = steps?.length() ?: 0
            for (k in 0 until n) {
                val st = steps!!.optJSONObject(k) ?: continue
                if (stepLocal["$id|${st.optString("id")}"] ?: st.optBoolean("done")) stepsDone++
            }
            val row = LinearLayout(this).apply {
                orientation = LinearLayout.HORIZONTAL
                gravity = Gravity.CENTER_VERTICAL
                setPadding(0, dp(6), 0, dp(6))
                isClickable = true
                setOnClickListener { if (isOpen) expanded.remove(id) else expanded.add(id); render(prefs.getString(Snapshot.KEY, null)) }
            }
            row.addView(text(if (isOpen) "▾" else "▸", 14f, "#A3A3A3").apply { setPadding(0, 0, dp(8), 0) })
            val col = LinearLayout(this).apply { orientation = LinearLayout.VERTICAL }
            col.addView(text(t.optString("title"), 14f, "#F2F2F2", maxLines = 2))
            val sub = t.optString("sub").replace(Regex("^\\d+/\\d+( · )?"), "")
            val meta = listOfNotNull(if (n > 0) "kroki $stepsDone/$n" else null, sub.ifEmpty { null }).joinToString(" · ")
            if (meta.isNotEmpty()) col.addView(text(meta, 11f, if (t.optBoolean("overdue")) "#F87171" else "#A3A3A3"))
            row.addView(col, LinearLayout.LayoutParams(0, LinearLayout.LayoutParams.WRAP_CONTENT, 1f))
            list.addView(row)

            if (isOpen) {
                for (k in 0 until n) {
                    val st = steps!!.optJSONObject(k) ?: continue
                    val sid = st.optString("id")
                    val done = stepLocal["$id|$sid"] ?: st.optBoolean("done")
                    val sr = LinearLayout(this).apply {
                        orientation = LinearLayout.HORIZONTAL
                        gravity = Gravity.CENTER_VERTICAL
                        setPadding(dp(18), dp(5), 0, dp(5))
                        isClickable = true
                        setOnClickListener { toggleStep(id, sid, !done) }
                    }
                    sr.addView(text(if (done) "●" else "○", 14f, if (done) "#4ADE80" else "#A3A3A3").apply { setPadding(0, 0, dp(8), 0) })
                    sr.addView(text(st.optString("title"), 13f, if (done) "#8A8A8A" else "#E5E5E5", maxLines = 2).apply {
                        if (done) paintFlags = paintFlags or Paint.STRIKE_THRU_TEXT_FLAG
                    }, LinearLayout.LayoutParams(0, LinearLayout.LayoutParams.WRAP_CONTENT, 1f))
                    list.addView(sr)
                }
                // Zakończenie całego zadania — tylko przytrzymaniem.
                val btn = text("Przytrzymaj: zadanie zrobione", 12f, "#000000", bold = true, center = true).apply {
                    setPadding(dp(10), dp(8), dp(10), dp(8))
                    background = android.graphics.drawable.GradientDrawable().apply { cornerRadius = dp(18).toFloat(); setColor(Color.parseColor("#D6D6D6")) }
                    isLongClickable = true
                    setOnLongClickListener { performHapticFeedback(android.view.HapticFeedbackConstants.LONG_PRESS); toggle(id); true }
                }
                list.addView(btn, LinearLayout.LayoutParams(LinearLayout.LayoutParams.MATCH_PARENT, LinearLayout.LayoutParams.WRAP_CONTENT).apply { setMargins(dp(18), dp(6), 0, dp(8)) })
            }
        }

        // Kalendarz i praca: dziś + jutro
        val events = snap.optJSONArray("events")
        if (events != null && events.length() > 0) {
            var lastDay = ""
            for (i in 0 until events.length()) {
                val e = events.optJSONObject(i) ?: continue
                val day = e.optString("day")
                if (day != lastDay) { list.addView(section(if (day == "jutro") "JUTRO" else "DZIŚ")); lastDay = day }
                val row = LinearLayout(this).apply {
                    orientation = LinearLayout.HORIZONTAL
                    gravity = Gravity.CENTER_VERTICAL
                    setPadding(0, dp(4), 0, dp(4))
                }
                val bar = android.view.View(this).apply {
                    background = android.graphics.drawable.GradientDrawable().apply { cornerRadius = dp(2).toFloat(); setColor(try { Color.parseColor(e.optString("color", "#A3A3A3")) } catch (x: Exception) { Color.GRAY }) }
                }
                row.addView(bar, LinearLayout.LayoutParams(dp(3), dp(28)).apply { setMargins(0, 0, dp(8), 0) })
                val col = LinearLayout(this).apply { orientation = LinearLayout.VERTICAL }
                col.addView(text(e.optString("time"), 10f, "#A3A3A3", bold = true))
                col.addView(text(e.optString("title"), 13f, "#F2F2F2", maxLines = 2))
                row.addView(col, LinearLayout.LayoutParams(0, LinearLayout.LayoutParams.WRAP_CONTENT, 1f))
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

    private fun dp(v: Int) = (v * resources.displayMetrics.density).roundToInt()
}
