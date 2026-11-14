package com.sokki.sapp2.wear

import java.util.Locale

// Wspólne dla appki, kafelka i usługi w tle: gdzie leży ostatni snapshot z telefonu.
object Snapshot {
    const val PREFS = "sapp2_wear"
    const val KEY = "snap"
    val PL: Locale = Locale("pl", "PL")
    fun money(v: Double): String = String.format(PL, "%.2f zł", v).replace("-", "−")
}
