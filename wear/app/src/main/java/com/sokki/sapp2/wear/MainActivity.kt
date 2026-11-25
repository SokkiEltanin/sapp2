package com.sokki.sapp2.wear

import android.app.Activity
import android.content.Intent
import android.os.Handler
import android.os.Looper
import android.text.SpannableString
import android.text.Spanned
import android.text.style.ForegroundColorSpan
import android.text.style.RelativeSizeSpan
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
import org.json.JSONArray
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
// 2026-11-21: licznik zarobków na żywo w czasie zmiany z kalendarza (snapshot "work"),
// humor palcem (MoodPadActivity). Tętno usunięte 2026-11-22 (user: "tętna nie chcę mieć widocznego").
class MainActivity : Activity(), DataClient.OnDataChangedListener {
    private lateinit var scroll: ScrollView
    private lateinit var list: LinearLayout
    private val prefs by lazy { getSharedPreferences(Snapshot.PREFS, MODE_PRIVATE) }
    private val doneLocal = mutableSetOf<String>()
    private val expanded = mutableSetOf<String>()
    private val stepLocal = mutableMapOf<String, Boolean>()
    private val pl = Locale("pl", "PL")

    // Licznik zarobków (odświeżany co 100 ms tylko gdy appka na wierzchu)
    private val ui = Handler(Looper.getMainLooper())
    private var shifts: JSONArray? = null
    private var activeKey = ""
    private var tickAmount: TextView? = null
    private var tickSub: TextView? = null
    private var tickFill: android.view.View? = null
    private var tickTrackW = 0
    private var resumed = false
    private val tick = object : Runnable {
        override fun run() {
            if (!resumed) return
            updateTicker()
            updateHero()
            ui.postDelayed(this, 100)
        }
    }


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
        list.setPadding(side, 0, side, dp(70))
        scroll.addView(list)
        // Okrągły ekran (2026-11-22, user: "dostosować wszystko pod koło"): wiersze przy górnej
        // i dolnej krawędzi zmniejszają się i bledną (jak listy Wear OS), nic nie ucina się na łuku.
        scroll.setOnScrollChangeListener { _, _, _, _, _ -> curve() }
        scroll.setOnGenericMotionListener { v, ev ->
            if (ev.action == MotionEvent.ACTION_SCROLL && ev.isFromSource(InputDevice.SOURCE_ROTARY_ENCODER)) {
                val delta = -ev.getAxisValue(MotionEvent.AXIS_SCROLL) * ViewConfiguration.get(this).scaledVerticalScrollFactor
                v.scrollBy(0, delta.roundToInt())
                true
            } else false
        }
        // Łuk postępu wokół krawędzi ekranu — nad listą, nie przewija się.
        val root = android.widget.FrameLayout(this)
        root.addView(scroll)
        arcView = ArcView(this).apply { isClickable = false; isFocusable = false }
        root.addView(arcView, android.widget.FrameLayout.LayoutParams(android.widget.FrameLayout.LayoutParams.MATCH_PARENT, android.widget.FrameLayout.LayoutParams.MATCH_PARENT))
        setContentView(root)
        render(prefs.getString(Snapshot.KEY, null))
    }

    override fun onResume() {
        super.onResume()
        resumed = true
        Wearable.getDataClient(this).addListener(this)
        fetch()
        render(prefs.getString(Snapshot.KEY, null)) // np. po zapisaniu humoru
        scroll.requestFocus()
        ui.removeCallbacks(tick)
        ui.post(tick)
    }

    override fun onPause() {
        super.onPause()
        resumed = false
        ui.removeCallbacks(tick)
        Wearable.getDataClient(this).removeListener(this)
    }










    // ── Licznik zarobków ──
    private fun currentShift(now: Long): JSONObject? {
        val a = shifts ?: return null
        for (i in 0 until a.length()) { val o = a.optJSONObject(i) ?: continue; if (now >= o.optLong("s") && now < o.optLong("e")) return o }
        return null
    }

    private fun nextShift(now: Long): JSONObject? {
        val a = shifts ?: return null
        for (i in 0 until a.length()) { val o = a.optJSONObject(i) ?: continue; if (o.optLong("s") > now) return o }
        return null
    }

    private fun shiftKey(now: Long): String {
        val c = currentShift(now)
        val n = nextShift(now)
        return (c?.optLong("s")?.toString() ?: "-") + "|" + (n?.optLong("s")?.toString() ?: "-")
    }

    private fun money4(v: Double): SpannableString {
        val s = String.format(pl, "%.4f", v)
        val cut = s.length - 2
        val out = SpannableString("$s zł")
        out.setSpan(RelativeSizeSpan(0.6f), cut, out.length, Spanned.SPAN_EXCLUSIVE_EXCLUSIVE)
        out.setSpan(ForegroundColorSpan(Color.parseColor("#8A8A8A")), cut, out.length, Spanned.SPAN_EXCLUSIVE_EXCLUSIVE)
        return out
    }

    private fun dur(ms: Long): String {
        val m = Math.max(0L, ms / 60000)
        return if (m >= 60) "${m / 60} h ${m % 60} min" else "$m min"
    }

    private fun updateTicker() {
        val now = System.currentTimeMillis()
        // zmiana się zaczęła / skończyła → przebuduj widok
        if (shiftKey(now) != activeKey) { render(prefs.getString(Snapshot.KEY, null)); return }
        val c = currentShift(now) ?: return
        val s = c.optLong("s"); val e = c.optLong("e"); val rate = c.optDouble("rate", 0.0)
        val earned = (now - s) / 3600000.0 * rate
        tickAmount?.text = money4(earned)
        tickSub?.text = "do " + SimpleDateFormat("HH:mm", pl).format(Date(e)) + " · zostało " + dur(e - now)
        val f = tickFill
        if (f != null && tickTrackW > 0) {
            val w = (tickTrackW * ((now - s).toDouble() / (e - s)).coerceIn(0.0, 1.0)).roundToInt()
            if (f.layoutParams.width != w) { f.layoutParams = f.layoutParams.apply { width = Math.max(dp(4), w) } }
        }
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
        tickAmount = null; tickSub = null; tickFill = null
        val snap = try { if (json != null) JSONObject(json) else null } catch (e: Exception) { null }
        shifts = snap?.optJSONArray("work")
        activeKey = shiftKey(System.currentTimeMillis())
        if (snap == null) {
            list.addView(text("Sapp", 11f, "#A3A3A3", bold = true, center = true))
            list.addView(text("Otwórz Sapp na telefonie — dane pojawią się tutaj.", 14f, "#F2F2F2", center = true, maxLines = 3).apply { setPadding(0, dp(10), 0, 0) })
            return
        }
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
        // Pierwszy ekran = cały okrąg: praca (licznik) albo najbliższe wydarzenie z odliczaniem.
        renderHero(snap, open, overdue)

        renderMood(snap)
        list.post { curve() }

        list.addView(section("ZADANIA"))
        if (tasks == null || tasks.length() == 0) list.addView(text("Nic do zrobienia", 13f, "#A3A3A3", center = true))
        else for (i in 0 until tasks.length()) {
            val t = tasks.optJSONObject(i) ?: continue
            val id = t.optString("id")
            if (id.isEmpty() || doneLocal.contains(id)) continue
            list.addView(taskCard(t, id))
        }

        // Kalendarz i praca: dziś + jutro — osobne karty z kolorem wydarzenia.
        val events = snap.optJSONArray("events")
        if (events == null || events.length() == 0) {
            list.addView(section("KALENDARZ"))
            list.addView(text("Dziś i jutro nic w kalendarzu", 13f, "#A3A3A3", center = true, maxLines = 2))
        } else {
            var lastDay = ""
            for (i in 0 until events.length()) {
                val e = events.optJSONObject(i) ?: continue
                val day = e.optString("day")
                if (day != lastDay) { list.addView(section(if (day == "jutro") "JUTRO" else "DZIŚ")); lastDay = day }
                val ec = try { Color.parseColor(e.optString("color", "#A3A3A3")) } catch (x: Exception) { Color.GRAY }
                val card = card(ec)
                card.addView(text(e.optString("time"), 11f, "#A3A3A3", bold = true).apply { setTextColor((ec and 0x00FFFFFF) or 0xE6000000.toInt()) })
                card.addView(text(e.optString("title"), 14f, "#F2F2F2", bold = true, maxLines = 2).apply { setPadding(0, dp(2), 0, 0) })
                list.addView(cardWrap(card, ec))
            }
        }
    }

    // ── Karty (2026-11-22, user: "lepsze kafelki zadań — przy wyśrodkowanym tekście nie widać, gdzie
    // koniec zadania, a gdzie zaczyna się kolejne; poczytaj o UI/UX na zegarki"). Wg zasad Wear OS:
    // każda pozycja = osobna zaokrąglona karta na całą szerokość z odstępem, tekst w karcie od lewej
    // (czyta się jak listę), nagłówki sekcji wyśrodkowane, cel dotyku min. 48 dp. W naszym stylu:
    // ciemna karta #1A1A1A i kolor (tag/wydarzenie/zaległe) jako sierp po łuku lewego rogu — jak w telefonie.
    private fun card(accent: Int?): LinearLayout = LinearLayout(this).apply {
        orientation = LinearLayout.VERTICAL
        minimumHeight = dp(48)
        gravity = Gravity.CENTER_VERTICAL
        setPadding(dp(14), dp(10), dp(12), dp(10))
        background = android.graphics.drawable.GradientDrawable().apply { cornerRadius = dp(22).toFloat(); setColor(Color.parseColor("#1A1A1A")) }
    }

    /** Karta na kolorowym tle przesunięta o 4 dp → kolorowy sierp po łuku lewego rogu. */
    private fun cardWrap(card: LinearLayout, accent: Int?): android.view.View {
        val lp = LinearLayout.LayoutParams(LinearLayout.LayoutParams.MATCH_PARENT, LinearLayout.LayoutParams.WRAP_CONTENT).apply { setMargins(0, dp(3), 0, dp(3)) }
        if (accent == null) { card.layoutParams = lp; return card }
        val wrap = android.widget.FrameLayout(this).apply {
            background = android.graphics.drawable.GradientDrawable().apply { cornerRadius = dp(22).toFloat(); setColor(accent) }
            layoutParams = lp
        }
        wrap.addView(card, android.widget.FrameLayout.LayoutParams(android.widget.FrameLayout.LayoutParams.MATCH_PARENT, android.widget.FrameLayout.LayoutParams.WRAP_CONTENT).apply { leftMargin = dp(4) })
        return wrap
    }

    private fun taskCard(t: JSONObject, id: String): android.view.View {
        val steps = t.optJSONArray("steps")
        val isOpen = expanded.contains(id)
        val n = steps?.length() ?: 0
        var stepsDone = 0
        for (k in 0 until n) {
            val st = steps!!.optJSONObject(k) ?: continue
            if (stepLocal["$id|${st.optString("id")}"] ?: st.optBoolean("done")) stepsDone++
        }
        val overdue = t.optBoolean("overdue")
        val accent = if (overdue) Color.parseColor("#F87171") else null
        val card = card(accent).apply {
            isClickable = true
            setOnClickListener { if (isOpen) expanded.remove(id) else expanded.add(id); render(prefs.getString(Snapshot.KEY, null)) }
        }
        card.addView(text(t.optString("title"), 14f, "#F2F2F2", bold = true, maxLines = if (isOpen) 4 else 2))
        val sub = t.optString("sub").replace(Regex("^\\d+/\\d+( · )?"), "")
        val meta = listOfNotNull(if (n > 0) "kroki $stepsDone/$n" else null, sub.ifEmpty { null }).joinToString(" · ")
        if (meta.isNotEmpty() || n > 0) {
            val row = LinearLayout(this).apply { orientation = LinearLayout.HORIZONTAL; gravity = Gravity.CENTER_VERTICAL; setPadding(0, dp(3), 0, 0) }
            row.addView(text(meta, 11f, if (overdue) "#F87171" else "#A3A3A3"), LinearLayout.LayoutParams(0, LinearLayout.LayoutParams.WRAP_CONTENT, 1f))
            if (n > 0) row.addView(text(if (isOpen) "▴" else "▾", 12f, "#A3A3A3"))
            card.addView(row)
        }
        // postęp kroków — cienki pasek wewnątrz karty (nie dotyka zaokrągleń)
        if (n > 0) {
            val track = android.widget.FrameLayout(this).apply { background = android.graphics.drawable.GradientDrawable().apply { cornerRadius = dp(2).toFloat(); setColor(Color.parseColor("#2E2E2E")) } }
            val fill = android.view.View(this).apply { background = android.graphics.drawable.GradientDrawable().apply { cornerRadius = dp(2).toFloat(); setColor(Color.parseColor("#4ADE80")) } }
            track.addView(fill, android.widget.FrameLayout.LayoutParams(0, dp(3)))
            track.addOnLayoutChangeListener { v, _, _, _, _, _, _, _, _ ->
                val w = (v.width * stepsDone.toFloat() / n).roundToInt()
                if (fill.layoutParams.width != w) fill.post { fill.layoutParams = fill.layoutParams.apply { width = w } }
            }
            card.addView(track, LinearLayout.LayoutParams(LinearLayout.LayoutParams.MATCH_PARENT, dp(3)).apply { setMargins(0, dp(6), 0, 0) })
        }
        if (isOpen) {
            for (k in 0 until n) {
                val st = steps!!.optJSONObject(k) ?: continue
                val sid = st.optString("id")
                val done = stepLocal["$id|$sid"] ?: st.optBoolean("done")
                val sr = LinearLayout(this).apply {
                    orientation = LinearLayout.HORIZONTAL
                    gravity = Gravity.CENTER_VERTICAL
                    minimumHeight = dp(40)
                    isClickable = true
                    setOnClickListener { toggleStep(id, sid, !done) }
                }
                sr.addView(text(if (done) "●" else "○", 15f, if (done) "#4ADE80" else "#A3A3A3").apply { setPadding(0, 0, dp(8), 0) })
                sr.addView(text(st.optString("title"), 13f, if (done) "#8A8A8A" else "#E5E5E5", maxLines = 2).apply {
                    if (done) paintFlags = paintFlags or Paint.STRIKE_THRU_TEXT_FLAG
                }, LinearLayout.LayoutParams(0, LinearLayout.LayoutParams.WRAP_CONTENT, 1f))
                card.addView(sr)
            }
            // Zakończenie całego zadania — tylko przytrzymaniem.
            val btn = text("Przytrzymaj: zrobione", 12f, "#000000", bold = true, center = true).apply {
                setPadding(dp(10), dp(9), dp(10), dp(9))
                background = android.graphics.drawable.GradientDrawable().apply { cornerRadius = dp(18).toFloat(); setColor(Color.parseColor("#D6D6D6")) }
                isLongClickable = true
                setOnLongClickListener { performHapticFeedback(android.view.HapticFeedbackConstants.LONG_PRESS); toggle(id); true }
            }
            card.addView(btn, LinearLayout.LayoutParams(LinearLayout.LayoutParams.MATCH_PARENT, LinearLayout.LayoutParams.WRAP_CONTENT).apply { setMargins(0, dp(8), 0, 0) })
        }
        return cardWrap(card, accent)
    }

    // ── Pierwszy ekran (2026-11-22, user: "ten ekran na głównej bym podzielił; zamiast liczby zadań
    // najbliższy event jak na Dashboardzie z odliczaniem"): cały okrąg. W pracy — licznik zarobków,
    // inaczej najbliższe wydarzenie (snapshot "next", czasy bezwzględne → odliczanie na żywo).
    // Trwające wydarzenie/zmiana = łuk postępu wokół krawędzi. Na dole podpowiedź: niżej zadania.
    private var heroClock: TextView? = null
    private var heroCount: TextView? = null
    private var heroSub: TextView? = null
    private var arcView: ArcView? = null
    private var heroEv: JSONObject? = null

    private fun nextEvent(snap: JSONObject?, now: Long): JSONObject? {
        val a = snap?.optJSONArray("next") ?: return null
        for (i in 0 until a.length()) { val o = a.optJSONObject(i) ?: continue; if (o.optLong("e") > now || o.optLong("s") > now) return o }
        return null
    }

    private fun countdown(ms: Long): String {
        val m = Math.max(0L, (ms + 59999) / 60000)
        return when {
            m >= 48 * 60 -> "${m / 1440} dni"
            m >= 24 * 60 -> "${m / 1440} d ${(m % 1440) / 60} h"
            m >= 60 -> if (m % 60 == 0L) "${m / 60} h" else "${m / 60} h ${m % 60} min"
            else -> "$m min"
        }
    }

    private fun whenLabel(s: Long, e: Long, now: Long): String {
        val hm = SimpleDateFormat("HH:mm", pl)
        val day = SimpleDateFormat("yyyyMMdd", Locale.US)
        val d0 = day.format(Date(now)); val ds = day.format(Date(s))
        val tom = day.format(Date(now + 86400000L))
        val dayTxt = when (ds) { d0 -> "dziś"; tom -> "jutro"; else -> SimpleDateFormat("EEE d MMM", pl).format(Date(s)) }
        return dayTxt + " " + hm.format(Date(s)) + (if (e > s) "–" + hm.format(Date(e)) else "")
    }

    private fun renderHero(snap: JSONObject, open: Int, overdue: Int) {
        heroClock = null; heroCount = null; heroSub = null; heroEv = null
        arcView?.let { it.s = 0; it.e = 0 }
        val now = System.currentTimeMillis()
        val dm = resources.displayMetrics
        val page = android.widget.FrameLayout(this)
        val col = LinearLayout(this).apply { orientation = LinearLayout.VERTICAL; gravity = Gravity.CENTER }
        page.addView(col, android.widget.FrameLayout.LayoutParams(android.widget.FrameLayout.LayoutParams.MATCH_PARENT, android.widget.FrameLayout.LayoutParams.MATCH_PARENT))
        heroClock = text(SimpleDateFormat("HH:mm", pl).format(Date(now)), 11f, "#A3A3A3", bold = true, center = true)
        col.addView(heroClock)

        val shift = currentShift(now)
        if (shift != null) {
            val accent = try { Color.parseColor(shift.optString("color", "#4ADE80")) } catch (e: Exception) { Color.parseColor("#4ADE80") }
            val rate = shift.optDouble("rate", 0.0)
            col.addView(text("W PRACY · " + shift.optString("name").uppercase(pl), 10f, "#A3A3A3", bold = true, center = true).apply { letterSpacing = 0.06f; setPadding(0, dp(8), 0, dp(2)) })
            tickAmount = text("", 26f, "#F2F2F2", bold = true, center = true).apply { setTextColor(accent); fontFeatureSettings = "tnum" }
            col.addView(tickAmount)
            col.addView(text(String.format(pl, "%.2f zł/h · %.4f zł/s", rate, rate / 3600), 10f, "#A3A3A3", center = true))
            tickSub = text("", 11f, "#D6D6D6", center = true).apply { setPadding(0, dp(6), 0, 0) }
            col.addView(tickSub)
            val total = (shift.optLong("e") - shift.optLong("s")) / 3600000.0 * rate
            col.addView(text(String.format(pl, "cała zmiana ≈ %.0f zł", total), 10f, "#8A8A8A", center = true))
            arcView?.let { it.color = accent; it.s = shift.optLong("s"); it.e = shift.optLong("e") }
        } else {
            val ev = nextEvent(snap, now)
            if (ev != null) {
                heroEv = ev
                val ec = try { Color.parseColor(ev.optString("color", "#A3A3A3")) } catch (x: Exception) { Color.GRAY }
                val tag = if (ev.isNull("tag")) "" else ev.optString("tag")
                if (tag.isNotEmpty()) col.addView(text(tag, 10f, "#F2F2F2", bold = true, center = true).apply {
                    setPadding(dp(8), dp(2), dp(8), dp(2))
                    background = android.graphics.drawable.GradientDrawable().apply { cornerRadius = dp(8).toFloat(); setColor((ec and 0x00FFFFFF) or 0x55000000) }
                }, LinearLayout.LayoutParams(LinearLayout.LayoutParams.WRAP_CONTENT, LinearLayout.LayoutParams.WRAP_CONTENT).apply { gravity = Gravity.CENTER_HORIZONTAL; setMargins(0, dp(8), 0, dp(2)) })
                heroCount = text("", 30f, "#F2F2F2", bold = true, center = true).apply { fontFeatureSettings = "tnum" }
                col.addView(heroCount)
                col.addView(text(whenLabel(ev.optLong("s"), ev.optLong("e"), now), 11f, "#A3A3A3", bold = true, center = true))
                col.addView(text(ev.optString("title"), 15f, "#F2F2F2", bold = true, center = true, maxLines = 2).apply { setPadding(dp(6), dp(8), dp(6), 0) })
                // zmiana z kalendarza → ile z niej wyjdzie
                val sh = shifts
                if (sh != null) for (i in 0 until sh.length()) {
                    val o = sh.optJSONObject(i) ?: continue
                    if (o.optLong("s") == ev.optLong("s")) {
                        col.addView(text(String.format(pl, "zarobisz ≈ %.0f zł", (o.optLong("e") - o.optLong("s")) / 3600000.0 * o.optDouble("rate", 0.0)), 11f, "#4ADE80", center = true))
                    }
                }
                heroSub = text("", 11f, "#D6D6D6", center = true).apply { setPadding(0, dp(4), 0, 0) }
                col.addView(heroSub)
                arcView?.let { it.color = ec; it.s = ev.optLong("s"); it.e = ev.optLong("e") }
            } else {
                col.addView(text("Nic w kalendarzu", 16f, "#F2F2F2", bold = true, center = true).apply { setPadding(0, dp(10), 0, 0) })
                col.addView(text("na najbliższy tydzień", 11f, "#A3A3A3", center = true))
            }
        }
        val hint = (if (open == 0) "✓ zadania zrobione" else "▾ $open do zrobienia") + (if (overdue > 0) " · $overdue zaległe" else "")
        col.addView(text(hint, 11f, if (overdue > 0) "#F87171" else "#A3A3A3", bold = true, center = true).apply { setPadding(0, dp(14), 0, 0) })
        // strona = cała wysokość ekranu (minus boczne marginesy listy nie dotyczą wysokości)
        list.addView(page, LinearLayout.LayoutParams(LinearLayout.LayoutParams.MATCH_PARENT, dm.heightPixels))
        updateTicker()
        updateHero()
    }

    private fun updateHero() {
        val now = System.currentTimeMillis()
        heroClock?.let { val t = SimpleDateFormat("HH:mm", pl).format(Date(now)); if (it.text.toString() != t) it.text = t }
        val ev = heroEv
        if (ev != null) {
            val s = ev.optLong("s"); val e = ev.optLong("e")
            // wydarzenie się skończyło (albo zaczęło, gdy nie ma końca) → następne
            if (now >= e && now >= s) { heroEv = null; render(prefs.getString(Snapshot.KEY, null)); return }
            val txt = if (now < s) countdown(s - now) else "teraz"
            heroCount?.let { if (it.text.toString() != txt) it.text = txt }
            val sub = if (now >= s) "trwa · zostało " + countdown(e - now) else ""
            heroSub?.let { if (it.text.toString() != sub) it.text = sub }
        }
        arcView?.invalidate()
    }

    // Wiersze przy krawędziach okręgu: mniejsze i przygaszone (pierwszy ekran bez zmian).
    private fun curve() {
        val h = scroll.height
        if (h <= 0) return
        val y0 = scroll.scrollY
        for (i in 0 until list.childCount) {
            val c = list.getChildAt(i)
            if (c.height >= h - 2) { c.scaleX = 1f; c.scaleY = 1f; c.alpha = 1f; continue }
            val mid = c.top + c.height / 2f - y0
            val d = Math.abs(mid - h / 2f) / (h / 2f)
            val k = ((d - 0.55f) / 0.45f).coerceIn(0f, 1f)
            val sc = 1f - 0.22f * k
            c.pivotX = c.width / 2f; c.pivotY = c.height / 2f
            c.scaleX = sc; c.scaleY = sc
            c.alpha = 1f - 0.65f * k
        }
    }

    // Humor dziś: z telefonu (snapshot "mood") + zapisane na zegarku po ostatnim snapshotcie.
    private fun renderMood(snap: JSONObject) {
        val snapT = snap.optLong("t", 0L)
        val today = Mood.today()
        val sm = if (Snapshot.isToday(snap)) snap.optJSONObject("mood") else null
        var n = sm?.optInt("n", 0) ?: 0
        var m: Double? = sm?.let { if (it.isNull("mood")) null else it.optDouble("mood") }
        var en: Double? = sm?.let { if (it.isNull("energy")) null else it.optDouble("energy") }
        val local = try { JSONArray(prefs.getString(Mood.LOCAL, "[]")) } catch (e: Exception) { JSONArray() }
        for (i in 0 until local.length()) {
            val o = local.optJSONObject(i) ?: continue
            if (o.optString("date") != today || o.optLong("t") <= snapT) continue
            n++; m = o.optDouble("mood"); en = o.optDouble("energy")
        }
        list.addView(section("HUMOR"))
        val row = LinearLayout(this).apply {
            orientation = LinearLayout.HORIZONTAL
            gravity = Gravity.CENTER_VERTICAL
            setPadding(dp(10), dp(8), dp(10), dp(8))
            isClickable = true
            background = android.graphics.drawable.GradientDrawable().apply { cornerRadius = dp(22).toFloat(); setColor(Color.parseColor(if (n == 0) "#1F2A1F" else "#1A1A1A")) }
            setOnClickListener { startActivity(Intent(this@MainActivity, MoodPadActivity::class.java)) }
        }
        if (n > 0 && m != null && en != null) {
            row.addView(text("●", 16f, "#F2F2F2").apply { setTextColor(Mood.color(m!!)); setPadding(0, 0, dp(8), 0) })
            val col = LinearLayout(this).apply { orientation = LinearLayout.VERTICAL }
            col.addView(text(Mood.label(m!!, en!!), 13f, "#F2F2F2", maxLines = 2))
            col.addView(text(if (n == 1) "zapisany dziś · stuknij, by dodać" else "$n× dziś · stuknij, by dodać", 10f, "#A3A3A3"))
            row.addView(col, LinearLayout.LayoutParams(0, LinearLayout.LayoutParams.WRAP_CONTENT, 1f))
        } else {
            row.addView(text("+", 18f, "#4ADE80", bold = true).apply { setPadding(0, 0, dp(8), 0) })
            row.addView(text("Jak się dziś czujesz?", 13f, "#F2F2F2", maxLines = 2), LinearLayout.LayoutParams(0, LinearLayout.LayoutParams.WRAP_CONTENT, 1f))
        }
        list.addView(row)
    }


    private fun section(label: String) = text(label, 10f, "#A3A3A3", bold = true, center = true).apply {
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

// Łuk postępu wokół okrągłego ekranu (trwające wydarzenie / zmiana w pracy).
class ArcView(ctx: android.content.Context) : android.view.View(ctx) {
    var color: Int = Color.WHITE
    var s: Long = 0
    var e: Long = 0
    private val track = Paint(Paint.ANTI_ALIAS_FLAG).apply { style = Paint.Style.STROKE; strokeCap = Paint.Cap.ROUND; color = 0xFF1E1E1E.toInt() }
    private val fill = Paint(Paint.ANTI_ALIAS_FLAG).apply { style = Paint.Style.STROKE; strokeCap = Paint.Cap.ROUND }
    private val r = android.graphics.RectF()
    override fun onDraw(c: android.graphics.Canvas) {
        val now = System.currentTimeMillis()
        if (e <= s || now < s || now > e) return
        val w = 5f * resources.displayMetrics.density
        track.strokeWidth = w; fill.strokeWidth = w; fill.color = color
        val size = Math.min(width, height).toFloat()
        val cx = width / 2f; val cy = height / 2f
        r.set(cx - size / 2 + w, cy - size / 2 + w, cx + size / 2 - w, cy + size / 2 - w)
        c.drawArc(r, -90f, 360f, false, track)
        c.drawArc(r, -90f, 360f * ((now - s).toFloat() / (e - s)), false, fill)
    }
}
