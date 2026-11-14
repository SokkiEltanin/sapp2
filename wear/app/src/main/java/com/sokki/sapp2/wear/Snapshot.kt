package com.sokki.sapp2.wear

import org.json.JSONObject
import java.text.SimpleDateFormat
import java.util.Date
import java.util.Locale

// Wspólne dla appki, kafelka i usługi w tle: gdzie leży ostatni snapshot z telefonu.
object Snapshot {
    const val PREFS = "sapp2_wear"
    const val KEY = "snap"
    val PL: Locale = Locale("pl", "PL")
    fun money(v: Double): String = String.format(PL, "%.2f zł", v).replace("-", "−")

    /** Czy snapshot jest z dzisiaj — inaczej "dziś" z telefonu jest nieaktualne (po północy). */
    fun isToday(snap: JSONObject): Boolean {
        val day = snap.optString("day", "")
        return day.isEmpty() || day == SimpleDateFormat("yyyy-MM-dd", Locale.US).format(Date())
    }
}
